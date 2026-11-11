import { describe, expect, it } from "vitest";
import {
  FEEDBACK_CONTRACT_VERSION,
  FEEDBACK_REVIEW_WORKFLOW_CONTRACT_VERSION,
  FEEDBACK_REVIEW_OUTCOMES,
  FeedbackReviewWorkflowStateSchema,
  FeedbackReviewTransitionRequestSchema,
  FeedbackReviewTransitionEventSchema,
  FeedbackReviewIdempotencyReceiptSchema,
  FeedbackReviewProjectionCheckpointSchema,
  FeedbackReviewQueueQuerySchema,
  FeedbackReviewProjectionFreshnessSchema,
  FeedbackReviewQueuePageSchema,
  FeedbackReviewHistoryPageSchema,
  FeedbackReviewItemDetailSchema,
} from "../src/index.js";

const packetId = "123e4567-e89b-42d3-a456-426614174000";
const operationId = "223e4567-e89b-42d3-a456-426614174000";
const acceptedAt = "2026-09-01T00:00:00.000Z";
const occurredAt = "2026-09-02T00:00:00.000Z";
const expiresAt = "2026-11-30T00:00:00.000Z";
const state = {
  packetId, kind: "bug", acceptedAt, expiresAt, updatedAt: acceptedAt,
  revision: 1, status: "unreviewed", surfaceId: "site.home",
  issueType: "functionality", severity: 3,
};
const command = { action: "mark-reviewed", expectedRevision: 1 };
const event = {
  packetId, kind: "bug", acceptedAt, expiresAt, occurredAt,
  revision: 2, action: "mark-reviewed", fromStatus: "unreviewed", toStatus: "reviewed",
};
const receipt = {
  ...event, operationId, auditIntentId: operationId, auditStatus: "pending",
  expectedRevision: 1,
};
const checkpoint = {
  kind: "bug", revision: 1, continuation: "YWJj", backfillComplete: false,
  updatedAt: occurredAt, lastSuccessfulAt: occurredAt, leaseEpoch: 1,
};
const freshness = {
  status: "incomplete", checkedAt: occurredAt, backfillComplete: false,
};
const query = {
  kind: "bug", status: "unreviewed", from: acceptedAt, to: occurredAt, limit: 100,
};
const reviewedState = { ...state, revision: 2, status: "reviewed", updatedAt: occurredAt };
const history = { packetId, kind: "bug", events: [event] };
const detail = { state: reviewedState, history };
const schemasAndValues = [
  [FeedbackReviewWorkflowStateSchema, state],
  [FeedbackReviewTransitionRequestSchema, command],
  [FeedbackReviewTransitionEventSchema, event],
  [FeedbackReviewIdempotencyReceiptSchema, receipt],
  [FeedbackReviewProjectionCheckpointSchema, checkpoint],
  [FeedbackReviewQueueQuerySchema, query],
  [FeedbackReviewProjectionFreshnessSchema, freshness],
  [FeedbackReviewQueuePageSchema, { items: [state], range: query, freshness }],
  [FeedbackReviewHistoryPageSchema, history],
  [FeedbackReviewItemDetailSchema, detail],
] as const;

describe("privacy-safe feedback review workflow contracts", () => {
  it("versions workflow independently without changing existing packet contracts", () => {
    expect(FEEDBACK_REVIEW_WORKFLOW_CONTRACT_VERSION).toBe("1.0.0");
    expect(FEEDBACK_CONTRACT_VERSION).toBe("1.0.0");
  });

  it.each(schemasAndValues)("validates and round-trips a closed contract %#", (schema, value) => {
    const result = schema.validate(value);
    expect(result.valid).toBe(true);
    expect(schema.getPiiAudit()).toEqual([]);
    const prepared = schema.prepareForStorage(result.value ?? {}, () => "forbidden", () => "forbidden");
    expect(schema.validate(prepared).valid).toBe(true);
    expect(schema.validate({ ...value, version: "2.0.0" }).valid).toBe(false);
    expect(schema.validate({ ...value, type: "feedback-bug-packet" }).valid).toBe(false);
  });

  it.each(["accountId", "pseudonym", "actorId", "reviewedBy", "email", "notes", "url", "packet", "idempotencyKey"])(
    "rejects forbidden field %s everywhere without echoing the canary", (key) => {
      for (const [schema, value] of schemasAndValues) {
        const result = schema.validate({ ...value, [key]: "synthetic-person@example.invalid" });
        expect(result.valid).toBe(false);
        expect(JSON.stringify(result.errors)).not.toContain("synthetic-person");
        expect(JSON.stringify(result.errors)).not.toContain(key);
      }
    },
  );

  it("separates bug filter fields from satisfaction fields", () => {
    const { surfaceId: _surface, issueType: _issue, severity: _severity, ...common } = state;
    expect(FeedbackReviewWorkflowStateSchema.validate({ ...common, kind: "review", satisfaction: 5 }).valid).toBe(true);
    for (const change of [
      { satisfaction: 5 }, { kind: "review", satisfaction: 5 }, { kind: "draft" },
      { surfaceId: "/profile?email=synthetic@example.invalid" },
      { issueType: "privacy-security" }, { severity: 0 }, { severity: 5.5 },
      { packetId: packetId.toUpperCase() }, { revision: 0 }, { revision: Infinity },
    ]) expect(FeedbackReviewWorkflowStateSchema.validate({ ...state, ...change }).valid).toBe(false);
    expect(FeedbackReviewWorkflowStateSchema.validate(common).valid).toBe(false);
  });

  it("requires outcome only in processed state and a valid revision", () => {
    for (const outcome of FEEDBACK_REVIEW_OUTCOMES) {
      expect(FeedbackReviewWorkflowStateSchema.validate({ ...state, status: "processed", revision: 3, outcome, updatedAt: occurredAt }).valid).toBe(true);
      expect(FeedbackReviewWorkflowStateSchema.validate({ ...state, outcome }).valid).toBe(false);
    }
    for (const change of [
      { status: "processed", revision: 3 }, { status: "reviewed" },
      { status: "unreviewed", revision: 2 }, { status: "processed", revision: 2, outcome: "duplicate" },
      { outcome: undefined }, { outcome: null }, { status: "deleted" },
    ]) expect(FeedbackReviewWorkflowStateSchema.validate({ ...state, ...change }).valid).toBe(false);
    expect(FeedbackReviewWorkflowStateSchema.validate({ ...state, revision: 2, status: "reviewed", updatedAt: occurredAt }).valid).toBe(true);
  });

  it.each([
    { acceptedAt: "2026-02-30T00:00:00.000Z" },
    { acceptedAt: "2026-09-01T00:00:00Z" },
    { expiresAt: acceptedAt }, { updatedAt: expiresAt },
    { updatedAt: "2026-08-31T23:59:59.999Z" },
    { expiresAt: "2026-12-01T00:00:00.000Z" },
  ])("rejects invalid chronology or retention %#", (change) => {
    expect(() => FeedbackReviewWorkflowStateSchema.validate({ ...state, ...change })).not.toThrow();
    expect(FeedbackReviewWorkflowStateSchema.validate({ ...state, ...change }).valid).toBe(false);
  });

  it("accepts only the three explicit commands with a required revision", () => {
    expect(FeedbackReviewTransitionRequestSchema.validate({ action: "reopen", expectedRevision: 3 }).valid).toBe(true);
    for (const outcome of FEEDBACK_REVIEW_OUTCOMES) {
      expect(FeedbackReviewTransitionRequestSchema.validate({ action: "process", expectedRevision: 2, outcome }).valid).toBe(true);
    }
    for (const change of [
      { action: "process" }, { action: "open" }, { expectedRevision: 0 },
      { expectedRevision: 1.5 }, { outcome: "duplicate" }, { outcome: undefined },
      { action: "process", outcome: "fixed" },
    ]) expect(FeedbackReviewTransitionRequestSchema.validate({ ...command, ...change }).valid).toBe(false);
  });

  it("validates transition history rather than arbitrary status edits", () => {
    expect(FeedbackReviewTransitionEventSchema.validate({ ...event, action: "process", fromStatus: "reviewed", toStatus: "processed", revision: 3, outcome: "acknowledged" }).valid).toBe(true);
    expect(FeedbackReviewTransitionEventSchema.validate({ ...event, action: "reopen", fromStatus: "processed", toStatus: "reviewed", revision: 4 }).valid).toBe(true);
    for (const change of [
      { fromStatus: "processed" }, { toStatus: "processed" }, { revision: 1 },
      { revision: 3 }, { action: "process", fromStatus: "reviewed", toStatus: "processed", revision: 3 },
      { action: "reopen", fromStatus: "processed", revision: 2 },
      { occurredAt: expiresAt }, { outcome: "duplicate" },
    ]) expect(FeedbackReviewTransitionEventSchema.validate({ ...event, ...change }).valid).toBe(false);
  });

  it("binds retry receipts to exactly one revision and an audit lifecycle", () => {
    expect(FeedbackReviewIdempotencyReceiptSchema.validate({ ...receipt, auditStatus: "complete" }).valid).toBe(true);
    for (const change of [
      { expectedRevision: 2 }, { auditStatus: "skipped" },
      { operationId: "synthetic-person@example.invalid" }, { auditIntentId: "admin:123" },
    ]) expect(FeedbackReviewIdempotencyReceiptSchema.validate({ ...receipt, ...change }).valid).toBe(false);
    const validated = FeedbackReviewIdempotencyReceiptSchema.validate(receipt);
    const publicValue = FeedbackReviewIdempotencyReceiptSchema.serialize(validated.value ?? {});
    expect(JSON.stringify(publicValue)).not.toContain(operationId);
    expect(publicValue).not.toHaveProperty("auditStatus");
  });

  it("keeps opaque change-feed checkpoints server-only and bounded", () => {
    const validated = FeedbackReviewProjectionCheckpointSchema.validate(checkpoint);
    expect(FeedbackReviewProjectionCheckpointSchema.serialize(validated.value ?? {})).not.toHaveProperty("continuation");
    for (const change of [
      { continuation: "https://example.invalid" }, { continuation: "a".repeat(16_385) },
      { leaseEpoch: 0 }, { revision: 0 }, { kind: "bug-acceptance" },
      { lastSuccessfulAt: "2026-09-03T00:00:00.000Z" },
    ]) expect(FeedbackReviewProjectionCheckpointSchema.validate({ ...checkpoint, ...change }).valid).toBe(false);
  });

  it("bounds and separates queue filters", () => {
    for (const change of [
      { limit: 101 }, { limit: 0 }, { limit: 1.5 }, { from: occurredAt },
      { to: "2028-01-01T00:00:00.000Z" }, { status: "unreviewed", outcome: "duplicate" },
      { kind: "review", severity: 3 }, { satisfaction: 5 },
      { cursor: "https://example.invalid" }, { cursor: "a".repeat(4097) },
    ]) expect(FeedbackReviewQueueQuerySchema.validate({ ...query, ...change }).valid).toBe(false);
    expect(FeedbackReviewQueueQuerySchema.validate({ ...query, kind: "review", satisfaction: 1, status: "processed", outcome: "no-action", cursor: "YWJj" }).valid).toBe(true);
    expect(FeedbackReviewQueueQuerySchema.validate({ ...query, surfaceId: "site.home", issueType: "other", severity: 1 }).valid).toBe(true);
  });

  it("cannot label incomplete or old projection as fresh", () => {
    const fresh = { status: "fresh", checkedAt: occurredAt, backfillComplete: true, lastSuccessfulAt: occurredAt };
    expect(FeedbackReviewProjectionFreshnessSchema.validate(fresh).valid).toBe(true);
    expect(FeedbackReviewProjectionFreshnessSchema.validate({ ...fresh, lastSuccessfulAt: "2026-09-01T23:50:00.000Z" }).valid).toBe(true);
    expect(FeedbackReviewProjectionFreshnessSchema.validate({ ...fresh, lastSuccessfulAt: acceptedAt }).valid).toBe(false);
    expect(FeedbackReviewProjectionFreshnessSchema.validate({ ...fresh, status: "stale", lastSuccessfulAt: acceptedAt }).valid).toBe(true);
    expect(FeedbackReviewProjectionFreshnessSchema.validate({ ...fresh, backfillComplete: false }).valid).toBe(false);
    expect(FeedbackReviewProjectionFreshnessSchema.validate({ ...fresh, lastSuccessfulAt: "2026-09-03T00:00:00.000Z" }).valid).toBe(false);
    expect(FeedbackReviewProjectionFreshnessSchema.validate({ ...fresh, lastSuccessfulAt: undefined }).valid).toBe(false);
  });

  it("rejects malformed opaque values without coercion, an exception or an echo", () => {
    for (const malformed of [[packetId], Symbol("synthetic-canary"), { toString: null }, 42]) {
      const cases = [
        [FeedbackReviewWorkflowStateSchema, { ...state, packetId: malformed }],
        [FeedbackReviewWorkflowStateSchema, { ...state, acceptedAt: malformed }],
        [FeedbackReviewIdempotencyReceiptSchema, { ...receipt, auditIntentId: malformed }],
        [FeedbackReviewProjectionCheckpointSchema, { ...checkpoint, continuation: malformed }],
        [FeedbackReviewQueueQuerySchema, { ...query, cursor: malformed }],
        [FeedbackReviewHistoryPageSchema, { ...history, events: [{ ...event, packetId: malformed }] }],
      ] as const;
      for (const [schema, value] of cases) {
        const result = schema.validate(value);
        expect(result.valid).toBe(false);
        expect(JSON.stringify(result.errors)).not.toContain("synthetic-canary");
      }
    }
  });

  it("keeps detail history tied to the state, its original expiry and current revision", () => {
    expect(FeedbackReviewItemDetailSchema.validate(detail).valid).toBe(true);
    const cases = [
      { ...detail, state: { ...reviewedState, packetId: operationId } },
      { ...detail, state },
      { ...detail, state: { ...reviewedState, updatedAt: acceptedAt } },
      { ...detail, state: { ...reviewedState, expiresAt: "2026-11-29T00:00:00.000Z" } },
      { ...detail, history: { ...history, events: [{ ...event, actorId: operationId }] } },
      { ...detail, history: { ...history, events: [{ ...event, acceptedAt: occurredAt }] } },
      { ...detail, history: { ...history, events: [{ ...event, occurredAt: acceptedAt }] } },
      { ...detail, history: { ...history, nextCursor: [ "YWJj" ] } },
    ];
    for (const value of cases) expect(FeedbackReviewItemDetailSchema.validate(value).valid).toBe(false);
  });

  it("bounds queue and history output and rejects mixed-item history", () => {
    const page = { items: [state], range: query, freshness };
    expect(FeedbackReviewQueuePageSchema.validate({ ...page, items: Array(101).fill(state) }).valid).toBe(false);
    expect(FeedbackReviewQueuePageSchema.validate({ ...page, items: [{ ...state, notes: "synthetic-person@example.invalid" }] }).valid).toBe(false);
    expect(FeedbackReviewQueuePageSchema.validate({ ...page, range: { ...query, kind: "review" } }).valid).toBe(false);
    const history = { packetId, kind: "bug", events: [event] };
    expect(FeedbackReviewHistoryPageSchema.validate({ ...history, events: Array(26).fill(event) }).valid).toBe(false);
    expect(FeedbackReviewHistoryPageSchema.validate({ ...history, events: [{ ...event, packetId: operationId }] }).valid).toBe(false);
    expect(FeedbackReviewHistoryPageSchema.validate({ ...history, events: [event, event] }).valid).toBe(false);
    expect(FeedbackReviewHistoryPageSchema.validate({ ...history, events: [], nextCursor: "YWJj" }).valid).toBe(true);
  });
});
