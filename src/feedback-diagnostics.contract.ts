import { field } from "./field.js";
import { FEEDBACK_CONTRACT_VERSION } from "./feedback-contract-version.js";
import {
  FEEDBACK_BACKEND_BUCKETS,
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
} from "./feedback-diagnostics-vocabulary.js";
import type {
  FeedbackGameDiagnostics,
} from "./feedback-diagnostics-vocabulary.js";
import { createSchema } from "./schema.js";
import type { ValidationIssue } from "./validation.types.js";

export {
  FEEDBACK_BACKEND_BUCKETS,
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
};
export type { FeedbackGameDiagnostics };

const positiveCountField = (maximum: number) =>
  field
    .number()
    .validator((value) => Number.isSafeInteger(value))
    .min(1)
    .max(maximum);

const nestedIdentityShape = () => ({
  type: field.string().enum(["feedback-game-diagnostics"] as const),
  version: field.string().enum([FEEDBACK_CONTRACT_VERSION] as const),
});

const gameCounterShape = () => ({
  code: field.string().enum(FEEDBACK_GAME_COUNTER_CODES),
  count: positiveCountField(FEEDBACK_GAME_COUNTER_MAX_COUNT),
});

export const feedbackGameDiagnosticsShape = (includeIdentity = false) => ({
  ...(includeIdentity ? nestedIdentityShape() : {}),
  surfaceId: field.string().enum(FEEDBACK_GAME_SURFACE_IDS),
  consentConfirmed: field.boolean(),
  provenanceContractId: field
    .string()
    .enum(FEEDBACK_GAME_PROVENANCE_CONTRACT_IDS),
  renderer: field.string().enum(FEEDBACK_RENDERER_BUCKETS),
  backend: field.string().enum(FEEDBACK_BACKEND_BUCKETS),
  viewportBucket: field.string().enum(FEEDBACK_VIEWPORT_BUCKETS),
  frameRateBucket: field.string().enum(FEEDBACK_FRAME_RATE_BUCKETS),
  frameTimeBucket: field.string().enum(FEEDBACK_FRAME_TIME_BUCKETS),
  featureIds: field
    .array(field.string().enum(FEEDBACK_GAME_FEATURE_IDS))
    .max(FEEDBACK_GAME_FEATURE_IDS.length),
  counters: field
    .array(field.object(gameCounterShape()))
    .max(FEEDBACK_GAME_COUNTER_MAX_ITEMS),
  errorCodes: field
    .array(field.string().enum(FEEDBACK_GAME_ERROR_CODES))
    .max(FEEDBACK_GAME_ERROR_CODES.length),
});

export const isFeedbackGameDiagnosticsConsistent = (
  value: Record<string, unknown>,
): boolean => {
  const featureIds = Array.isArray(value.featureIds) ? value.featureIds : [];
  const errorCodes = Array.isArray(value.errorCodes) ? value.errorCodes : [];
  const counters = Array.isArray(value.counters) ? value.counters : [];
  const provenance = FEEDBACK_GAME_PROVENANCE_CONTRACTS.find(
    ({ surfaceId }) => surfaceId === value.surfaceId,
  );
  return (
    value.consentConfirmed === true &&
    provenance !== undefined &&
    provenance.contractId === value.provenanceContractId &&
    new Set(featureIds).size === featureIds.length &&
    new Set(errorCodes).size === errorCodes.length &&
    new Set(
      counters.map((counter) =>
        typeof counter === "object" && counter !== null
          ? (counter as { code?: unknown }).code
          : undefined,
      ),
    ).size === counters.length
  );
};

/** Bucketed, consented renderer diagnostics; it cannot express pixels or DOM. */
export const FeedbackGameDiagnosticsSchema = createSchema(
  feedbackGameDiagnosticsShape(),
  "feedback-game-diagnostics",
  {
    version: FEEDBACK_CONTRACT_VERSION,
    piiEnforcement: "strict",
    unknownFields: "reject",
    identity: "exact",
    schemaValidator: isFeedbackGameDiagnosticsConsistent,
  },
);

export type FeedbackGameDiagnosticsValidationResult =
  | {
      readonly valid: true;
      readonly value: FeedbackGameDiagnostics;
      readonly errors?: never;
      readonly issues?: never;
    }
  | {
      readonly valid: false;
      readonly value?: never;
      readonly errors: readonly string[];
      readonly issues?: readonly ValidationIssue[];
    };

/**
 * Validate and clone diagnostics while preserving the correlated public type.
 *
 * `createSchema` intentionally exposes its generic inferred shape; this
 * domain wrapper is the typed boundary consumers should use.
 */
export const validateFeedbackGameDiagnostics = (
  input: unknown,
): FeedbackGameDiagnosticsValidationResult => {
  const result = FeedbackGameDiagnosticsSchema.validate(input);
  if (!result.valid || result.value === undefined) {
    return {
      valid: false,
      errors: result.errors ?? ["Game diagnostics validation failed."],
      ...(result.issues === undefined ? {} : { issues: result.issues }),
    };
  }
  return {
    valid: true,
    value: result.value as unknown as FeedbackGameDiagnostics,
  };
};
