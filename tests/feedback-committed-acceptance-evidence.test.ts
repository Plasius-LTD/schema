import { describe, expect, expectTypeOf, it } from "vitest";
import type { FeedbackCommittedAcceptanceEvidence } from "../src/index.js";
import {
  FeedbackCommittedAcceptanceEvidenceSchema,
} from "../src/index.js";

const PACKET_ID = "123e4567-e89b-42d3-a456-426614174000";
const ACCEPTED_AT = "2026-08-26T04:30:00.000Z";

const evidence = {
  packetId: PACKET_ID,
  packetKind: "bug",
  acceptedAt: ACCEPTED_AT,
} as const;

describe("committed feedback acceptance evidence", () => {
  it("accepts the closed identifier-free evidence contract", () => {
    const result = FeedbackCommittedAcceptanceEvidenceSchema.validate(evidence);

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({
      type: "feedback-committed-acceptance-evidence",
      version: "1.0.0",
      ...evidence,
    });
    expect(FeedbackCommittedAcceptanceEvidenceSchema.getPiiAudit()).toEqual([]);
    expectTypeOf(result.value).toMatchTypeOf<
      FeedbackCommittedAcceptanceEvidence | undefined
    >();
  });

  it.each(["bug", "review"] as const)(
    "round-trips immutable %s evidence without privacy transforms",
    (packetKind) => {
      const validated = FeedbackCommittedAcceptanceEvidenceSchema.validate({
        ...evidence,
        packetKind,
      });
      expect(validated.valid).toBe(true);

      const prepared = FeedbackCommittedAcceptanceEvidenceSchema.prepareForStorage(
        validated.value ?? {},
        () => "must-not-encrypt",
        () => "must-not-hash",
      );

      expect(prepared).toEqual({
        packetId: PACKET_ID,
        packetKind,
        acceptedAt: ACCEPTED_AT,
      });
      expect(
        FeedbackCommittedAcceptanceEvidenceSchema.validate(prepared).value,
      ).toEqual(validated.value);
    },
  );

  it.each([
    "stateId",
    "reservationId",
    "idempotencyKey",
    "attemptId",
    "pseudonym",
    "subjectId",
    "accountId",
    "requestId",
    "ipAddress",
    "userAgent",
    "sessionId",
    "narrative",
    "ciphertext",
    "pixels",
    "blobUrl",
    "blobPath",
    "contentHash",
  ])("rejects privacy-forbidden evidence field %s", (fieldName) => {
    const result = FeedbackCommittedAcceptanceEvidenceSchema.validate({
      ...evidence,
      [fieldName]: "synthetic-sensitive-value",
    });

    expect(result.valid).toBe(false);
    expect(result.errors?.join(" ")).not.toContain("synthetic-sensitive-value");
    expect(result.errors?.join(" ")).not.toContain(fieldName);
  });

  it.each([
    "123E4567-E89B-42D3-A456-426614174000",
    "123e4567-e89b-12d3-a456-426614174000",
    "not-a-packet-id",
  ])("rejects non-canonical packet UUID %s", (packetId) => {
    expect(
      FeedbackCommittedAcceptanceEvidenceSchema.validate({
        ...evidence,
        packetId,
      }).valid,
    ).toBe(false);
  });

  it.each([
    "2026-08-26T04:30:00Z",
    "2026-08-26T05:30:00.000+01:00",
    "2026-08-26t04:30:00.000z",
    "2026-08-26T04:30:00.001Z",
  ])("rejects non-canonical or mismatched acceptance time %s", (acceptedAt) => {
    const candidate = {
      ...evidence,
      acceptedAt,
    };
    const valid =
      FeedbackCommittedAcceptanceEvidenceSchema.validate(candidate).valid;

    expect(valid).toBe(acceptedAt === "2026-08-26T04:30:00.001Z");
  });

  it("rejects unknown packet kinds and caller-supplied identity metadata", () => {
    expect(
      FeedbackCommittedAcceptanceEvidenceSchema.validate({
        ...evidence,
        packetKind: "draft",
      }).valid,
    ).toBe(false);
    expect(
      FeedbackCommittedAcceptanceEvidenceSchema.validate({
        type: "feedback-review-packet",
        version: "1.0.0",
        ...evidence,
      }).valid,
    ).toBe(false);
  });
});
