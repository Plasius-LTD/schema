import { FEEDBACK_CONTRACT_VERSION } from "./feedback-contract-version.js";

export { FEEDBACK_CONTRACT_VERSION };

/** Coarse renderer buckets permitted in privacy-safe game diagnostics. */
export const FEEDBACK_RENDERER_BUCKETS = [
  "webgl2",
  "webgpu",
  "canvas2d",
  "unknown",
] as const;

/** Coarse execution-backend buckets permitted in game diagnostics. */
export const FEEDBACK_BACKEND_BUCKETS = [
  "browser",
  "worker",
  "unknown",
] as const;

/** Renderer surfaces approved to carry diagnostics in the first contract. */
export const FEEDBACK_GAME_SURFACE_IDS = [
  "site.generator",
  "site.gpu-demo",
] as const;

/** Exact renderer-owned provenance contracts for approved game surfaces. */
export const FEEDBACK_GAME_PROVENANCE_CONTRACTS = [
  {
    surfaceId: "site.generator",
    contractId: "generator.renderer-diagnostics.v1",
  },
  {
    surfaceId: "site.gpu-demo",
    contractId: "gpu-demo.renderer-diagnostics.v1",
  },
] as const;

/** Closed provenance identifiers accepted from the browser. */
export const FEEDBACK_GAME_PROVENANCE_CONTRACT_IDS = [
  "generator.renderer-diagnostics.v1",
  "gpu-demo.renderer-diagnostics.v1",
] as const;

/** Closed renderer feature identifiers accepted from the browser. */
export const FEEDBACK_GAME_FEATURE_IDS = [
  "renderer.initialisation",
  "renderer.frame-loop",
  "renderer.asset-loading",
  "renderer.input",
  "renderer.scene-generation",
  "renderer.post-processing",
] as const;

/** Closed renderer counter identifiers accepted from the browser. */
export const FEEDBACK_GAME_COUNTER_CODES = [
  "frame-drop",
  "device-loss",
  "asset-load-failure",
  "shader-failure",
  "fallback-activation",
] as const;

/** Maximum number of distinct coarse counters in one diagnostics packet. */
export const FEEDBACK_GAME_COUNTER_MAX_ITEMS = 32;

/** Maximum value accepted for one coarse diagnostics counter. */
export const FEEDBACK_GAME_COUNTER_MAX_COUNT = 10_000;

/** Closed renderer error identifiers accepted from the browser. */
export const FEEDBACK_GAME_ERROR_CODES = [
  "renderer.initialisation-failed",
  "renderer.device-lost",
  "renderer.asset-load-failed",
  "renderer.frame-budget-exceeded",
  "renderer.shader-failed",
  "renderer.unknown",
] as const;

/** Coarse viewport buckets; exact dimensions are deliberately excluded. */
export const FEEDBACK_VIEWPORT_BUCKETS = [
  "small-portrait",
  "small-landscape",
  "medium-portrait",
  "medium-landscape",
  "large-portrait",
  "large-landscape",
  "unknown",
] as const;

/** Coarse frame-rate buckets permitted in game diagnostics. */
export const FEEDBACK_FRAME_RATE_BUCKETS = [
  "under-15",
  "15-29",
  "30-59",
  "60-plus",
  "unknown",
] as const;

/** Coarse frame-time buckets permitted in game diagnostics. */
export const FEEDBACK_FRAME_TIME_BUCKETS = [
  "under-17ms",
  "17-33ms",
  "34-66ms",
  "over-66ms",
  "unknown",
] as const;

for (const vocabulary of [
  FEEDBACK_RENDERER_BUCKETS,
  FEEDBACK_BACKEND_BUCKETS,
  FEEDBACK_GAME_SURFACE_IDS,
  FEEDBACK_GAME_PROVENANCE_CONTRACTS,
  FEEDBACK_GAME_PROVENANCE_CONTRACT_IDS,
  FEEDBACK_GAME_FEATURE_IDS,
  FEEDBACK_GAME_COUNTER_CODES,
  FEEDBACK_GAME_ERROR_CODES,
  FEEDBACK_VIEWPORT_BUCKETS,
  FEEDBACK_FRAME_RATE_BUCKETS,
  FEEDBACK_FRAME_TIME_BUCKETS,
]) {
  Object.freeze(vocabulary);
}
for (const entry of FEEDBACK_GAME_PROVENANCE_CONTRACTS) {
  Object.freeze(entry);
}

/** Fields shared by every coarse, consented game-diagnostics packet. */
interface FeedbackGameDiagnosticsBase {
  type: "feedback-game-diagnostics";
  version: typeof FEEDBACK_CONTRACT_VERSION;
  consentConfirmed: true;
  renderer: (typeof FEEDBACK_RENDERER_BUCKETS)[number];
  backend: (typeof FEEDBACK_BACKEND_BUCKETS)[number];
  viewportBucket: (typeof FEEDBACK_VIEWPORT_BUCKETS)[number];
  frameRateBucket: (typeof FEEDBACK_FRAME_RATE_BUCKETS)[number];
  frameTimeBucket: (typeof FEEDBACK_FRAME_TIME_BUCKETS)[number];
  featureIds: readonly (typeof FEEDBACK_GAME_FEATURE_IDS)[number][];
  counters: readonly {
    code: (typeof FEEDBACK_GAME_COUNTER_CODES)[number];
    count: number;
  }[];
  errorCodes: readonly (typeof FEEDBACK_GAME_ERROR_CODES)[number][];
}

type FeedbackGameProvenanceContract =
  (typeof FEEDBACK_GAME_PROVENANCE_CONTRACTS)[number];

type FeedbackGameProvenancePair = {
  [SurfaceId in FeedbackGameProvenanceContract["surfaceId"]]: {
    surfaceId: SurfaceId;
    provenanceContractId: Extract<
      FeedbackGameProvenanceContract,
      { surfaceId: SurfaceId }
    >["contractId"];
  };
}[FeedbackGameProvenanceContract["surfaceId"]];

/**
 * Coarse, consented game facts that cannot express captured pixels.
 *
 * The discriminated union prevents a renderer from pairing one approved
 * surface with another surface's provenance contract at compile time.
 */
export type FeedbackGameDiagnostics = FeedbackGameDiagnosticsBase &
  FeedbackGameProvenancePair;
