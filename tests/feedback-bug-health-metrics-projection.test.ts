import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  FeedbackBugHealthMetricsProjection,
  FeedbackCountBucket,
} from "../src/index.js";
import {
  FEEDBACK_ABUSE_BLOCK_BANDS,
  FeedbackBugHealthMetricsProjectionSchema,
} from "../src/index.js";

const PROJECTION_ID = "123e4567-e89b-42d3-a456-426614174000";

const projection = {
  projectionId: PROJECTION_ID,
  windowStart: "2026-08-27T10:00:00.000Z",
  windowEnd: "2026-08-27T11:00:00.000Z",
  observedAt: "2026-08-27T11:05:00.000Z",
  finalized: true,
  rejectedCount: 7,
  trafficDenominator: 10_000,
  abuseBlockBands: [
    { id: "five-minutes", count: 3 },
    { id: "fail-closed", count: 2 },
    { id: "edge-blocked", count: 2 },
  ],
} as const;

describe("feedback bug-health metrics projection", () => {
  it("accepts the closed identifier-free exact-hour contract", () => {
    const result = FeedbackBugHealthMetricsProjectionSchema.validate(projection);

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({
      type: "feedback-bug-health-metrics-projection",
      version: "1.0.0",
      ...projection,
    });
    expect(FeedbackBugHealthMetricsProjectionSchema.getPiiAudit()).toEqual([]);
    expectTypeOf(result.value).toMatchTypeOf<
      FeedbackBugHealthMetricsProjection | undefined
    >();
    expectTypeOf(projection.abuseBlockBands).toMatchTypeOf<
      readonly FeedbackCountBucket[]
    >();
  });

  it("round-trips only the immutable safe facts needed by materialization", () => {
    const validated =
      FeedbackBugHealthMetricsProjectionSchema.validate(projection);
    expect(validated.valid).toBe(true);

    const prepared =
      FeedbackBugHealthMetricsProjectionSchema.prepareForStorage(
        validated.value ?? {},
        () => "must-not-encrypt",
        () => "must-not-hash",
      );

    expect(prepared).toEqual(projection);
    expect(
      FeedbackBugHealthMetricsProjectionSchema.validate(prepared).value,
    ).toEqual(validated.value);
  });

  it("exports one frozen abuse-band vocabulary", () => {
    expect(FEEDBACK_ABUSE_BLOCK_BANDS).toEqual([
      "five-minutes",
      "fifteen-minutes",
      "one-hour",
      "six-hours",
      "twenty-four-hours",
      "fail-closed",
      "edge-blocked",
    ]);
    expect(Object.isFrozen(FEEDBACK_ABUSE_BLOCK_BANDS)).toBe(true);
  });

  it.each([
    "reporterId",
    "pseudonym",
    "subjectId",
    "accountId",
    "reservationId",
    "idempotencyKey",
    "requestId",
    "correlationId",
    "ipAddress",
    "userAgent",
    "sessionId",
    "locale",
    "clientTimestamp",
    "route",
    "url",
    "referrer",
    "narrative",
    "ciphertext",
    "pixels",
    "screenshot",
    "blobUrl",
    "blobPath",
    "contentHash",
    "headers",
    "rawTelemetry",
    "log",
  ])("rejects privacy-forbidden projection field %s", (fieldName) => {
    const result = FeedbackBugHealthMetricsProjectionSchema.validate({
      ...projection,
      [fieldName]: "synthetic-secret@example.test",
    });

    expect(result.valid).toBe(false);
    expect(result.errors?.join(" ")).not.toContain(
      "synthetic-secret@example.test",
    );
    expect(result.errors?.join(" ")).not.toContain(fieldName);
  });

  it.each([
    "123E4567-E89B-42D3-A456-426614174000",
    "123e4567-e89b-12d3-a456-426614174000",
    "not-a-projection-id",
  ])("rejects non-canonical projection UUID %s", (projectionId) => {
    expect(
      FeedbackBugHealthMetricsProjectionSchema.validate({
        ...projection,
        projectionId,
      }).valid,
    ).toBe(false);
  });

  it.each([
    ["2026-08-27T10:30:00.000Z", "2026-08-27T11:30:00.000Z"],
    ["2026-08-27T10:00:00Z", "2026-08-27T11:00:00.000Z"],
    ["2026-08-27T10:00:00.000Z", "2026-08-27T10:59:59.999Z"],
    ["2026-08-27T10:00:00.000Z", "2026-08-27T12:00:00.000Z"],
    ["2026-02-29T10:00:00.000Z", "2026-02-29T11:00:00.000Z"],
  ])(
    "rejects a non-canonical exact-hour window %s to %s",
    (windowStart, windowEnd) => {
      expect(
        FeedbackBugHealthMetricsProjectionSchema.validate({
          ...projection,
          windowStart,
          windowEnd,
        }).valid,
      ).toBe(false);
    },
  );

  it("requires finalized facts observed no earlier than the window end", () => {
    expect(
      FeedbackBugHealthMetricsProjectionSchema.validate({
        ...projection,
        finalized: false,
      }).valid,
    ).toBe(false);
    expect(
      FeedbackBugHealthMetricsProjectionSchema.validate({
        ...projection,
        observedAt: "2026-08-27T10:59:59.999Z",
      }).valid,
    ).toBe(false);
  });

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER, Number.NaN, Infinity])(
    "rejects invalid bounded count %s",
    (value) => {
      expect(
        FeedbackBugHealthMetricsProjectionSchema.validate({
          ...projection,
          rejectedCount: value,
        }).valid,
      ).toBe(false);
      expect(
        FeedbackBugHealthMetricsProjectionSchema.validate({
          ...projection,
          trafficDenominator: value,
        }).valid,
      ).toBe(false);
    },
  );

  it("requires unique, non-zero, canonically ordered allowlisted bands", () => {
    for (const abuseBlockBands of [
      [{ id: "unknown", count: 1 }],
      [
        { id: "five-minutes", count: 1 },
        { id: "five-minutes", count: 2 },
      ],
      [{ id: "five-minutes", count: 0 }],
      [
        { id: "edge-blocked", count: 2 },
        { id: "five-minutes", count: 1 },
      ],
    ]) {
      expect(
        FeedbackBugHealthMetricsProjectionSchema.validate({
          ...projection,
          abuseBlockBands,
        }).valid,
      ).toBe(false);
    }
  });

  it("keeps edge/control blocks separate from application rejections", () => {
    expect(
      FeedbackBugHealthMetricsProjectionSchema.validate({
        ...projection,
        rejectedCount: 1,
      }).valid,
    ).toBe(true);
  });

  it("rejects enumerable accessors without evaluating their values", () => {
    let getterWasCalled = false;
    const hostile = { ...projection } as Record<string, unknown>;
    Object.defineProperty(hostile, "rejectedCount", {
      enumerable: true,
      configurable: true,
      get() {
        getterWasCalled = true;
        return 7;
      },
    });

    const result = FeedbackBugHealthMetricsProjectionSchema.validate(hostile);

    expect(result.valid).toBe(false);
    expect(getterWasCalled).toBe(false);
  });

  it("contains proxy failures without reflecting sensitive trap messages", () => {
    const hostile = new Proxy(projection, {
      ownKeys() {
        throw new Error("synthetic-secret@example.test");
      },
    });

    let result:
      | ReturnType<typeof FeedbackBugHealthMetricsProjectionSchema.validate>
      | undefined;
    expect(() => {
      result = FeedbackBugHealthMetricsProjectionSchema.validate(hostile);
    }).not.toThrow();
    expect(result?.valid).toBe(false);
    expect(result?.errors?.join(" ")).not.toContain(
      "synthetic-secret@example.test",
    );
  });

  it("snapshots proxy descriptors without evaluating value traps", () => {
    let getTrapWasCalled = false;
    const hostile = new Proxy(projection, {
      get(_target, property, receiver) {
        getTrapWasCalled = true;
        if (property === "rejectedCount") {
          throw new Error("synthetic-secret@example.test");
        }
        return Reflect.get(projection, property, receiver);
      },
    });

    let result:
      | ReturnType<typeof FeedbackBugHealthMetricsProjectionSchema.validate>
      | undefined;
    expect(() => {
      result = FeedbackBugHealthMetricsProjectionSchema.validate(hostile);
    }).not.toThrow();
    expect(result?.valid).toBe(true);
    expect(getTrapWasCalled).toBe(false);
    expect(result?.errors?.join(" ")).not.toContain(
      "synthetic-secret@example.test",
    );
  });

  it("rejects function-valued fields without invoking coercion hooks", () => {
    const sensitiveMarker = "synthetic-secret@example.test";
    const hostileProjectionId = () => undefined;
    Object.defineProperty(hostileProjectionId, Symbol.toPrimitive, {
      value() {
        throw new Error(sensitiveMarker);
      },
    });
    const hostile = {
      ...projection,
      projectionId: hostileProjectionId,
    };

    let result:
      | ReturnType<typeof FeedbackBugHealthMetricsProjectionSchema.validate>
      | undefined;
    expect(() => {
      result = FeedbackBugHealthMetricsProjectionSchema.validate(hostile);
    }).not.toThrow();
    expect(result?.valid).toBe(false);
    expect(result?.errors?.join(" ")).not.toContain(sensitiveMarker);
  });

  it("rejects excessive proxy keys before inspecting their descriptors", () => {
    let descriptorCallbacks = 0;
    const hostile = new Proxy(Object.create(null) as Record<string, unknown>, {
      ownKeys() {
        return Array.from(
          { length: 20_008 },
          (_, index) => `hostile${index}`,
        );
      },
      getOwnPropertyDescriptor() {
        descriptorCallbacks += 1;
        return {
          value: "synthetic",
          enumerable: true,
          configurable: true,
          writable: true,
        };
      },
    });

    const result = FeedbackBugHealthMetricsProjectionSchema.validate(hostile);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "validation_complexity_limit" }),
    );
    expect(descriptorCallbacks).toBe(0);
  });

  it("rejects enumerable symbol keys and exotic prototypes", () => {
    const withSymbol = { ...projection } as Record<PropertyKey, unknown>;
    withSymbol[Symbol("synthetic-secret@example.test")] = true;
    const withExoticPrototype = Object.assign(
      Object.create({ inherited: "synthetic-secret@example.test" }),
      projection,
    );

    expect(
      FeedbackBugHealthMetricsProjectionSchema.validate(withSymbol).valid,
    ).toBe(false);
    expect(
      FeedbackBugHealthMetricsProjectionSchema.validate(withExoticPrototype)
        .valid,
    ).toBe(false);
  });

  it("does not permit __proto__ input to mutate the snapshot prototype", () => {
    const hostile = { ...projection } as Record<string, unknown>;
    Object.defineProperty(hostile, "__proto__", {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
      writable: true,
    });

    expect(
      FeedbackBugHealthMetricsProjectionSchema.validate(hostile).valid,
    ).toBe(false);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("rejects sparse strict arrays instead of silently compacting holes", () => {
    const sparseBands = new Array(2) as Array<{
      id: "five-minutes";
      count: number;
    }>;
    sparseBands[1] = { id: "five-minutes", count: 1 };

    expect(
      FeedbackBugHealthMetricsProjectionSchema.validate({
        ...projection,
        abuseBlockBands: sparseBands,
      }).valid,
    ).toBe(false);
  });

  it("rejects huge sparse indices at the strict complexity boundary", () => {
    const sparseBands: Array<{ id: "five-minutes"; count: number }> = [];
    sparseBands[100_000] = { id: "five-minutes", count: 1 };

    const result = FeedbackBugHealthMetricsProjectionSchema.validate({
      ...projection,
      abuseBlockBands: sparseBands,
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "validation_complexity_limit" }),
    );
  });
});
