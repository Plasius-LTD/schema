import { field } from "./field.js";
import { FEEDBACK_PERSISTABLE_ISSUE_TYPES, FEEDBACK_SURFACE_IDS } from "./feedback.js";
import { createSchema } from "./schema.js";
import type { SchemaShape, SchemaValidationContext } from "./types.js";
import { validateUUID } from "./validation/uuid.RFC4122.js";

/** Independently versioned; existing feedback packets and acceptance receipts are unchanged. */
export const FEEDBACK_REVIEW_WORKFLOW_CONTRACT_VERSION = "1.0.0";
export const FEEDBACK_REVIEW_KINDS = Object.freeze(["bug", "review"] as const);
export const FEEDBACK_REVIEW_STATUSES = Object.freeze(["unreviewed", "reviewed", "processed"] as const);
export const FEEDBACK_REVIEW_ACTIONS = Object.freeze(["mark-reviewed", "process", "reopen"] as const);
export const FEEDBACK_REVIEW_OUTCOMES = Object.freeze([
  "action-tracked", "duplicate", "acknowledged", "no-action",
] as const);
export type FeedbackReviewKind = (typeof FEEDBACK_REVIEW_KINDS)[number];
export type FeedbackReviewStatus = (typeof FEEDBACK_REVIEW_STATUSES)[number];
export type FeedbackReviewAction = (typeof FEEDBACK_REVIEW_ACTIONS)[number];
export type FeedbackReviewOutcome = (typeof FEEDBACK_REVIEW_OUTCOMES)[number];

export interface FeedbackReviewWorkflowState {
  type?: "feedback-review-workflow-state";
  version?: typeof FEEDBACK_REVIEW_WORKFLOW_CONTRACT_VERSION;
  packetId: string;
  kind: FeedbackReviewKind;
  acceptedAt: string;
  expiresAt: string;
  updatedAt: string;
  revision: number;
  status: FeedbackReviewStatus;
  outcome?: FeedbackReviewOutcome;
  surfaceId?: (typeof FEEDBACK_SURFACE_IDS)[number];
  issueType?: (typeof FEEDBACK_PERSISTABLE_ISSUE_TYPES)[number];
  severity?: number;
  satisfaction?: number;
}

export type FeedbackReviewTransitionRequest = {
  expectedRevision: number;
} & (
  | { action: "mark-reviewed" | "reopen"; outcome?: never }
  | { action: "process"; outcome: FeedbackReviewOutcome }
);

export interface FeedbackReviewTransitionEvent {
  type?: "feedback-review-transition-event";
  version?: typeof FEEDBACK_REVIEW_WORKFLOW_CONTRACT_VERSION;
  packetId: string;
  kind: FeedbackReviewKind;
  acceptedAt: string;
  expiresAt: string;
  occurredAt: string;
  revision: number;
  action: FeedbackReviewAction;
  fromStatus: FeedbackReviewStatus;
  toStatus: FeedbackReviewStatus;
  outcome?: FeedbackReviewOutcome;
}

export interface FeedbackReviewIdempotencyReceipt extends Omit<FeedbackReviewTransitionEvent, "type"> {
  type?: "feedback-review-idempotency-receipt";
  expectedRevision: number;
  /** Random per-operation identifiers, never derived from an actor or reporter. */
  operationId: string;
  auditIntentId: string;
  auditStatus: "pending" | "complete";
}

export interface FeedbackReviewProjectionCheckpoint {
  type?: "feedback-review-projection-checkpoint";
  version?: typeof FEEDBACK_REVIEW_WORKFLOW_CONTRACT_VERSION;
  kind: FeedbackReviewKind;
  revision: number;
  /** Server-only encoded SDK continuation. This is not a public API cursor. */
  continuation: string;
  backfillComplete: boolean;
  updatedAt: string;
  lastSuccessfulAt: string;
  leaseEpoch: number;
}

export interface FeedbackReviewQueueQuery {
  kind: FeedbackReviewKind;
  status?: FeedbackReviewStatus;
  outcome?: FeedbackReviewOutcome;
  from: string;
  to: string;
  limit: number;
  surfaceId?: (typeof FEEDBACK_SURFACE_IDS)[number];
  issueType?: (typeof FEEDBACK_PERSISTABLE_ISSUE_TYPES)[number];
  severity?: number;
  satisfaction?: number;
  cursor?: string;
}

export interface FeedbackReviewProjectionFreshness {
  status: "incomplete" | "fresh" | "stale";
  checkedAt: string;
  backfillComplete: boolean;
  lastSuccessfulAt?: string;
}

export interface FeedbackReviewQueuePage {
  items: FeedbackReviewWorkflowState[];
  range: FeedbackReviewQueueQuery;
  freshness: FeedbackReviewProjectionFreshness;
  nextCursor?: string;
}

export interface FeedbackReviewHistoryPage {
  packetId: string;
  kind: FeedbackReviewKind;
  /** Ascending revision order within this bounded page. */
  events: FeedbackReviewTransitionEvent[];
  nextCursor?: string;
}

export interface FeedbackReviewItemDetail {
  state: FeedbackReviewWorkflowState;
  history: FeedbackReviewHistoryPage;
}

const options = {
  version: FEEDBACK_REVIEW_WORKFLOW_CONTRACT_VERSION,
  piiEnforcement: "strict" as const,
  unknownFields: "reject" as const,
  identity: "exact" as const,
};
const day = 86_400_000;
const retention = (kind: unknown) => (kind === "bug" ? 90 : 395) * day;
const uuid = () => field.string().validator((value) =>
  typeof value === "string" && value.length === 36 && value[14] === "4" &&
  value === value.toLowerCase() && validateUUID(value));
const integer = (min: number, max = Number.MAX_SAFE_INTEGER) =>
  field.number().validator(Number.isSafeInteger).min(min).max(max);
const timestamp = () => field.string().validator((value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
});
const token = (max = 4096) => field.string()
  .validator((value) => typeof value === "string" && value.length <= max &&
    /^[A-Za-z0-9_-]+$/.test(value)).min(1).max(max);
// Embedded projections inherit their enclosing contract version. Do not require
// or accept a second set of caller-controlled type/version fields inside them.
const nestedShape = <T extends SchemaShape>(shape: T) => {
  const { type: _type, version: _version, ...nested } = shape;
  return nested;
};
const outcome = () => field.string().enum(FEEDBACK_REVIEW_OUTCOMES).optional();
const kind = () => field.string().enum(FEEDBACK_REVIEW_KINDS);
const status = () => field.string().enum(FEEDBACK_REVIEW_STATUSES);
const filters = () => ({
  surfaceId: field.string().enum(FEEDBACK_SURFACE_IDS).optional(),
  issueType: field.string().enum(FEEDBACK_PERSISTABLE_ISSUE_TYPES).optional(),
  severity: integer(1, 5).optional(),
  satisfaction: integer(1, 5).optional(),
});
const filterNames = ["surfaceId", "issueType", "severity", "satisfaction"];
const noEmptyOptionals = (
  value: Record<string, unknown>, context: SchemaValidationContext | undefined, names: string[],
) => names.every((name) => !context?.wasProvided(name) || value[name] !== undefined);
const validFilters = (value: Record<string, unknown>, required: boolean) => {
  const bugFields = [value.surfaceId, value.issueType, value.severity];
  return value.kind === "bug"
    ? value.satisfaction === undefined && (!required || bugFields.every((item) => item !== undefined))
    : bugFields.every((item) => item === undefined) && (!required || value.satisfaction !== undefined);
};
const validLifetime = (value: Record<string, unknown>, timeField: string) => {
  const accepted = Date.parse(String(value.acceptedAt));
  const expires = Date.parse(String(value.expiresAt));
  const updated = Date.parse(String(value[timeField]));
  return accepted <= updated && updated < expires && expires - accepted <= retention(value.kind);
};
const validOutcome = (value: Record<string, unknown>, processed: boolean) =>
  processed === (value.outcome !== undefined);
const eventShape = () => ({
  packetId: uuid(), kind: kind(), acceptedAt: timestamp(), expiresAt: timestamp(),
  occurredAt: timestamp(), revision: integer(2),
  action: field.string().enum(FEEDBACK_REVIEW_ACTIONS),
  fromStatus: status(), toStatus: status(), outcome: outcome(),
});
const validEvent = (value: Record<string, unknown>, context?: SchemaValidationContext) => {
  if (!validLifetime(value, "occurredAt") || !noEmptyOptionals(value, context, ["outcome"])) return false;
  const revision = Number(value.revision);
  switch (value.action) {
    case "mark-reviewed":
      return value.fromStatus === "unreviewed" && value.toStatus === "reviewed" && revision === 2 && validOutcome(value, false);
    case "process":
      return value.fromStatus === "reviewed" && value.toStatus === "processed" && revision >= 3 && revision % 2 === 1 && validOutcome(value, true);
    case "reopen":
      return value.fromStatus === "processed" && value.toStatus === "reviewed" && revision >= 4 && revision % 2 === 0 && validOutcome(value, false);
    default:
      return false;
  }
};

/** Minimal filter projection; contains neither a feedback copy nor an actor. */
export const FeedbackReviewWorkflowStateSchema = createSchema({
  packetId: uuid(), kind: kind(), acceptedAt: timestamp(), expiresAt: timestamp(),
  updatedAt: timestamp(), revision: integer(1), status: status(), outcome: outcome(), ...filters(),
}, "feedback-review-workflow-state", {
  ...options,
  schemaValidator: (value, context) => {
    if (!validLifetime(value, "updatedAt") || !validFilters(value, true) ||
      !noEmptyOptionals(value, context, ["outcome", ...filterNames]) ||
      !validOutcome(value, value.status === "processed")) return false;
    if (value.status === "unreviewed") return value.revision === 1 && value.updatedAt === value.acceptedAt;
    return value.status === "reviewed"
      ? value.revision >= 2 && value.revision % 2 === 0
      : value.revision >= 3 && value.revision % 2 === 1;
  },
});

/** Idempotency is a separate bounded transport key, never arbitrary persisted text. */
export const FeedbackReviewTransitionRequestSchema = createSchema({
  action: field.string().enum(FEEDBACK_REVIEW_ACTIONS),
  expectedRevision: integer(1, Number.MAX_SAFE_INTEGER - 1), outcome: outcome(),
}, "feedback-review-transition-request", {
  ...options,
  schemaValidator: (value, context) => noEmptyOptionals(value, context, ["outcome"]) &&
    validOutcome(value, value.action === "process"),
});

export const FeedbackReviewTransitionEventSchema = createSchema(
  eventShape(), "feedback-review-transition-event", { ...options, schemaValidator: validEvent },
);

/** Server-only audit linkage is per operation, not a stable reviewer pseudonym. */
export const FeedbackReviewIdempotencyReceiptSchema = createSchema({
  ...eventShape(), expectedRevision: integer(1, Number.MAX_SAFE_INTEGER - 1),
  operationId: uuid().internal(), auditIntentId: uuid().internal(),
  auditStatus: field.string().enum(["pending", "complete"] as const).internal(),
}, "feedback-review-idempotency-receipt", {
  ...options,
  schemaValidator: (value, context) => validEvent(value, context) && value.revision === value.expectedRevision + 1,
});

/** Encode only trusted SDK continuation data; public cursors require authenticated sealing. */
export const FeedbackReviewProjectionCheckpointSchema = createSchema({
  kind: kind(), revision: integer(1), continuation: token(16_384).internal(),
  backfillComplete: field.boolean(), updatedAt: timestamp(), lastSuccessfulAt: timestamp(),
  leaseEpoch: integer(1).internal(),
}, "feedback-review-projection-checkpoint", {
  ...options,
  schemaValidator: (value) => Date.parse(value.lastSuccessfulAt) <= Date.parse(value.updatedAt),
});

/** Explicit bounded query. The service supplies the default unreviewed-bug 30-day range. */
export const FeedbackReviewQueueQuerySchema = createSchema({
  kind: kind(), status: status().optional(), outcome: outcome(),
  from: timestamp(), to: timestamp(), limit: integer(1, 100),
  ...filters(), cursor: token().optional(),
}, "feedback-review-queue-query", {
  ...options,
  schemaValidator: (value, context) => {
    const duration = Date.parse(value.to) - Date.parse(value.from);
    return duration > 0 && duration <= retention(value.kind) && validFilters(value, false) &&
      noEmptyOptionals(value, context, ["status", "outcome", "cursor", ...filterNames]) &&
      (value.outcome === undefined || value.status === "processed");
  },
});

/** Missing/backfilling projection is never advertised as an empty, complete queue. */
export const FeedbackReviewProjectionFreshnessSchema = createSchema({
  status: field.string().enum(["incomplete", "fresh", "stale"] as const),
  checkedAt: timestamp(), backfillComplete: field.boolean(), lastSuccessfulAt: timestamp().optional(),
}, "feedback-review-projection-freshness", {
  ...options,
  schemaValidator: (value, context) => {
    if (!noEmptyOptionals(value, context, ["lastSuccessfulAt"])) return false;
    const age = value.lastSuccessfulAt === undefined ? Infinity : Date.parse(value.checkedAt) - Date.parse(value.lastSuccessfulAt);
    if (age < 0) return false;
    if (!value.backfillComplete) return value.status === "incomplete";
    return value.status === (age <= 600_000 ? "fresh" : "stale");
  },
});

export const FeedbackReviewQueuePageSchema = createSchema({
  items: field.array(field.object(nestedShape(FeedbackReviewWorkflowStateSchema._shape))).max(100),
  range: field.object(nestedShape(FeedbackReviewQueueQuerySchema._shape)),
  freshness: field.object(nestedShape(FeedbackReviewProjectionFreshnessSchema._shape)),
  nextCursor: token().optional(),
}, "feedback-review-queue-page", {
  ...options,
  schemaValidator: (value, context) => {
    if (!noEmptyOptionals(value, context, ["nextCursor"]) ||
      !FeedbackReviewQueueQuerySchema.validate(value.range).valid ||
      !FeedbackReviewProjectionFreshnessSchema.validate(value.freshness).valid ||
      value.items.length > value.range.limit) return false;
    const ids = new Set<string>();
    return value.items.every((item: FeedbackReviewWorkflowState) => {
      if (!FeedbackReviewWorkflowStateSchema.validate(item).valid || ids.has(item.packetId)) return false;
      ids.add(item.packetId);
      return item.kind === value.range.kind && item.acceptedAt >= value.range.from && item.acceptedAt < value.range.to &&
        ["status", "outcome", ...filterNames].every((name) => value.range[name] === undefined ||
          item[name as keyof FeedbackReviewWorkflowState] === value.range[name]);
    });
  },
});

export const FeedbackReviewHistoryPageSchema = createSchema({
  packetId: uuid(), kind: kind(),
  events: field.array(field.object(nestedShape(FeedbackReviewTransitionEventSchema._shape))).max(25),
  nextCursor: token().optional(),
}, "feedback-review-history-page", {
  ...options,
  schemaValidator: (value, context) => {
    if (!noEmptyOptionals(value, context, ["nextCursor"])) return false;
    let previousRevision = 1;
    let previousTime = "";
    return value.events.every((event: FeedbackReviewTransitionEvent) => {
      const valid = FeedbackReviewTransitionEventSchema.validate(event).valid &&
        event.packetId === value.packetId && event.kind === value.kind &&
        event.revision > previousRevision && event.occurredAt >= previousTime;
      previousRevision = event.revision;
      previousTime = event.occurredAt;
      return valid;
    });
  },
});

/** A bounded view of one packet, without internal receipts or projection metadata. */
export const FeedbackReviewItemDetailSchema = createSchema({
  state: field.object(nestedShape(FeedbackReviewWorkflowStateSchema._shape)),
  history: field.object(nestedShape(FeedbackReviewHistoryPageSchema._shape)),
}, "feedback-review-item-detail", {
  ...options,
  schemaValidator: ({ state, history }) => {
    if (!FeedbackReviewWorkflowStateSchema.validate(state).valid ||
      !FeedbackReviewHistoryPageSchema.validate(history).valid ||
      history.packetId !== state.packetId || history.kind !== state.kind) return false;
    return history.events.every((event: FeedbackReviewTransitionEvent) =>
      event.acceptedAt === state.acceptedAt && event.expiresAt === state.expiresAt &&
      event.revision <= state.revision && event.occurredAt <= state.updatedAt &&
      (event.revision !== state.revision || (
        event.occurredAt === state.updatedAt && event.toStatus === state.status &&
        event.outcome === state.outcome
      )));
  },
});
