import { describe, expect, it } from "vitest";
import {
  FeedbackBugHealthMetricsProjectionSchema,
  FeedbackDraftUpsertRequestSchema,
  FeedbackTransientAnalysisRequestSchema,
} from "../src/index.js";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const MARKER = "synthetic-secret@example.test";
const projection = {
  projectionId: UUID,
  windowStart: "2026-08-27T10:00:00.000Z",
  windowEnd: "2026-08-27T11:00:00.000Z",
  observedAt: "2026-08-27T11:05:00.000Z",
  finalized: true,
  rejectedCount: 0,
  trafficDenominator: 0,
  abuseBlockBands: [],
};

const uuidValidators = [
  ["projection", FeedbackBugHealthMetricsProjectionSchema._shape.projectionId],
  ["draft", FeedbackDraftUpsertRequestSchema._shape.draftId],
  ["correlation", FeedbackTransientAnalysisRequestSchema._shape.requestId],
] as const;

const malformedValues: ReadonlyArray<readonly [string, () => unknown]> = [
  ["symbol", () => Symbol(MARKER)],
  ["boxed UUID", () => Object(UUID)],
  ["boxed number", () => Object(7)],
  ["boxed symbol", () => Object(Symbol(MARKER))],
  ["number", () => 7],
  ["bigint", () => 7n],
  ["boolean", () => true],
  ["null", () => null],
  ["undefined", () => undefined],
  ["array", () => [UUID]],
  ["object", () => ({})],
  ["function", () => () => UUID],
  ["revoked proxy", () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    return proxy;
  }],
];

describe("feedback UUID primitive-string boundary", () => {
  describe.each(uuidValidators)("%s field validator", (_name, field) => {
    it.each(malformedValues)("rejects %s without throwing", (_label, create) => {
      const value = create();
      expect(() => field._validator?.(value as string)).not.toThrow();
      expect(field._validator?.(value as string)).toBe(false);
    });

    it("does not read proxy properties or invoke coercion hooks", () => {
      let reads = 0;
      const coerce = () => {
        reads += 1;
        throw new Error(MARKER);
      };
      for (const value of [
        { [Symbol.toPrimitive]: coerce, toString: coerce, valueOf: coerce },
        new Proxy({}, { get: coerce }),
        Object.assign(() => UUID, { [Symbol.toPrimitive]: coerce }),
      ]) {
        expect(() => field._validator?.(value as unknown as string)).not.toThrow();
        expect(field._validator?.(value as unknown as string)).toBe(false);
      }
      expect(reads).toBe(0);
    });

    it("preserves the canonical lowercase UUIDv4 contract", () => {
      expect(field._validator?.(UUID)).toBe(true);
      for (const value of [UUID.toUpperCase(), UUID.replace("42d3", "12d3"), "", "invalid"]) {
        expect(field._validator?.(value)).toBe(false);
      }
    });
  });

  it.each(malformedValues)("returns closed schema validation for %s", (_label, create) => {
    let result: ReturnType<typeof FeedbackBugHealthMetricsProjectionSchema.validate> | undefined;
    expect(() => {
      result = FeedbackBugHealthMetricsProjectionSchema.validate({
        ...projection,
        projectionId: create(),
      });
    }).not.toThrow();
    expect(result?.valid).toBe(false);
    expect(result?.errors?.length).toBeGreaterThan(0);
    expect(result?.errors?.join(" ")).not.toContain(MARKER);
  });

  it("contains hostile descriptor failures and never coerces a projection ID", () => {
    let coerced = false;
    const coerce = () => {
      coerced = true;
      throw new Error(MARKER);
    };
    const values = [
      { [Symbol.toPrimitive]: coerce, toString: coerce, valueOf: coerce },
      new Proxy({}, {
        get: coerce,
        getPrototypeOf() { throw new Error(MARKER); },
      }),
    ];
    for (const value of values) {
      const result = FeedbackBugHealthMetricsProjectionSchema.validate({
        ...projection,
        projectionId: value,
      });
      expect(result.valid).toBe(false);
      expect(result.errors?.join(" ")).not.toContain(MARKER);
    }
    expect(coerced).toBe(false);
  });

  it("preserves valid projection IDs through the schema boundary", () => {
    const result = FeedbackBugHealthMetricsProjectionSchema.validate(projection);
    expect(result.valid).toBe(true);
    expect(result.value?.projectionId).toBe(UUID);
  });
});
