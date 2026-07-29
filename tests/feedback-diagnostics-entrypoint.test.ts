import { describe, expect, it } from "vitest";
import {
  FEEDBACK_BACKEND_BUCKETS as focusedBackendBuckets,
  FEEDBACK_CONTRACT_VERSION as focusedContractVersion,
  FEEDBACK_FRAME_RATE_BUCKETS as focusedFrameRateBuckets,
  FEEDBACK_FRAME_TIME_BUCKETS as focusedFrameTimeBuckets,
  FEEDBACK_GAME_COUNTER_CODES as focusedCounterCodes,
  FEEDBACK_GAME_COUNTER_MAX_COUNT as focusedCounterMaxCount,
  FEEDBACK_GAME_COUNTER_MAX_ITEMS as focusedCounterMaxItems,
  FEEDBACK_GAME_ERROR_CODES as focusedErrorCodes,
  FEEDBACK_GAME_FEATURE_IDS as focusedFeatureIds,
  FEEDBACK_GAME_PROVENANCE_CONTRACT_IDS as focusedProvenanceContractIds,
  FEEDBACK_GAME_PROVENANCE_CONTRACTS as focusedProvenanceContracts,
  FEEDBACK_GAME_SURFACE_IDS as focusedSurfaceIds,
  FEEDBACK_RENDERER_BUCKETS as focusedRendererBuckets,
  FEEDBACK_VIEWPORT_BUCKETS as focusedViewportBuckets,
  FeedbackGameDiagnosticsSchema as focusedDiagnosticsSchema,
  validateFeedbackGameDiagnostics as focusedValidateDiagnostics,
  type FeedbackGameDiagnostics,
} from "../src/feedback-diagnostics.js";
import {
  FEEDBACK_BACKEND_BUCKETS,
  FEEDBACK_CONTRACT_VERSION,
  FEEDBACK_FRAME_RATE_BUCKETS,
  FEEDBACK_FRAME_TIME_BUCKETS,
  FEEDBACK_GAME_COUNTER_CODES,
  FEEDBACK_GAME_COUNTER_MAX_COUNT,
  FEEDBACK_GAME_COUNTER_MAX_ITEMS,
  FEEDBACK_GAME_ERROR_CODES,
  FEEDBACK_GAME_FEATURE_IDS,
  FEEDBACK_GAME_PROVENANCE_CONTRACT_IDS,
  FEEDBACK_GAME_PROVENANCE_CONTRACTS,
  FEEDBACK_GAME_SURFACE_IDS,
  FEEDBACK_RENDERER_BUCKETS,
  FEEDBACK_VIEWPORT_BUCKETS,
  FeedbackGameDiagnosticsSchema,
  validateFeedbackGameDiagnostics,
} from "../src/feedback.js";

describe("focused feedback-diagnostics entrypoint", () => {
  it("re-exports the canonical vocabulary by identity", () => {
    expect(focusedContractVersion).toBe(FEEDBACK_CONTRACT_VERSION);
    expect(focusedBackendBuckets).toBe(FEEDBACK_BACKEND_BUCKETS);
    expect(focusedFrameRateBuckets).toBe(FEEDBACK_FRAME_RATE_BUCKETS);
    expect(focusedFrameTimeBuckets).toBe(FEEDBACK_FRAME_TIME_BUCKETS);
    expect(focusedCounterCodes).toBe(FEEDBACK_GAME_COUNTER_CODES);
    expect(focusedCounterMaxCount).toBe(FEEDBACK_GAME_COUNTER_MAX_COUNT);
    expect(focusedCounterMaxItems).toBe(FEEDBACK_GAME_COUNTER_MAX_ITEMS);
    expect(focusedErrorCodes).toBe(FEEDBACK_GAME_ERROR_CODES);
    expect(focusedFeatureIds).toBe(FEEDBACK_GAME_FEATURE_IDS);
    expect(focusedProvenanceContractIds).toBe(
      FEEDBACK_GAME_PROVENANCE_CONTRACT_IDS,
    );
    expect(focusedProvenanceContracts).toBe(
      FEEDBACK_GAME_PROVENANCE_CONTRACTS,
    );
    expect(focusedSurfaceIds).toBe(FEEDBACK_GAME_SURFACE_IDS);
    expect(focusedRendererBuckets).toBe(FEEDBACK_RENDERER_BUCKETS);
    expect(focusedViewportBuckets).toBe(FEEDBACK_VIEWPORT_BUCKETS);
    expect(focusedDiagnosticsSchema).toBe(FeedbackGameDiagnosticsSchema);
    expect(focusedValidateDiagnostics).toBe(validateFeedbackGameDiagnostics);
  });

  it("keeps the focused type aligned with canonical validation", () => {
    const value: FeedbackGameDiagnostics = {
      type: "feedback-game-diagnostics",
      version: "1.0.0",
      surfaceId: "site.gpu-demo",
      consentConfirmed: true,
      provenanceContractId: "gpu-demo.renderer-diagnostics.v1",
      renderer: "webgpu",
      backend: "worker",
      viewportBucket: "large-landscape",
      frameRateBucket: "60-plus",
      frameTimeBucket: "under-17ms",
      featureIds: ["renderer.frame-loop"],
      counters: [{ code: "frame-drop", count: 1 }],
      errorCodes: [],
    };

    expect(focusedDiagnosticsSchema.validate(value)).toMatchObject({
      valid: true,
    });
    const result = focusedValidateDiagnostics(value);
    expect(result).toMatchObject({ valid: true, value });

    const sensitiveValue = "synthetic-person@example.test";
    const invalid = focusedValidateDiagnostics({
      ...value,
      provenanceContractId: "generator.renderer-diagnostics.v1",
      renderer: sensitiveValue,
    });
    expect(invalid.valid).toBe(false);
    expect(Object.hasOwn(invalid, "value")).toBe(false);
    expect(JSON.stringify(invalid)).not.toContain(sensitiveValue);
  });
});
