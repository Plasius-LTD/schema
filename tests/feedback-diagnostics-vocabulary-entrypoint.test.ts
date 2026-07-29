import { describe, expect, it } from "vitest";
import {
  FEEDBACK_BACKEND_BUCKETS as vocabularyBackends,
  FEEDBACK_GAME_COUNTER_MAX_COUNT as vocabularyCounterMaxCount,
  FEEDBACK_GAME_COUNTER_MAX_ITEMS as vocabularyCounterMaxItems,
  FEEDBACK_GAME_PROVENANCE_CONTRACTS as vocabularyProvenanceContracts,
  FEEDBACK_GAME_SURFACE_IDS as vocabularySurfaceIds,
  type FeedbackGameDiagnostics as VocabularyGameDiagnostics,
} from "../src/feedback-diagnostics-vocabulary.js";
import {
  FEEDBACK_BACKEND_BUCKETS,
  FEEDBACK_GAME_COUNTER_MAX_COUNT,
  FEEDBACK_GAME_COUNTER_MAX_ITEMS,
  FEEDBACK_GAME_PROVENANCE_CONTRACTS,
  FEEDBACK_GAME_SURFACE_IDS,
  type FeedbackGameDiagnostics,
} from "../src/feedback-diagnostics.js";

describe("lightweight feedback-diagnostics vocabulary entrypoint", () => {
  it("re-exports canonical values by identity without the schema builder", () => {
    expect(vocabularyBackends).toBe(FEEDBACK_BACKEND_BUCKETS);
    expect(vocabularyCounterMaxCount).toBe(FEEDBACK_GAME_COUNTER_MAX_COUNT);
    expect(vocabularyCounterMaxItems).toBe(FEEDBACK_GAME_COUNTER_MAX_ITEMS);
    expect(vocabularyProvenanceContracts).toBe(
      FEEDBACK_GAME_PROVENANCE_CONTRACTS,
    );
    expect(vocabularySurfaceIds).toBe(FEEDBACK_GAME_SURFACE_IDS);
  });

  it("preserves the canonical discriminated packet type", () => {
    const value: VocabularyGameDiagnostics = {
      type: "feedback-game-diagnostics",
      version: "1.0.0",
      surfaceId: "site.generator",
      consentConfirmed: true,
      provenanceContractId: "generator.renderer-diagnostics.v1",
      renderer: "canvas2d",
      backend: "browser",
      viewportBucket: "small-landscape",
      frameRateBucket: "30-59",
      frameTimeBucket: "17-33ms",
      featureIds: [],
      counters: [],
      errorCodes: [],
    };
    const canonical: FeedbackGameDiagnostics = value;

    expect(canonical.surfaceId).toBe("site.generator");
  });
});
