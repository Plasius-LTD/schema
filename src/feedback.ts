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
  FeedbackGameDiagnosticsSchema,
  feedbackGameDiagnosticsShape as gameDiagnosticsShape,
  isFeedbackGameDiagnosticsConsistent as isGameDiagnosticsConsistent,
  validateFeedbackGameDiagnostics,
} from "./feedback-diagnostics.contract.js";
import type {
  FeedbackGameDiagnostics,
  FeedbackGameDiagnosticsValidationResult,
} from "./feedback-diagnostics.contract.js";
import {
  FEEDBACK_UNICODE_PROFILE_ID,
  containsFeedbackUnicodeProfileUnsupportedText,
} from "./feedback-unicode-profile.js";
import { createSchema } from "./schema.js";
import type { ValidationIssue } from "./validation.types.js";

export { FEEDBACK_CONTRACT_VERSION };
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
  FeedbackGameDiagnosticsSchema,
  validateFeedbackGameDiagnostics,
};
export type {
  FeedbackGameDiagnostics,
  FeedbackGameDiagnosticsValidationResult,
};

/**
 * Canonical Unicode normalization data shared by every v1 narrative
 * processor.
 */
export const FEEDBACK_UNICODE_NORMALIZATION_PROFILE =
  FEEDBACK_UNICODE_PROFILE_ID;

/** Exact progressive bug cooldown ladder, in seconds. */
export const FEEDBACK_BUG_COOLDOWN_SECONDS = Object.freeze([
  5 * 60,
  15 * 60,
  60 * 60,
  6 * 60 * 60,
  24 * 60 * 60,
] as const);

/** Exact post-review suppression period, in seconds. */
export const FEEDBACK_REVIEW_COOLDOWN_SECONDS = 30 * 24 * 60 * 60;

/** Stable issue types accepted by bug-report intake. */
export const FEEDBACK_ISSUE_TYPES = [
  "visual-layout",
  "functionality",
  "gameplay",
  "performance-stability",
  "accessibility",
  "content-localisation",
  "account-access",
  "privacy-security",
  "other",
] as const;

/** Issue types that may be persisted after intake routing. */
export const FEEDBACK_PERSISTABLE_ISSUE_TYPES = FEEDBACK_ISSUE_TYPES.filter(
  (issueType) => issueType !== "privacy-security",
);

/** Stable severity scale and translation keys for accessible star controls. */
export const FEEDBACK_SEVERITY_LEVELS = [
  { value: 1, id: "cosmetic", labelKey: "feedback.severity.cosmetic" },
  { value: 2, id: "minor", labelKey: "feedback.severity.minor" },
  { value: 3, id: "disruptive", labelKey: "feedback.severity.disruptive" },
  { value: 4, id: "blocking", labelKey: "feedback.severity.blocking" },
  { value: 5, id: "critical", labelKey: "feedback.severity.critical" },
] as const;

/** Stable satisfaction scale and translation keys for accessible stars. */
export const FEEDBACK_SATISFACTION_LEVELS = [
  { value: 1, id: "very-poor", labelKey: "feedback.satisfaction.very-poor" },
  { value: 2, id: "poor", labelKey: "feedback.satisfaction.poor" },
  { value: 3, id: "fair", labelKey: "feedback.satisfaction.fair" },
  { value: 4, id: "good", labelKey: "feedback.satisfaction.good" },
  { value: 5, id: "excellent", labelKey: "feedback.satisfaction.excellent" },
] as const;

/** Closed sentiment output from the transient English classifier. */
export const FEEDBACK_SENTIMENT_BUCKETS = [
  "very-negative",
  "negative",
  "mixed",
  "neutral",
  "positive",
  "very-positive",
  "not-detected",
] as const;

/** Closed intent output from the transient classifier. */
export const FEEDBACK_INTENT_IDS = [
  "visual-layout",
  "functionality",
  "gameplay",
  "performance-stability",
  "accessibility",
  "content-localisation",
  "account-access",
  "other",
  "praise",
  "suggestion",
  "confusion",
  "frustration",
] as const;

/** Closed theme output from the transient classifier. */
export const FEEDBACK_THEME_IDS = [
  "navigation",
  "visual-design",
  "game-controls",
  "rendering",
  "responsiveness",
  "stability",
  "accessibility",
  "localisation",
  "account-access",
  "overall-experience",
  "other",
] as const;

/** Closed site-section identifiers; arbitrary routes and URLs are forbidden. */
export const FEEDBACK_SURFACE_IDS = [
  "site.about",
  "admin.analytics",
  "admin.capabilities",
  "admin.feature-flags",
  "admin.feedback",
  "admin.moderation",
  "admin.users",
  "site.chatbot",
  "site.generator",
  "site.gpu-demo",
  "site.home",
  "game.player-system",
  "account.profile",
  "site.video",
] as const;

/** Canonical capability-projection metadata for every feedback surface. */
export const FEEDBACK_SURFACE_DEFINITIONS = [
  {
    id: "site.about",
    labelKey: "feedback.surface.about",
    kind: "public",
    gameDiagnosticsEligible: false,
  },
  {
    id: "admin.analytics",
    labelKey: "feedback.surface.adminAnalytics",
    kind: "admin",
    gameDiagnosticsEligible: false,
  },
  {
    id: "admin.capabilities",
    labelKey: "feedback.surface.adminCapabilities",
    kind: "admin",
    gameDiagnosticsEligible: false,
  },
  {
    id: "admin.feature-flags",
    labelKey: "feedback.surface.adminFeatureFlags",
    kind: "admin",
    gameDiagnosticsEligible: false,
  },
  {
    id: "admin.feedback",
    labelKey: "feedback.surface.adminFeedback",
    kind: "admin",
    gameDiagnosticsEligible: false,
  },
  {
    id: "admin.moderation",
    labelKey: "feedback.surface.adminModeration",
    kind: "admin",
    gameDiagnosticsEligible: false,
  },
  {
    id: "admin.users",
    labelKey: "feedback.surface.adminUsers",
    kind: "admin",
    gameDiagnosticsEligible: false,
  },
  {
    id: "site.chatbot",
    labelKey: "feedback.surface.chatbot",
    kind: "public",
    gameDiagnosticsEligible: false,
  },
  {
    id: "site.generator",
    labelKey: "feedback.surface.generator",
    kind: "game",
    gameDiagnosticsEligible: true,
  },
  {
    id: "site.gpu-demo",
    labelKey: "feedback.surface.gpuDemo",
    kind: "game",
    gameDiagnosticsEligible: true,
  },
  {
    id: "site.home",
    labelKey: "feedback.surface.home",
    kind: "public",
    gameDiagnosticsEligible: false,
  },
  {
    id: "game.player-system",
    labelKey: "feedback.surface.playerSystem",
    kind: "game",
    gameDiagnosticsEligible: false,
  },
  {
    id: "account.profile",
    labelKey: "feedback.surface.profile",
    kind: "authenticated",
    gameDiagnosticsEligible: false,
  },
  {
    id: "site.video",
    labelKey: "feedback.surface.video",
    kind: "public",
    gameDiagnosticsEligible: false,
  },
] as const;

/** Closed reasons for falling back to explicit structured-only submission. */
export const FEEDBACK_STRUCTURED_ONLY_REASON_CODES = [
  "analysis-unavailable",
  "invalid-envelope",
  "invalid-sensitive-payload",
  "language-not-enabled",
  "request-too-large",
  "length-required",
] as const;

/** Pinned privacy policy versions permitted in retained analysis. */
export const FEEDBACK_PRIVACY_POLICY_VERSIONS = [
  "feedback-privacy-en-v1",
] as const;

/** Pinned local model versions permitted in retained analysis. */
export const FEEDBACK_ANALYSIS_MODEL_VERSIONS = [
  "feedback-en-rules-v1",
] as const;

for (const vocabulary of [
  FEEDBACK_BUG_COOLDOWN_SECONDS,
  FEEDBACK_ISSUE_TYPES,
  FEEDBACK_PERSISTABLE_ISSUE_TYPES,
  FEEDBACK_SEVERITY_LEVELS,
  FEEDBACK_SATISFACTION_LEVELS,
  FEEDBACK_SENTIMENT_BUCKETS,
  FEEDBACK_INTENT_IDS,
  FEEDBACK_THEME_IDS,
  FEEDBACK_SURFACE_IDS,
  FEEDBACK_SURFACE_DEFINITIONS,
  FEEDBACK_STRUCTURED_ONLY_REASON_CODES,
  FEEDBACK_PRIVACY_POLICY_VERSIONS,
  FEEDBACK_ANALYSIS_MODEL_VERSIONS,
]) {
  Object.freeze(vocabulary);
}
for (const entry of [
  ...FEEDBACK_SEVERITY_LEVELS,
  ...FEEDBACK_SATISFACTION_LEVELS,
  ...FEEDBACK_SURFACE_DEFINITIONS,
]) {
  Object.freeze(entry);
}

/** Bug issue-type identifier. */
export type FeedbackIssueType = (typeof FEEDBACK_ISSUE_TYPES)[number];

/** Persistable issue type after confidential security routing. */
export type FeedbackPersistableIssueType =
  (typeof FEEDBACK_PERSISTABLE_ISSUE_TYPES)[number];

/** One-to-five bug severity. */
export type FeedbackSeverity =
  (typeof FEEDBACK_SEVERITY_LEVELS)[number]["value"];

/** One-to-five satisfaction score. */
export type FeedbackSatisfaction =
  (typeof FEEDBACK_SATISFACTION_LEVELS)[number]["value"];

/** Closed transient sentiment bucket. */
export type FeedbackSentiment =
  (typeof FEEDBACK_SENTIMENT_BUCKETS)[number];

/** Closed transient intent identifier. */
export type FeedbackIntentId = (typeof FEEDBACK_INTENT_IDS)[number];

/** Closed transient theme identifier. */
export type FeedbackThemeId = (typeof FEEDBACK_THEME_IDS)[number];

/** Closed site-section identifier eligible for capability projection. */
export type FeedbackSurfaceId = (typeof FEEDBACK_SURFACE_IDS)[number];

/** Supported rich-text mark. */
export type FeedbackRichTextMark = "bold" | "italic" | "underline";

/** Text leaf in the transient rich-text AST. */
export interface FeedbackRichTextNode {
  type: "text";
  text: string;
  marks?: readonly FeedbackRichTextMark[];
}

/** Paragraph or bullet-list item in the transient rich-text AST. */
export type FeedbackRichTextBlock =
  | {
      type: "paragraph";
      depth: number;
      children: readonly FeedbackRichTextNode[];
    }
  | {
      type: "listItem";
      listType: "bullet";
      depth: number;
      children: readonly FeedbackRichTextNode[];
    };

/** Browser/scanner interoperable transient document. */
export interface FeedbackRichTextDocument {
  type: "doc";
  schemaVersion: "1";
  children: readonly FeedbackRichTextBlock[];
  version: typeof FEEDBACK_CONTRACT_VERSION;
}

/** Browser/scanner interoperable encrypted narrative envelope. */
export interface FeedbackEncryptedNarrativeEnvelope {
  type: "feedback-encrypted-narrative-envelope";
  version: typeof FEEDBACK_CONTRACT_VERSION;
  schemaVersion: "1";
  keyId: string;
  algorithm: "RSA-OAEP-256+A256GCM";
  wrappedKey: string;
  iv: string;
  ciphertext: string;
  authenticationTag: string;
}

interface FeedbackTransientAnalysisRequestBase {
  type: "feedback-transient-analysis-request";
  version: typeof FEEDBACK_CONTRACT_VERSION;
  schemaVersion: "1";
  requestId: string;
  deterministicRedactionCount: number;
  envelope: FeedbackEncryptedNarrativeEnvelope;
}

/**
 * One-use bug analysis request bound to a closed surface that the service
 * must authorise before handing ciphertext to the private scanner.
 */
export interface FeedbackBugTransientAnalysisRequest
  extends FeedbackTransientAnalysisRequestBase {
  purpose: "bug";
  surfaceId: FeedbackSurfaceId;
}

/** One-use satisfaction-review analysis request with no site surface. */
export interface FeedbackReviewTransientAnalysisRequest
  extends FeedbackTransientAnalysisRequestBase {
  purpose: "review";
  surfaceId?: never;
}

/** Closed purpose-discriminated request that must never be persisted or logged. */
export type FeedbackTransientAnalysisRequest =
  | FeedbackBugTransientAnalysisRequest
  | FeedbackReviewTransientAnalysisRequest;

/** Typed result for the purpose-discriminated transient request validator. */
export type FeedbackTransientAnalysisRequestValidationResult =
  | {
      readonly valid: true;
      readonly value: FeedbackTransientAnalysisRequest;
      readonly errors?: never;
      readonly issues?: never;
    }
  | {
      readonly valid: false;
      readonly value?: never;
      readonly errors: readonly string[];
      readonly issues?: readonly ValidationIssue[];
    };

/** Closed classifier fields that may be persisted. */
export interface FeedbackDerivedAnalysis {
  type: "feedback-derived-analysis";
  version: typeof FEEDBACK_CONTRACT_VERSION;
  status: "analyzed" | "structured-only";
  sentiment?: FeedbackSentiment;
  intentIds: readonly FeedbackIntentId[];
  themeIds: readonly FeedbackThemeId[];
  confidence?: "low" | "medium" | "high";
  policyVersion: string;
  modelVersion: string;
  deterministicRedactionCount: number;
  scannerRedactionCount: number;
}

/** Ephemeral one-use scanner receipt. */
export interface FeedbackAnalysisReceipt
  extends Omit<FeedbackDerivedAnalysis, "type" | "status"> {
  type: "feedback-analysis-receipt";
  status: "analyzed";
  receiptId: string;
  analyzedAt: string;
}

/** Identifier-free immutable bug packet. */
export interface FeedbackBugPacket {
  type: "feedback-bug-packet";
  version: typeof FEEDBACK_CONTRACT_VERSION;
  packetId: string;
  acceptedAt: string;
  surfaceId: string;
  issueType: FeedbackPersistableIssueType;
  severity: FeedbackSeverity;
  releaseId: string;
  buildId: string;
  analysis?: FeedbackDerivedAnalysis;
  gameDiagnostics?: FeedbackGameDiagnostics;
}

/** Identifier-free immutable satisfaction packet. */
export interface FeedbackReviewPacket {
  type: "feedback-review-packet";
  version: typeof FEEDBACK_CONTRACT_VERSION;
  packetId: string;
  acceptedAt: string;
  satisfaction: FeedbackSatisfaction;
  analysis?: FeedbackDerivedAnalysis;
}

/**
 * Durable identifier-free proof that feedback intake committed a packet.
 *
 * This projection is emitted only by the trusted acceptance-evidence worker;
 * the public intake contract never accepts it from a caller.
 */
export interface FeedbackCommittedAcceptanceEvidence {
  type: "feedback-committed-acceptance-evidence";
  version: typeof FEEDBACK_CONTRACT_VERSION;
  packetId: string;
  packetKind: "bug" | "review";
  acceptedAt: string;
}

/** Count bucket used by materialized feedback reports. */
export interface FeedbackCountBucket {
  id: string;
  count: number;
}

/** A weekly public point that reveals nothing when the privacy threshold fails. */
export type FeedbackPublicWeeklyPoint =
  | {
      weekStart: string;
      state: "suppressed";
    }
  | {
      weekStart: string;
      state: "published";
      acceptedReviewCount: number;
      averageStars: number;
    };

/** Thresholded preceding-window facts used to derive the public trend. */
export interface FeedbackPublicComparison {
  previousAcceptedReviewCount: number;
  previousAverageStars: number;
  deltaStars: number;
}

interface FeedbackPublicSummaryBase {
  type: "feedback-public-summary";
  version: typeof FEEDBACK_CONTRACT_VERSION;
  snapshotId: string;
  generatedAt: string;
  asOf: string;
  freshness: "fresh" | "stale";
  reportAgeSeconds: number;
  rollingWindowDays: 90;
  weeklyPoints: readonly FeedbackPublicWeeklyPoint[];
}

/** Daily read model that omits every public metric below ten reviews. */
export type FeedbackPublicSummary =
  | (FeedbackPublicSummaryBase & {
      state: "suppressed";
    })
  | (FeedbackPublicSummaryBase & {
      state: "published";
      acceptedReviewCount: number;
      averageStars: number;
      comparison?: FeedbackPublicComparison;
      trend?: "up" | "flat" | "down";
    });

const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i;
const INGESTION_KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const OPAQUE_UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DISALLOWED_NARRATIVE_SYNTAX_PATTERN =
  /<|>|(?:https?|ftp|mailto|javascript|data|blob|file):|\/\/|www\.|\]\s*\(/i;
const DISALLOWED_UNICODE_FORMAT_PATTERN = /\p{Cf}/u;
const MAX_NARRATIVE_CHARACTERS = 4_000;
const MAX_NARRATIVE_UTF16_CODE_UNITS = 8_000;
const MAX_COUNT = 1_000_000_000;
const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BUG_HOUR_WINDOW_PATTERN =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3])$/;
const REVIEW_DAY_WINDOW_PATTERN =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const RECONCILIATION_WINDOW_PATTERN =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):(?:[0-5]\d)$/;
const CANONICAL_SERVER_UTC_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const strictOptions = {
  version: FEEDBACK_CONTRACT_VERSION,
  piiEnforcement: "strict" as const,
  unknownFields: "reject" as const,
  identity: "exact" as const,
};

const uuidField = () =>
  field
    .string()
    .validator((value) => OPAQUE_UUID_V4_PATTERN.test(value))
    .description("Opaque UUID generated for the feedback workflow");

const isCanonicalServerUtc = (value: unknown): value is string => {
  if (
    typeof value !== "string" ||
    !CANONICAL_SERVER_UTC_PATTERN.test(value)
  ) {
    return false;
  }

  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  );
};

const canonicalServerUtcField = () =>
  field
    .dateTimeISO()
    .validator(isCanonicalServerUtc)
    .description(
      "Canonical millisecond-precision UTC timestamp supplied by the trusted server",
    );

const draftIdField = () =>
  field
    .string()
    .validator((value) => OPAQUE_UUID_V4_PATTERN.test(value))
    .description("Opaque identifier for one short-lived structured draft")
    .PID({
      classification: "low",
      action: "none",
      logHandling: "omit",
      purpose: "short-lived feedback draft lookup that must never enter logs",
    });

const safeIdField = (maximum = 128) =>
  field.string().min(1).max(maximum).pattern(SAFE_ID_PATTERN);

const ingestionKeyIdField = () =>
  field
    .string()
    .min(1)
    .max(80)
    .pattern(INGESTION_KEY_ID_PATTERN);

const decodeCanonicalBase64Url = (value: string): Uint8Array | undefined => {
  if (
    !BASE64URL_PATTERN.test(value) ||
    value.length % 4 === 1
  ) {
    return undefined;
  }
  const finalValue = BASE64URL_ALPHABET.indexOf(value.at(-1) ?? "");
  if (
    finalValue < 0 ||
    (value.length % 4 === 2 && (finalValue & 0b1111) !== 0) ||
    (value.length % 4 === 3 && (finalValue & 0b11) !== 0)
  ) {
    return undefined;
  }

  const output: number[] = [];
  let accumulator = 0;
  let bitCount = 0;
  for (const character of value) {
    const sextet = BASE64URL_ALPHABET.indexOf(character);
    if (sextet < 0) {
      return undefined;
    }
    accumulator = (accumulator << 6) | sextet;
    bitCount += 6;
    while (bitCount >= 8) {
      bitCount -= 8;
      output.push((accumulator >> bitCount) & 0xff);
      accumulator &= (1 << bitCount) - 1;
    }
  }
  return Uint8Array.from(output);
};

const isCanonicalRsaModulus = (value: string): boolean => {
  const bytes = decodeCanonicalBase64Url(value);
  return (
    bytes !== undefined &&
    (bytes.length === 256 ||
      bytes.length === 384 ||
      bytes.length === 512) &&
    (bytes[0] ?? 0) >= 0x80 &&
    ((bytes.at(-1) ?? 0) & 1) === 1
  );
};

const isCanonicalRsaExponent = (value: string): boolean => {
  const bytes = decodeCanonicalBase64Url(value);
  if (
    bytes === undefined ||
    bytes.length < 1 ||
    bytes.length > 4 ||
    bytes[0] === 0
  ) {
    return false;
  }
  const exponent = bytes.reduce(
    (total, byte) => total * 256 + byte,
    0,
  );
  return exponent >= 3 && exponent % 2 === 1;
};

const surfaceIdField = () =>
  field.string().enum(FEEDBACK_SURFACE_IDS);

const countField = () =>
  field
    .number()
    .validator((value) => Number.isSafeInteger(value))
    .min(0)
    .max(MAX_COUNT);

const positiveCountField = (maximum = MAX_COUNT) =>
  field
    .number()
    .validator((value) => Number.isSafeInteger(value))
    .min(1)
    .max(maximum);

const redactionCountField = () =>
  field
    .number()
    .validator((value) => Number.isSafeInteger(value))
    .min(0)
    .max(MAX_NARRATIVE_CHARACTERS);

const revisionField = () =>
  field
    .number()
    .validator((value) => Number.isSafeInteger(value))
    .min(0)
    .max(1_000_000);

const ratingField = () =>
  field
    .number()
    .validator((value) => Number.isInteger(value))
    .min(1)
    .max(5);

const narrativeTextField = () =>
  field
    .string()
    .validator(
      (value) =>
        typeof value === "string" &&
        value.length >= 1 &&
        value.length <= MAX_NARRATIVE_UTF16_CODE_UNITS &&
        !containsFeedbackUnicodeProfileUnsupportedText(value) &&
        value.normalize("NFKC") === value &&
        [...value].length <= MAX_NARRATIVE_CHARACTERS &&
        !DISALLOWED_NARRATIVE_SYNTAX_PATTERN.test(value) &&
        !DISALLOWED_UNICODE_FORMAT_PATTERN.test(value) &&
        ![...value].some((character) => {
          const codePoint = character.codePointAt(0);
          return (
            codePoint !== undefined &&
            (codePoint < 32 || codePoint === 127)
          );
        }),
    )
    .min(1)
    .max(MAX_NARRATIVE_UTF16_CODE_UNITS)
    .PID({
      classification: "high",
      action: "clear",
      logHandling: "omit",
      purpose:
        "transient feedback narrative that must be discarded after classification",
    });

const transientCorrelationIdField = () =>
  field
    .string()
    .validator((value) => OPAQUE_UUID_V4_PATTERN.test(value))
    .PID({
      classification: "low",
      action: "clear",
      logHandling: "omit",
      purpose: "one-use transient feedback correlation",
    });

const transientEncryptedField = (
  minimum: number,
  maximum: number,
  allowedLengths?: readonly number[],
) =>
  field
    .string()
    .min(minimum)
    .max(maximum)
    .pattern(BASE64URL_PATTERN)
    .validator(
      (value) => {
        const decoded = decodeCanonicalBase64Url(value);
        return (
          decoded !== undefined &&
          decoded.length > 0 &&
          (allowedLengths === undefined ||
            allowedLengths.includes(value.length))
        );
      },
    )
    .PID({
      classification: "high",
      action: "clear",
      logHandling: "omit",
      purpose: "encrypted transient feedback narrative material",
    });

const richTextNodeShape = () => ({
  type: field.string().enum(["text"] as const),
  text: narrativeTextField(),
  marks: field
    .array(
      field.string().enum(["bold", "italic", "underline"] as const),
    )
    .max(3)
    .optional(),
});

const richTextBlockShape = () => ({
  type: field.string().enum(["paragraph", "listItem"] as const),
  depth: field
    .number()
    .validator((value) => Number.isInteger(value))
    .min(0)
    .max(4),
  listType: field.string().enum(["bullet"] as const).optional(),
  children: field
    .array(field.object(richTextNodeShape()))
    .min(1)
    .max(128),
});

const nestedIdentityShape = <T extends string>(type: T) => ({
  type: field.string().enum([type] as const),
  version: field.string().enum([FEEDBACK_CONTRACT_VERSION] as const),
});

const envelopeShape = (includeIdentity = false) => ({
  ...(includeIdentity
    ? nestedIdentityShape("feedback-encrypted-narrative-envelope")
    : {}),
  schemaVersion: field.string().enum(["1"] as const),
  keyId: ingestionKeyIdField(),
  algorithm: field
    .string()
    .enum(["RSA-OAEP-256+A256GCM"] as const),
  wrappedKey: transientEncryptedField(342, 683, [342, 512, 683]),
  iv: transientEncryptedField(16, 16, [16]),
  ciphertext: transientEncryptedField(2, 49_152),
  authenticationTag: transientEncryptedField(22, 22, [22]),
});

const analysisProjectionShape = (includeIdentity = false) => ({
  ...(includeIdentity
    ? nestedIdentityShape("feedback-derived-analysis")
    : {}),
  status: field.string().enum(["analyzed", "structured-only"] as const),
  sentiment: field.string().enum(FEEDBACK_SENTIMENT_BUCKETS).optional(),
  intentIds: field
    .array(field.string().enum(FEEDBACK_INTENT_IDS))
    .max(8),
  themeIds: field
    .array(field.string().enum(FEEDBACK_THEME_IDS))
    .max(8),
  confidence: field
    .string()
    .enum(["low", "medium", "high"] as const)
    .optional(),
  policyVersion: field.string().enum(FEEDBACK_PRIVACY_POLICY_VERSIONS),
  modelVersion: field.string().enum(FEEDBACK_ANALYSIS_MODEL_VERSIONS),
  deterministicRedactionCount: redactionCountField(),
  scannerRedactionCount: redactionCountField(),
});

const analysisReceiptShape = () => ({
  receiptId: transientCorrelationIdField(),
  ...analysisProjectionShape(),
  analyzedAt: field.dateTimeISO(),
});

const isAnalysisProjectionConsistent = (
  value: Record<string, unknown>,
): boolean => {
  const status = value.status;
  const intentIds = value.intentIds;
  const themeIds = value.themeIds;
  if (!Array.isArray(intentIds) || !Array.isArray(themeIds)) {
    return false;
  }
  if (
    new Set(intentIds).size !== intentIds.length ||
    new Set(themeIds).size !== themeIds.length
  ) {
    return false;
  }
  if (status === "structured-only") {
    return (
      value.sentiment === undefined &&
      value.confidence === undefined &&
      intentIds.length === 0 &&
      themeIds.length === 0
    );
  }
  return (
    status === "analyzed" &&
    value.sentiment !== undefined &&
    value.confidence !== undefined
  );
};

const optionalDraftFields = () => ({
  surfaceId: surfaceIdField().optional(),
  issueType: field.string().enum(FEEDBACK_ISSUE_TYPES).optional(),
  severity: ratingField().optional(),
  satisfaction: ratingField().optional(),
  analysisReceiptId: transientCorrelationIdField().optional(),
});

const surfaceEntryShape = () => ({
  id: surfaceIdField(),
  labelKey: safeIdField(160),
  kind: field
    .string()
    .enum(["public", "authenticated", "admin", "game"] as const),
  gameDiagnosticsEligible: field.boolean(),
});

const areSurfacesConsistent = (surfaces: unknown): boolean => {
  if (!Array.isArray(surfaces)) {
    return false;
  }
  const surfaceIds = surfaces.map(
    (surface: { id?: unknown }) => surface.id,
  );
  return (
    new Set(surfaceIds).size === surfaceIds.length &&
    surfaces.every(
      (surface: {
        id?: unknown;
        labelKey?: unknown;
        kind?: unknown;
        gameDiagnosticsEligible?: unknown;
      }) => {
        const definition = FEEDBACK_SURFACE_DEFINITIONS.find(
          ({ id }) => id === surface.id,
        );
        return (
          definition !== undefined &&
          surface.labelKey === definition.labelKey &&
          surface.kind === definition.kind &&
          surface.gameDiagnosticsEligible ===
            definition.gameDiagnosticsEligible
        );
      },
    )
  );
};

const isDraftShapeConsistent = (value: Record<string, unknown>): boolean => {
  const hasDirtyField =
    value.surfaceId !== undefined ||
    value.issueType !== undefined ||
    value.severity !== undefined ||
    value.satisfaction !== undefined ||
    value.analysisReceiptId !== undefined ||
    value.analysis !== undefined;
  if (!hasDirtyField) {
    return false;
  }
  if (value.kind === "bug") {
    return value.satisfaction === undefined;
  }
  if (value.kind === "review") {
    return (
      value.surfaceId === undefined &&
      value.issueType === undefined &&
      value.severity === undefined
    );
  }
  return false;
};

const isContextConsistent = (value: Record<string, any>): boolean => {
  if (!areSurfacesConsistent(value.surfaces)) {
    return false;
  }
  if (
    value.selectedSurfaceId !== undefined &&
    !value.surfaces.some(
      (surface: { id?: unknown }) => surface.id === value.selectedSurfaceId,
    )
  ) {
    return false;
  }
  const hasProjectedSurface = value.surfaces.length > 0;
  const hasDiagnosticsSurface = value.surfaces.some(
    (surface: { gameDiagnosticsEligible?: unknown }) =>
      surface.gameDiagnosticsEligible === true,
  );
  if (
    (value.eligibility.bugReport && !hasProjectedSurface) ||
    (value.eligibility.gameDiagnostics &&
      (!value.eligibility.bugReport || !hasDiagnosticsSurface))
  ) {
    return false;
  }

  const generatedAt = Date.parse(String(value.generatedAt));
  if (!Number.isFinite(generatedAt)) {
    return false;
  }
  const boundedFutureAvailabilityIsValid = (
    candidate: unknown,
    maximumSeconds: number,
  ): boolean => {
    if (candidate === undefined) {
      return true;
    }
    const availableAt = Date.parse(String(candidate));
    return (
      Number.isFinite(availableAt) &&
      availableAt > generatedAt &&
      availableAt - generatedAt <= maximumSeconds * 1_000
    );
  };
  const maximumBugCooldownSeconds =
    FEEDBACK_BUG_COOLDOWN_SECONDS[
      FEEDBACK_BUG_COOLDOWN_SECONDS.length - 1
    ] ?? 0;
  if (
    !boundedFutureAvailabilityIsValid(
      value.eligibility.bugAvailableAt,
      maximumBugCooldownSeconds,
    ) ||
    !boundedFutureAvailabilityIsValid(
      value.eligibility.reviewAvailableAt,
      FEEDBACK_REVIEW_COOLDOWN_SECONDS,
    )
  ) {
    return false;
  }
  const bugAvailableAt =
    value.eligibility.bugAvailableAt === undefined
      ? undefined
      : Date.parse(String(value.eligibility.bugAvailableAt));
  const bugRetryAfterSeconds =
    value.eligibility.bugRetryAfterSeconds;
  const bugCooldownIsConsistent =
    (bugAvailableAt === undefined &&
      bugRetryAfterSeconds === undefined) ||
    (bugAvailableAt !== undefined &&
      typeof bugRetryAfterSeconds === "number" &&
      bugRetryAfterSeconds ===
        Math.ceil((bugAvailableAt - generatedAt) / 1_000));
  if (
    !bugCooldownIsConsistent ||
    (value.eligibility.bugReport &&
      (value.eligibility.bugAvailableAt !== undefined ||
        value.eligibility.bugRetryAfterSeconds !== undefined)) ||
    (value.eligibility.review &&
      value.eligibility.reviewAvailableAt !== undefined) ||
    (value.eligibility.bugReport && !value.flags.bugReport) ||
    (value.eligibility.review && !value.flags.review) ||
    (value.eligibility.gameDiagnostics && !value.flags.gameDiagnostics)
  ) {
    return false;
  }

  if (!value.flags.transientAnalysis) {
    return value.ingestionKey === undefined;
  }
  if (value.ingestionKey === undefined) {
    return false;
  }
  const expiresAt = Date.parse(String(value.ingestionKey.expiresAt));
  return (
    Number.isFinite(expiresAt) &&
    expiresAt > generatedAt &&
    expiresAt - generatedAt <= 10 * 60 * 1_000
  );
};

const distributionShape = (
  idField: () => ReturnType<typeof safeIdField> = () => safeIdField(128),
) => ({
  id: idField(),
  count: countField(),
});

const hasUniqueIds = (values: unknown): boolean =>
  Array.isArray(values) &&
  new Set(
    values.map((value) =>
      typeof value === "object" && value !== null
        ? (value as { id?: unknown }).id
        : undefined,
    ),
  ).size === values.length;

const distributionTotal = (values: unknown): number =>
  Array.isArray(values)
    ? values.reduce(
        (total, value) =>
          total +
          (typeof value === "object" &&
          value !== null &&
          typeof (value as { count?: unknown }).count === "number"
            ? (value as { count: number }).count
            : 0),
        0,
      )
    : 0;

const distributionCountsAtMost = (
  values: unknown,
  maximum: number,
): boolean =>
  Array.isArray(values) &&
  values.every(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      typeof (value as { count?: unknown }).count === "number" &&
      (value as { count: number }).count <= maximum,
  );

const advisoryShape = () => ({
  code: field
    .string()
    .enum(
      [
        "severity-five",
        "critical-regression",
        "satisfaction-drop",
        "processor-stale",
      ] as const,
    ),
  level: field.string().enum(["advisory", "critical"] as const),
  triggerCount: positiveCountField(),
  recommendationIds: field
    .array(
      field
        .string()
        .enum(
          [
            "inspect-release",
            "verify-renderer-health",
            "review-top-intents",
            "verify-processor-health",
          ] as const,
        ),
    )
    .min(1)
    .max(8),
});

const orderedWindow = (
  value: Record<string, unknown>,
  durationMilliseconds: number,
): boolean => {
  const start = Date.parse(String(value.windowStart));
  const end = Date.parse(String(value.windowEnd));
  const generatedAt = Date.parse(String(value.generatedAt));
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    Number.isFinite(generatedAt) &&
    new Date(start).toISOString() === value.windowStart &&
    new Date(end).toISOString() === value.windowEnd &&
    start % durationMilliseconds === 0 &&
    end - start === durationMilliseconds &&
    generatedAt >= end
  );
};

type FeedbackProcessor =
  | "bug-hourly"
  | "review-daily"
  | "commit-reconciliation";

const processorWindow = (
  processor: FeedbackProcessor,
  windowKey: string,
): { start: number; duration: number } | undefined => {
  let iso: string;
  let expectedLength: number;
  let duration: number;
  if (processor === "bug-hourly") {
    if (!BUG_HOUR_WINDOW_PATTERN.test(windowKey)) {
      return undefined;
    }
    iso = `${windowKey}:00:00.000Z`;
    expectedLength = 13;
    duration = 60 * 60 * 1_000;
  } else if (processor === "review-daily") {
    if (!REVIEW_DAY_WINDOW_PATTERN.test(windowKey)) {
      return undefined;
    }
    iso = `${windowKey}T00:00:00.000Z`;
    expectedLength = 10;
    duration = 24 * 60 * 60 * 1_000;
  } else {
    if (!RECONCILIATION_WINDOW_PATTERN.test(windowKey)) {
      return undefined;
    }
    const minute = Number(windowKey.slice(-2));
    if (minute % 5 !== 0) {
      return undefined;
    }
    iso = `${windowKey}:00.000Z`;
    expectedLength = 16;
    duration = 5 * 60 * 1_000;
  }
  const start = Date.parse(iso);
  if (
    !Number.isFinite(start) ||
    new Date(start).toISOString().slice(0, expectedLength) !== windowKey
  ) {
    return undefined;
  }
  return { start, duration };
};

const isProcessorArtifactConsistent = (
  value: Record<string, unknown>,
  artifact: "checkpoint" | "manifest",
): boolean => {
  const processor = value.processor as FeedbackProcessor;
  const windowKey = String(value.windowKey);
  const window = processorWindow(processor, windowKey);
  if (window === undefined) {
    return false;
  }
  const completedAt = Date.parse(
    String(
      artifact === "checkpoint" ? value.completedAt : value.generatedAt,
    ),
  );
  if (
    !Number.isFinite(completedAt) ||
    completedAt < window.start + window.duration
  ) {
    return false;
  }
  if (
    artifact === "checkpoint" &&
    value.checkpointId !==
      `checkpoint:${processor}:${windowKey}`
  ) {
    return false;
  }
  return true;
};

const roundRate = (value: number): number =>
  Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

const rateMatches = (actual: unknown, expected: number): boolean =>
  typeof actual === "number" && actual === roundRate(expected);

const distributionCountFor = (values: unknown, id: string): number => {
  if (!Array.isArray(values)) {
    return 0;
  }
  const entry = values.find(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      (value as { id?: unknown }).id === id,
  );
  return typeof entry === "object" &&
    entry !== null &&
    typeof (entry as { count?: unknown }).count === "number"
    ? (entry as { count: number }).count
    : 0;
};

type FeedbackAdvisoryCode =
  | "severity-five"
  | "critical-regression"
  | "satisfaction-drop"
  | "processor-stale";

interface FeedbackAdvisoryExpectation {
  level: "advisory" | "critical";
  triggerCount: number;
  recommendationIds: readonly (
    | "inspect-release"
    | "verify-renderer-health"
    | "review-top-intents"
    | "verify-processor-health"
  )[];
}

const advisoryCodesAreConsistent = (
  advisories: unknown,
  expected: Readonly<
    Partial<Record<FeedbackAdvisoryCode, FeedbackAdvisoryExpectation>>
  >,
): boolean => {
  if (!Array.isArray(advisories)) {
    return false;
  }
  const expectedCodes = Object.entries(expected)
    .filter((entry): entry is [string, FeedbackAdvisoryExpectation] =>
      entry[1] !== undefined,
    )
    .map(([code]) => code);
  const codes = advisories.map(
    (advisory) =>
      (advisory as { code?: unknown } | null)?.code,
  );
  return (
    new Set(codes).size === codes.length &&
    codes.every(
      (code) =>
        typeof code === "string" &&
        expectedCodes.includes(code),
    ) &&
    codes.length === expectedCodes.length &&
    expectedCodes.every((code) => codes.includes(code)) &&
    advisories.every((advisory) => {
      const value = advisory as {
        code?: unknown;
        level?: unknown;
        triggerCount?: unknown;
        recommendationIds?: unknown;
      };
      const code =
        typeof value.code === "string"
          ? (value.code as FeedbackAdvisoryCode)
          : undefined;
      const expectation = code === undefined ? undefined : expected[code];
      if (
        expectation === undefined ||
        value.level !== expectation.level ||
        value.triggerCount !== expectation.triggerCount ||
        !Array.isArray(value.recommendationIds) ||
        value.recommendationIds.length !==
          expectation.recommendationIds.length
      ) {
        return false;
      }
      return value.recommendationIds.every(
        (recommendation, index) =>
          recommendation === expectation.recommendationIds[index],
      );
    })
  );
};

/** AST used only inside the transient no-retention narrative scanner. */
export const FeedbackRichTextAstSchema = createSchema(
  {
    schemaVersion: field.string().enum(["1"] as const),
    children: field
      .array(field.object(richTextBlockShape()))
      .min(1)
      .max(128),
  },
  "doc",
  {
    ...strictOptions,
    schemaValidator: (value) => {
      const blocks = Array.isArray(value.children) ? value.children : [];
      const blocksAreConsistent = blocks.every(
        (block: {
          type?: unknown;
          listType?: unknown;
          children?: Array<{ marks?: unknown }>;
        }) => {
          const listShapeIsValid =
            (block.type === "paragraph" && block.listType === undefined) ||
            (block.type === "listItem" && block.listType === "bullet");
          const marksAreUnique =
            Array.isArray(block.children) &&
            block.children.every(
              (child) =>
                child.marks === undefined ||
                (Array.isArray(child.marks) &&
                  new Set(child.marks).size === child.marks.length),
            );
          return listShapeIsValid && marksAreUnique;
        },
      );
      const characterCount = blocks.reduce(
        (blockTotal: number, block: { children?: unknown }) =>
          blockTotal +
          (Array.isArray(block.children)
            ? block.children.reduce(
                (nodeTotal: number, node: { text?: unknown }) =>
                  nodeTotal +
                  (typeof node.text === "string"
                    ? [...node.text].length
                    : 0),
                0,
              )
            : 0),
        0,
      );
      const extractedCharacterCount =
        characterCount + Math.max(0, blocks.length - 1);
      const nodeCount = blocks.reduce(
        (total: number, block: { children?: unknown }) =>
          total + (Array.isArray(block.children) ? block.children.length : 0),
        0,
      );
      return (
        value.type === "doc" &&
        value.schemaVersion === "1" &&
        blocksAreConsistent &&
        nodeCount <= 256 &&
        extractedCharacterCount > 0 &&
        extractedCharacterCount <= MAX_NARRATIVE_CHARACTERS
      );
    },
  },
);

/** Encrypted outer envelope accepted by privacy-specific middleware. */
export const FeedbackEncryptedNarrativeEnvelopeSchema = createSchema(
  envelopeShape(),
  "feedback-encrypted-narrative-envelope",
  strictOptions,
);

/** Transient scanner request; this contract must never be stored or logged. */
export const FeedbackTransientAnalysisRequestSchema = createSchema(
  {
    schemaVersion: field.string().enum(["1"] as const),
    requestId: transientCorrelationIdField(),
    purpose: field.string().enum(["bug", "review"] as const),
    surfaceId: surfaceIdField().optional(),
    deterministicRedactionCount: redactionCountField(),
    envelope: field.object(envelopeShape(true)),
  },
  "feedback-transient-analysis-request",
  {
    ...strictOptions,
    schemaValidator: (value, context) => {
      const surfaceWasProvided =
        context?.wasProvided("surfaceId") ??
        Object.prototype.hasOwnProperty.call(value, "surfaceId");
      return (
        (value.purpose === "bug" && value.surfaceId !== undefined) ||
        (value.purpose === "review" && !surfaceWasProvided)
      );
    },
  },
);

/**
 * Validate and clone a transient request while preserving its purpose
 * discriminator for TypeScript consumers.
 */
export const validateFeedbackTransientAnalysisRequest = (
  input: unknown,
): FeedbackTransientAnalysisRequestValidationResult => {
  const result = FeedbackTransientAnalysisRequestSchema.validate(input);
  if (!result.valid || result.value === undefined) {
    return {
      valid: false,
      errors: result.errors ?? ["Transient analysis validation failed."],
      ...(result.issues === undefined ? {} : { issues: result.issues }),
    };
  }
  return {
    valid: true,
    value: result.value as unknown as FeedbackTransientAnalysisRequest,
  };
};

/** Identifier-free, closed classifier output safe to copy into a packet. */
export const FeedbackAnalysisReceiptSchema = createSchema(
  analysisReceiptShape(),
  "feedback-analysis-receipt",
  {
    ...strictOptions,
    schemaValidator: (value) =>
      value.status === "analyzed" &&
      isAnalysisProjectionConsistent(value),
  },
);

/**
 * Persistable classifier projection. Unlike the transient receipt it contains
 * no receipt identifier or scanner timestamp that could enable cross-boundary
 * joining.
 */
export const FeedbackDerivedAnalysisSchema = createSchema(
  analysisProjectionShape(),
  "feedback-derived-analysis",
  {
    ...strictOptions,
    schemaValidator: isAnalysisProjectionConsistent,
  },
);

/** Capability-filtered surface catalog with no hidden entitlement metadata. */
export const FeedbackSurfaceCatalogSchema = createSchema(
  {
    generatedAt: field.dateTimeISO(),
    catalogVersion: safeIdField(64),
    surfaces: field
      .array(field.object(surfaceEntryShape()))
      .max(256),
  },
  "feedback-surface-catalog",
  {
    ...strictOptions,
    schemaValidator: (value) => areSurfacesConsistent(value.surfaces),
  },
);

/** Capability-filtered surface catalog and effective feedback eligibility. */
export const FeedbackContextSchema = createSchema(
  {
    generatedAt: field.dateTimeISO(),
    catalogVersion: safeIdField(64),
    surfaces: field
      .array(field.object(surfaceEntryShape()))
      .max(256),
    selectedSurfaceId: surfaceIdField().optional(),
    flags: field.object({
      bugReport: field.boolean(),
      review: field.boolean(),
      transientAnalysis: field.boolean(),
      reporting: field.boolean(),
      admin: field.boolean(),
      mcp: field.boolean(),
      publicHonesty: field.boolean(),
      gameDiagnostics: field.boolean(),
      anonymous: field.boolean(),
    }),
    eligibility: field.object({
      bugReport: field.boolean(),
      review: field.boolean(),
      gameDiagnostics: field.boolean(),
      bugAvailableAt: field.dateTimeISO().optional(),
      reviewAvailableAt: field.dateTimeISO().optional(),
      bugRetryAfterSeconds: positiveCountField().optional(),
    }),
    ingestionKey: field
      .object({
        keyId: ingestionKeyIdField(),
        algorithm: field.string().enum(["RSA-OAEP-256"] as const),
        publicJwk: field.object({
          kty: field.string().enum(["RSA"] as const),
          alg: field.string().enum(["RSA-OAEP-256"] as const),
          use: field.string().enum(["enc"] as const),
          key_ops: field
            .array(field.string().enum(["wrapKey"] as const))
            .min(1)
            .max(1),
          n: field
            .string()
            .min(342)
            .max(683)
            .pattern(BASE64URL_PATTERN)
            .validator(isCanonicalRsaModulus),
          e: field
            .string()
            .min(2)
            .max(6)
            .pattern(BASE64URL_PATTERN)
            .validator(isCanonicalRsaExponent),
          ext: field.boolean().validator((value) => value === true),
        }),
        expiresAt: field.dateTimeISO(),
      })
      .optional(),
  },
  "feedback-context",
  {
    ...strictOptions,
    schemaValidator: isContextConsistent,
  },
);

/** Dirty structured fields sent by focus-loss autosave. */
export const FeedbackDraftUpsertRequestSchema = createSchema(
  {
    draftId: draftIdField(),
    kind: field.string().enum(["bug", "review"] as const),
    revision: revisionField(),
    ...optionalDraftFields(),
  },
  "feedback-draft-upsert-request",
  {
    ...strictOptions,
    schemaValidator: isDraftShapeConsistent,
  },
);

/** Short-lived structured draft packet; narrative and ciphertext are excluded. */
export const FeedbackDraftPacketSchema = createSchema(
  {
    draftId: draftIdField(),
    kind: field.string().enum(["bug", "review"] as const),
    revision: revisionField(),
    surfaceId: surfaceIdField().optional(),
    issueType: field.string().enum(FEEDBACK_ISSUE_TYPES).optional(),
    severity: ratingField().optional(),
    satisfaction: ratingField().optional(),
    analysis: field.object(analysisProjectionShape(true)).optional(),
    serverUpdatedAt: field.dateTimeISO(),
    expiresAt: field.dateTimeISO(),
  },
  "feedback-draft-packet",
  {
    ...strictOptions,
    schemaValidator: (value) => {
      if (!isDraftShapeConsistent(value)) {
        return false;
      }
      if (
        value.analysis !== undefined &&
        !isAnalysisProjectionConsistent(value.analysis)
      ) {
        return false;
      }
      const updatedAt = Date.parse(String(value.serverUpdatedAt));
      const expiresAt = Date.parse(String(value.expiresAt));
      return (
        Number.isFinite(updatedAt) &&
        Number.isFinite(expiresAt) &&
        expiresAt > updatedAt &&
        expiresAt - updatedAt <= 24 * 60 * 60 * 1_000
      );
    },
  },
);

/** ETag-external response after a structured draft is durably saved. */
export const FeedbackDraftReceiptSchema = createSchema(
  {
    draftId: draftIdField(),
    revision: revisionField(),
    savedAt: field.dateTimeISO(),
    expiresAt: field.dateTimeISO(),
  },
  "feedback-draft-receipt",
  {
    ...strictOptions,
    schemaValidator: (value) => {
      const savedAt = Date.parse(String(value.savedAt));
      const expiresAt = Date.parse(String(value.expiresAt));
      return (
        Number.isFinite(savedAt) &&
        Number.isFinite(expiresAt) &&
        expiresAt > savedAt &&
        expiresAt - savedAt <= 24 * 60 * 60 * 1_000
      );
    },
  },
);

/**
 * Explicit final bug submission request. Transport idempotency belongs only
 * in the HTTP Idempotency-Key header and is not part of this JSON contract.
 */
export const FeedbackBugSubmissionRequestSchema = createSchema(
  {
    draftId: draftIdField().optional(),
    surfaceId: surfaceIdField(),
    issueType: field.string().enum(FEEDBACK_ISSUE_TYPES),
    severity: ratingField(),
    analysisReceiptId: transientCorrelationIdField().optional(),
    gameDiagnostics: field.object(gameDiagnosticsShape(true)).optional(),
  },
  "feedback-bug-submission-request",
  {
    ...strictOptions,
    schemaValidator: (value) =>
      value.issueType !== "privacy-security" &&
      (value.gameDiagnostics === undefined ||
        (isGameDiagnosticsConsistent(value.gameDiagnostics) &&
          value.gameDiagnostics.surfaceId === value.surfaceId)),
  },
);

/**
 * Explicit authenticated satisfaction-review submission request. Transport
 * idempotency belongs only in the HTTP Idempotency-Key header.
 */
export const FeedbackReviewSubmissionRequestSchema = createSchema(
  {
    draftId: draftIdField().optional(),
    satisfaction: ratingField(),
    analysisReceiptId: transientCorrelationIdField().optional(),
  },
  "feedback-review-submission-request",
  strictOptions,
);

/** Identifier-free response after an immutable packet is accepted. */
export const FeedbackAcceptanceReceiptSchema = createSchema(
  {
    packetId: uuidField(),
    kind: field.string().enum(["bug", "review"] as const),
    acceptedAt: field.dateTimeISO(),
    nextEligibleAt: field.dateTimeISO(),
  },
  "feedback-acceptance-receipt",
  {
    ...strictOptions,
    schemaValidator: (value) => {
      const acceptedAt = Date.parse(String(value.acceptedAt));
      const nextEligibleAt = Date.parse(String(value.nextEligibleAt));
      const cooldownMilliseconds = nextEligibleAt - acceptedAt;
      if (
        !Number.isFinite(acceptedAt) ||
        !Number.isFinite(nextEligibleAt) ||
        cooldownMilliseconds <= 0 ||
        cooldownMilliseconds % 1_000 !== 0
      ) {
        return false;
      }
      const cooldownSeconds = cooldownMilliseconds / 1_000;
      return value.kind === "review"
        ? cooldownSeconds === FEEDBACK_REVIEW_COOLDOWN_SECONDS
        : (FEEDBACK_BUG_COOLDOWN_SECONDS as readonly number[]).includes(
            cooldownSeconds,
          );
    },
  },
);

/** Safe analysis fallback; it contains neither a receipt nor narrative. */
export const FeedbackStructuredOnlyAnalysisResultSchema = createSchema(
  {
    status: field.string().enum(["structured-only-required"] as const),
    reasonCode: field.string().enum(FEEDBACK_STRUCTURED_ONLY_REASON_CODES),
  },
  "feedback-structured-only-analysis-result",
  strictOptions,
);

/** Immutable structured bug packet for private blob storage. */
export const FeedbackBugPacketSchema = createSchema(
  {
    packetId: uuidField(),
    acceptedAt: field.dateTimeISO(),
    surfaceId: surfaceIdField(),
    issueType: field.string().enum(FEEDBACK_PERSISTABLE_ISSUE_TYPES),
    severity: ratingField(),
    releaseId: safeIdField(128),
    buildId: safeIdField(128),
    analysis: field.object(analysisProjectionShape(true)).optional(),
    gameDiagnostics: field.object(gameDiagnosticsShape(true)).optional(),
  },
  "feedback-bug-packet",
  {
    ...strictOptions,
    schemaValidator: (value) =>
      (value.analysis === undefined ||
        isAnalysisProjectionConsistent(value.analysis)) &&
      (value.gameDiagnostics === undefined ||
        (isGameDiagnosticsConsistent(value.gameDiagnostics) &&
          value.gameDiagnostics.surfaceId === value.surfaceId)),
  },
);

/** Immutable structured review packet for private blob storage. */
export const FeedbackReviewPacketSchema = createSchema(
  {
    packetId: uuidField(),
    acceptedAt: field.dateTimeISO(),
    satisfaction: ratingField(),
    analysis: field.object(analysisProjectionShape(true)).optional(),
  },
  "feedback-review-packet",
  {
    ...strictOptions,
    schemaValidator: (value) =>
      value.analysis === undefined ||
      isAnalysisProjectionConsistent(value.analysis),
  },
);

/**
 * Immutable proof that a structured packet completed the control-plane commit.
 * The schema deliberately excludes correlation, request, locator, and content
 * metadata so report materializers can retain it without retaining an actor.
 */
export const FeedbackCommittedAcceptanceEvidenceSchema = createSchema(
  {
    packetId: uuidField(),
    packetKind: field.string().enum(["bug", "review"] as const),
    acceptedAt: canonicalServerUtcField(),
  },
  "feedback-committed-acceptance-evidence",
  strictOptions,
);

/** Safe facts used to reconstruct a representative in-game view server-side. */
export const FeedbackGameReconstructionManifestSchema = createSchema(
  {
    reconstructionId: uuidField(),
    bugPacketId: uuidField(),
    createdAt: field.dateTimeISO(),
    expiresAt: field.dateTimeISO(),
    curatedAssetSetId: safeIdField(128),
    noticeKey: safeIdField(160),
    diagnostics: field.object(gameDiagnosticsShape(true)),
  },
  "feedback-game-reconstruction-manifest",
  {
    ...strictOptions,
    schemaValidator: (value) => {
      const createdAt = Date.parse(String(value.createdAt));
      const expiresAt = Date.parse(String(value.expiresAt));
      return (
        isGameDiagnosticsConsistent(value.diagnostics) &&
        Number.isFinite(createdAt) &&
        Number.isFinite(expiresAt) &&
        expiresAt > createdAt &&
        expiresAt - createdAt <= 30 * 24 * 60 * 60 * 1_000
      );
    },
  },
);

/** Materialized report for one previous UTC bug-health hour. */
export const FeedbackHourlyBugReportSchema = createSchema(
  {
    reportId: uuidField(),
    windowStart: field.dateTimeISO(),
    windowEnd: field.dateTimeISO(),
    revision: revisionField(),
    generatedAt: field.dateTimeISO(),
    acceptedCount: countField(),
    rejectedCount: countField(),
    diagnosticsAttachedCount: countField(),
    deterministicRedactionCount: countField(),
    scannerRedactionCount: countField(),
    processorLagSeconds: countField(),
    rates: field.object({
      rejectionRate: field.number().min(0).max(1),
      deterministicRedactionsPerAccepted: field.number().min(0).max(4_000),
      scannerRedactionsPerAccepted: field.number().min(0).max(4_000),
    }),
    traffic: field.object({
      denominator: countField(),
      acceptedPerTenThousand: field
        .number()
        .min(0)
        .max(MAX_COUNT)
        .optional(),
    }),
    targetDistribution: field
      .array(field.object(distributionShape(surfaceIdField)))
      .max(256),
    issueTypeDistribution: field
      .array(
        field.object(
          distributionShape(() =>
            field.string().enum(FEEDBACK_PERSISTABLE_ISSUE_TYPES),
          ),
        ),
      )
      .max(FEEDBACK_ISSUE_TYPES.length),
    severityDistribution: field
      .array(
        field.object(
          distributionShape(() =>
            field.string().enum(["1", "2", "3", "4", "5"] as const),
          ),
        ),
      )
      .max(5),
    intentDistribution: field
      .array(
        field.object(
          distributionShape(() =>
            field.string().enum(FEEDBACK_INTENT_IDS),
          ),
        ),
      )
      .max(FEEDBACK_INTENT_IDS.length),
    buildDistribution: field
      .array(field.object(distributionShape()))
      .max(128),
    rendererDistribution: field
      .array(
        field.object(
          distributionShape(() =>
            field.string().enum(FEEDBACK_RENDERER_BUCKETS),
          ),
        ),
      )
      .max(FEEDBACK_RENDERER_BUCKETS.length),
    backendDistribution: field
      .array(
        field.object(
          distributionShape(() =>
            field.string().enum(FEEDBACK_BACKEND_BUCKETS),
          ),
        ),
      )
      .max(FEEDBACK_BACKEND_BUCKETS.length),
    viewportDistribution: field
      .array(
        field.object(
          distributionShape(() =>
            field.string().enum(FEEDBACK_VIEWPORT_BUCKETS),
          ),
        ),
      )
      .max(FEEDBACK_VIEWPORT_BUCKETS.length),
    frameRateDistribution: field
      .array(
        field.object(
          distributionShape(() =>
            field.string().enum(FEEDBACK_FRAME_RATE_BUCKETS),
          ),
        ),
      )
      .max(FEEDBACK_FRAME_RATE_BUCKETS.length),
    frameTimeDistribution: field
      .array(
        field.object(
          distributionShape(() =>
            field.string().enum(FEEDBACK_FRAME_TIME_BUCKETS),
          ),
        ),
      )
      .max(FEEDBACK_FRAME_TIME_BUCKETS.length),
    diagnosticFeatureDistribution: field
      .array(
        field.object(
          distributionShape(() =>
            field.string().enum(FEEDBACK_GAME_FEATURE_IDS),
          ),
        ),
      )
      .max(FEEDBACK_GAME_FEATURE_IDS.length),
    diagnosticCounterDistribution: field
      .array(
        field.object(
          distributionShape(() =>
            field.string().enum(FEEDBACK_GAME_COUNTER_CODES),
          ),
        ),
      )
      .max(FEEDBACK_GAME_COUNTER_CODES.length),
    diagnosticErrorDistribution: field
      .array(
        field.object(
          distributionShape(() =>
            field.string().enum(FEEDBACK_GAME_ERROR_CODES),
          ),
        ),
      )
      .max(FEEDBACK_GAME_ERROR_CODES.length),
    abuseBlockBands: field
      .array(
        field.object(
          distributionShape(() =>
            field
              .string()
              .enum(
                [
                  "five-minutes",
                  "fifteen-minutes",
                  "one-hour",
                  "six-hours",
                  "twenty-four-hours",
                  "fail-closed",
                  "edge-blocked",
                ] as const,
              ),
          ),
        ),
      )
      .max(16),
    comparison: field.object({
      previousHourRatio: field.number().min(0).max(1_000),
      sevenDaySameHourRatio: field.number().min(0).max(1_000),
    }),
    advisories: field.array(field.object(advisoryShape())).max(32),
  },
  "feedback-hourly-bug-report",
  {
    ...strictOptions,
    schemaValidator: (value) => {
      const distributions = [
        value.targetDistribution,
        value.issueTypeDistribution,
        value.severityDistribution,
        value.intentDistribution,
        value.buildDistribution,
        value.rendererDistribution,
        value.backendDistribution,
        value.viewportDistribution,
        value.frameRateDistribution,
        value.frameTimeDistribution,
        value.diagnosticFeatureDistribution,
        value.diagnosticCounterDistribution,
        value.diagnosticErrorDistribution,
        value.abuseBlockBands,
      ];
      const submittedCount = value.acceptedCount + value.rejectedCount;
      const expectedRejectionRate =
        submittedCount === 0 ? 0 : value.rejectedCount / submittedCount;
      const expectedDeterministicRate =
        value.acceptedCount === 0
          ? 0
          : value.deterministicRedactionCount / value.acceptedCount;
      const expectedScannerRate =
        value.acceptedCount === 0
          ? 0
          : value.scannerRedactionCount / value.acceptedCount;
      const trafficIsConsistent =
        (value.traffic.denominator === 0 &&
          value.traffic.acceptedPerTenThousand === undefined) ||
        (value.traffic.denominator > 0 &&
          rateMatches(
            value.traffic.acceptedPerTenThousand,
            (value.acceptedCount * 10_000) / value.traffic.denominator,
          ));
      const severityFiveCount = distributionCountFor(
        value.severityDistribution,
        "5",
      );
      const criticalRegression =
        severityFiveCount >= 3 ||
        (value.acceptedCount >= 5 &&
          value.comparison.sevenDaySameHourRatio >= 3);
      const lagSeconds = Math.floor(
        (Date.parse(String(value.generatedAt)) -
          Date.parse(String(value.windowEnd))) /
          1_000,
      );
      return (
        orderedWindow(value, 60 * 60 * 1_000) &&
        value.revision >= 1 &&
        value.processorLagSeconds === lagSeconds &&
        value.diagnosticsAttachedCount <= value.acceptedCount &&
        (value.acceptedCount > 0 ||
          (value.deterministicRedactionCount === 0 &&
            value.scannerRedactionCount === 0)) &&
        rateMatches(value.rates.rejectionRate, expectedRejectionRate) &&
        rateMatches(
          value.rates.deterministicRedactionsPerAccepted,
          expectedDeterministicRate,
        ) &&
        rateMatches(
          value.rates.scannerRedactionsPerAccepted,
          expectedScannerRate,
        ) &&
        trafficIsConsistent &&
        distributions.every(hasUniqueIds) &&
        advisoryCodesAreConsistent(value.advisories, {
          "severity-five":
            severityFiveCount > 0
              ? {
                  level: "advisory",
                  triggerCount: severityFiveCount,
                  recommendationIds: ["inspect-release"],
                }
              : undefined,
          "critical-regression": criticalRegression
            ? {
                level: "critical",
                triggerCount:
                  severityFiveCount >= 3
                    ? severityFiveCount
                    : value.acceptedCount,
                recommendationIds: [
                  "inspect-release",
                  "verify-renderer-health",
                ],
              }
            : undefined,
          "processor-stale":
            lagSeconds > 10 * 60
              ? {
                  level: "critical",
                  triggerCount: lagSeconds,
                  recommendationIds: ["verify-processor-health"],
                }
              : undefined,
        }) &&
        distributionTotal(value.targetDistribution) === value.acceptedCount &&
        distributionTotal(value.issueTypeDistribution) ===
          value.acceptedCount &&
        distributionTotal(value.severityDistribution) ===
          value.acceptedCount &&
        distributionCountsAtMost(
          value.intentDistribution,
          value.acceptedCount,
        ) &&
        distributionTotal(value.intentDistribution) <=
          value.acceptedCount * 8 &&
        distributionTotal(value.buildDistribution) === value.acceptedCount &&
        distributionTotal(value.rendererDistribution) ===
          value.diagnosticsAttachedCount &&
        distributionTotal(value.backendDistribution) ===
          value.diagnosticsAttachedCount &&
        distributionTotal(value.viewportDistribution) ===
          value.diagnosticsAttachedCount &&
        distributionTotal(value.frameRateDistribution) ===
          value.diagnosticsAttachedCount &&
        distributionTotal(value.frameTimeDistribution) ===
          value.diagnosticsAttachedCount &&
        distributionTotal(value.diagnosticFeatureDistribution) <=
          value.diagnosticsAttachedCount * FEEDBACK_GAME_FEATURE_IDS.length &&
        distributionCountsAtMost(
          value.diagnosticFeatureDistribution,
          value.diagnosticsAttachedCount,
        ) &&
        distributionTotal(value.diagnosticCounterDistribution) <=
          value.diagnosticsAttachedCount *
            FEEDBACK_GAME_COUNTER_CODES.length *
            10_000 &&
        distributionCountsAtMost(
          value.diagnosticCounterDistribution,
          value.diagnosticsAttachedCount * 10_000,
        ) &&
        distributionTotal(value.diagnosticErrorDistribution) <=
          value.diagnosticsAttachedCount *
            FEEDBACK_GAME_ERROR_CODES.length &&
        distributionCountsAtMost(
          value.diagnosticErrorDistribution,
          value.diagnosticsAttachedCount,
        )
      );
    },
  },
);

const rollingSatisfactionShape = () => ({
  period: field.string().enum(["7-days", "30-days", "90-days"] as const),
  reviewCount: countField(),
  meanStars: field.number().min(1).max(5).optional(),
});

const satisfactionStatistics = (
  distribution: unknown,
  total: number,
): { mean: number; median: number } | undefined => {
  if (!Array.isArray(distribution) || total <= 0) {
    return undefined;
  }
  const counts = [1, 2, 3, 4, 5].map((star) =>
    distributionCountFor(distribution, String(star)),
  );
  const weightedTotal = counts.reduce(
    (sum, count, index) => sum + count * (index + 1),
    0,
  );
  const valueAtPosition = (position: number): number => {
    let cumulative = 0;
    for (let index = 0; index < counts.length; index += 1) {
      cumulative += counts[index] ?? 0;
      if (cumulative >= position) {
        return index + 1;
      }
    }
    return 5;
  };
  const lower = valueAtPosition(Math.ceil(total / 2));
  const upper = valueAtPosition(Math.floor(total / 2) + 1);
  return {
    mean: Math.round((weightedTotal / total) * 10) / 10,
    median: (lower + upper) / 2,
  };
};

/** Materialized daily satisfaction report. */
export const FeedbackDailySatisfactionReportSchema = createSchema(
  {
    reportId: uuidField(),
    windowStart: field.dateTimeISO(),
    windowEnd: field.dateTimeISO(),
    revision: revisionField(),
    generatedAt: field.dateTimeISO(),
    processorLagSeconds: countField(),
    acceptedReviewCount: countField(),
    meanStars: field.number().min(1).max(5).optional(),
    medianStars: field.number().min(1).max(5).optional(),
    starDistribution: field
      .array(
        field.object(
          distributionShape(() =>
            field.string().enum(["1", "2", "3", "4", "5"] as const),
          ),
        ),
      )
      .max(5),
    sentimentDistribution: field
      .array(
        field.object(
          distributionShape(() =>
            field.string().enum(FEEDBACK_SENTIMENT_BUCKETS),
          ),
        ),
      )
      .max(FEEDBACK_SENTIMENT_BUCKETS.length),
    intentDistribution: field
      .array(
        field.object(
          distributionShape(() =>
            field.string().enum(FEEDBACK_INTENT_IDS),
          ),
        ),
      )
      .max(FEEDBACK_INTENT_IDS.length),
    rollingWindows: field
      .array(field.object(rollingSatisfactionShape()))
      .max(3),
    previousPeriodDeltaStars: field.number().min(-4).max(4).optional(),
    advisories: field.array(field.object(advisoryShape())).max(32),
  },
  "feedback-daily-satisfaction-report",
  {
    ...strictOptions,
    schemaValidator: (value) => {
      if (!orderedWindow(value, 24 * 60 * 60 * 1_000)) {
        return false;
      }
      if (
        value.acceptedReviewCount === 0 &&
        (value.meanStars !== undefined || value.medianStars !== undefined)
      ) {
        return false;
      }
      if (
        value.acceptedReviewCount > 0 &&
        (value.meanStars === undefined || value.medianStars === undefined)
      ) {
        return false;
      }
      const distributions = [
        value.starDistribution,
        value.sentimentDistribution,
        value.intentDistribution,
      ];
      const periods = value.rollingWindows.map(
        (window: { period: string }) => window.period,
      );
      const sevenDayWindow = value.rollingWindows.find(
        (window: { period: string }) => window.period === "7-days",
      );
      const thirtyDayWindow = value.rollingWindows.find(
        (window: { period: string }) => window.period === "30-days",
      );
      const ninetyDayWindow = value.rollingWindows.find(
        (window: { period: string }) => window.period === "90-days",
      );
      if (
        sevenDayWindow === undefined ||
        thirtyDayWindow === undefined ||
        ninetyDayWindow === undefined
      ) {
        return false;
      }
      const statistics = satisfactionStatistics(
        value.starDistribution,
        value.acceptedReviewCount,
      );
      const lagSeconds = Math.floor(
        (Date.parse(String(value.generatedAt)) -
          Date.parse(String(value.windowEnd))) /
          1_000,
      );
      const satisfactionDrop =
        sevenDayWindow.reviewCount >= 20 &&
        typeof value.previousPeriodDeltaStars === "number" &&
        value.previousPeriodDeltaStars <= -0.3;
      return (
        value.revision >= 1 &&
        value.processorLagSeconds === lagSeconds &&
        distributions.every(hasUniqueIds) &&
        distributionTotal(value.starDistribution) ===
          value.acceptedReviewCount &&
        distributionTotal(value.sentimentDistribution) <=
          value.acceptedReviewCount &&
        distributionCountsAtMost(
          value.sentimentDistribution,
          value.acceptedReviewCount,
        ) &&
        distributionTotal(value.intentDistribution) <=
          value.acceptedReviewCount * 8 &&
        distributionCountsAtMost(
          value.intentDistribution,
          value.acceptedReviewCount,
        ) &&
        periods.length === 3 &&
        new Set(periods).size === 3 &&
        ((statistics === undefined &&
          value.meanStars === undefined &&
          value.medianStars === undefined) ||
          (statistics !== undefined &&
            value.meanStars === statistics.mean &&
            value.medianStars === statistics.median)) &&
        advisoryCodesAreConsistent(value.advisories, {
          "satisfaction-drop": satisfactionDrop
            ? {
                level: "advisory",
                triggerCount: sevenDayWindow.reviewCount,
                recommendationIds: ["review-top-intents"],
              }
            : undefined,
          "processor-stale":
            lagSeconds > 2.5 * 60 * 60
              ? {
                  level: "critical",
                  triggerCount: lagSeconds,
                  recommendationIds: ["verify-processor-health"],
                }
              : undefined,
        }) &&
        value.rollingWindows.every(
          (window: { reviewCount: number; meanStars?: number }) =>
            (window.reviewCount === 0 && window.meanStars === undefined) ||
            (window.reviewCount > 0 && window.meanStars !== undefined),
        ) &&
        value.acceptedReviewCount <= sevenDayWindow.reviewCount &&
        sevenDayWindow.reviewCount <= thirtyDayWindow.reviewCount &&
        thirtyDayWindow.reviewCount <= ninetyDayWindow.reviewCount
      );
    },
  },
);

const publicWeeklyPointShape = () => ({
  weekStart: field.dateTimeISO(),
  state: field.string().enum(["published", "suppressed"] as const),
  acceptedReviewCount: positiveCountField().optional(),
  averageStars: field.number().min(1).max(5).optional(),
});

const publicComparisonShape = () => ({
  previousAcceptedReviewCount: positiveCountField(),
  previousAverageStars: field.number().min(1).max(5),
  deltaStars: field.number().min(-4).max(4),
});

/** Privacy-thresholded public honesty snapshot materialized once per day. */
export const FeedbackPublicSummarySchema = createSchema(
  {
    snapshotId: uuidField(),
    generatedAt: field.dateTimeISO(),
    asOf: field.dateTimeISO(),
    freshness: field.string().enum(["fresh", "stale"] as const),
    reportAgeSeconds: countField(),
    rollingWindowDays: field.number().enum([90] as const),
    state: field.string().enum(["published", "suppressed"] as const),
    acceptedReviewCount: positiveCountField().optional(),
    averageStars: field.number().min(1).max(5).optional(),
    trend: field.string().enum(["up", "flat", "down"] as const).optional(),
    comparison: field.object(publicComparisonShape()).optional(),
    weeklyPoints: field
      .array(field.object(publicWeeklyPointShape()))
      .min(13)
      .max(13),
  },
  "feedback-public-summary",
  {
    ...strictOptions,
    schemaValidator: (value) => {
      const summaryIsSuppressed =
        value.state === "suppressed" &&
        value.acceptedReviewCount === undefined &&
        value.averageStars === undefined &&
        value.trend === undefined &&
        value.comparison === undefined;
      const comparisonDelta =
        value.comparison === undefined
          ? undefined
          : roundRate(
              value.averageStars -
                value.comparison.previousAverageStars,
            );
      const expectedTrend =
        comparisonDelta === undefined
          ? undefined
          : comparisonDelta >= 0.1
            ? "up"
            : comparisonDelta <= -0.1
              ? "down"
              : "flat";
      const comparisonIsConsistent =
        (value.comparison === undefined && value.trend === undefined) ||
        (value.comparison !== undefined &&
          value.comparison.previousAcceptedReviewCount >= 10 &&
          value.comparison.deltaStars === comparisonDelta &&
          value.trend === expectedTrend);
      const summaryIsPublished =
        value.state === "published" &&
        typeof value.acceptedReviewCount === "number" &&
        value.acceptedReviewCount >= 10 &&
        typeof value.averageStars === "number" &&
        comparisonIsConsistent;
      if (!summaryIsSuppressed && !summaryIsPublished) {
        return false;
      }
      const weekStarts = value.weeklyPoints.map(
        (point: { weekStart: string }) => point.weekStart,
      );
      const asOf = Date.parse(String(value.asOf));
      const generatedAt = Date.parse(String(value.generatedAt));
      if (
        !Number.isFinite(asOf) ||
        !Number.isFinite(generatedAt) ||
        new Date(asOf).toISOString() !== value.asOf ||
        new Date(asOf).getUTCHours() !== 0 ||
        new Date(asOf).getUTCMinutes() !== 0 ||
        new Date(asOf).getUTCSeconds() !== 0 ||
        new Date(asOf).getUTCMilliseconds() !== 0 ||
        generatedAt < asOf ||
        value.reportAgeSeconds !== Math.floor((generatedAt - asOf) / 1_000)
      ) {
        return false;
      }
      const daysSinceMonday = (new Date(asOf).getUTCDay() + 6) % 7;
      const lastWeekStart = asOf - daysSinceMonday * 24 * 60 * 60 * 1_000;
      const weeksAreCanonical = weekStarts.every(
        (weekStart: string, index: number) =>
          Date.parse(weekStart) ===
          lastWeekStart - (12 - index) * 7 * 24 * 60 * 60 * 1_000,
      );
      return (
        new Set(weekStarts).size === weekStarts.length &&
        weeksAreCanonical &&
        (value.state !== "suppressed" ||
          value.weeklyPoints.every(
            (point: { state: string }) => point.state === "suppressed",
          )) &&
        value.weeklyPoints.every(
          (point: {
            state: "published" | "suppressed";
            acceptedReviewCount?: number;
            averageStars?: number;
          }) =>
            (point.state === "suppressed" &&
              point.acceptedReviewCount === undefined &&
              point.averageStars === undefined) ||
            (point.state === "published" &&
              typeof point.acceptedReviewCount === "number" &&
              point.acceptedReviewCount >= 10 &&
              typeof point.averageStars === "number" &&
              (value.state !== "published" ||
                point.acceptedReviewCount <= value.acceptedReviewCount)),
        )
      );
    },
  },
);

/** Conditional-write checkpoint for replay-safe timer processors. */
export const FeedbackProcessorCheckpointSchema = createSchema(
  {
    checkpointId: safeIdField(160),
    processor: field
      .string()
      .enum(["bug-hourly", "review-daily", "commit-reconciliation"] as const),
    windowKey: safeIdField(160),
    revision: revisionField(),
    completedAt: field.dateTimeISO(),
    reportId: uuidField().optional(),
  },
  "feedback-processor-checkpoint",
  {
    ...strictOptions,
    schemaValidator: (value) =>
      isProcessorArtifactConsistent(value, "checkpoint") &&
      value.revision >= 1 &&
      ((value.processor === "commit-reconciliation" &&
        value.reportId === undefined) ||
        (value.processor !== "commit-reconciliation" &&
          value.reportId !== undefined)),
  },
);

/** Immutable manifest describing one bounded materialization attempt. */
export const FeedbackMaterializationManifestSchema = createSchema(
  {
    manifestId: uuidField(),
    processor: field
      .string()
      .enum(["bug-hourly", "review-daily", "commit-reconciliation"] as const),
    windowKey: safeIdField(160),
    revision: revisionField(),
    generatedAt: field.dateTimeISO(),
    sourcePacketCount: countField(),
    lateArrivalCount: countField(),
    outputReportId: uuidField().optional(),
    status: field
      .string()
      .enum(["published", "corrected", "no-op"] as const),
  },
  "feedback-materialization-manifest",
  {
    ...strictOptions,
    schemaValidator: (value) => {
      if (
        !isProcessorArtifactConsistent(value, "manifest") ||
        value.lateArrivalCount > value.sourcePacketCount
      ) {
        return false;
      }
      if (value.processor === "commit-reconciliation") {
        return (
          value.status === "no-op" &&
          value.revision >= 1 &&
          value.outputReportId === undefined &&
          value.lateArrivalCount === 0
        );
      }
      return (
        (value.status === "published" &&
          value.revision === 1 &&
          value.lateArrivalCount === 0 &&
          value.outputReportId !== undefined) ||
        (value.status === "corrected" &&
          value.revision >= 2 &&
          value.lateArrivalCount > 0 &&
          value.outputReportId !== undefined)
      );
    },
  },
);
