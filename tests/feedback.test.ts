import { describe, expect, it } from "vitest";
import {
  FeedbackAnalysisReceiptSchema,
  FeedbackAcceptanceReceiptSchema,
  FeedbackBugPacketSchema,
  FeedbackBugSubmissionRequestSchema,
  FeedbackContextSchema,
  FeedbackDailySatisfactionReportSchema,
  FeedbackDerivedAnalysisSchema,
  FeedbackDraftPacketSchema,
  FeedbackDraftReceiptSchema,
  FeedbackDraftUpsertRequestSchema,
  FeedbackEncryptedNarrativeEnvelopeSchema,
  FeedbackGameDiagnosticsSchema,
  FeedbackGameReconstructionManifestSchema,
  FeedbackHourlyBugReportSchema,
  FeedbackMaterializationManifestSchema,
  FeedbackProcessorCheckpointSchema,
  FeedbackPublicSummarySchema,
  FeedbackReviewPacketSchema,
  FeedbackReviewSubmissionRequestSchema,
  FeedbackRichTextAstSchema,
  FeedbackSurfaceCatalogSchema,
  FeedbackStructuredOnlyAnalysisResultSchema,
  FEEDBACK_BUG_COOLDOWN_SECONDS,
  FEEDBACK_PERSISTABLE_ISSUE_TYPES,
  FEEDBACK_REVIEW_COOLDOWN_SECONDS,
  FEEDBACK_SATISFACTION_LEVELS,
  FEEDBACK_SEVERITY_LEVELS,
  FEEDBACK_SURFACE_DEFINITIONS,
  FEEDBACK_UNICODE_NORMALIZATION_PROFILE,
  FeedbackTransientAnalysisRequestSchema,
  SCHEMA_IDENTITY_POLICIES,
  SCHEMA_UNKNOWN_FIELDS_POLICIES,
  createSchema,
  field,
} from "../src/index.js";

const UUID_A = "123e4567-e89b-42d3-a456-426614174000";
const UUID_B = "123e4567-e89b-42d3-a456-426614174001";
const HOUR_START = "2026-07-18T10:00:00.000Z";
const HOUR_END = "2026-07-18T11:00:00.000Z";
const GENERATED_AT = "2026-07-18T11:05:00.000Z";
const HONESTY_AS_OF = "2026-07-18T00:00:00.000Z";
const RSA_MODULUS = `${"_".repeat(341)}w`;

const honestyWeeks = (
  publishedLastWeek?: { count: number; average: number },
) =>
  Array.from({ length: 13 }, (_, index) => {
    const weekStart = new Date(
      Date.parse("2026-04-20T00:00:00.000Z") +
        index * 7 * 24 * 60 * 60 * 1_000,
    ).toISOString();
    if (index === 12 && publishedLastWeek !== undefined) {
      return {
        weekStart,
        state: "published",
        acceptedReviewCount: publishedLastWeek.count,
        averageStars: publishedLastWeek.average,
      };
    }
    return { weekStart, state: "suppressed" };
  });

const derivedFields = {
  status: "analyzed",
  sentiment: "negative",
  intentIds: ["functionality"],
  themeIds: ["navigation"],
  confidence: "high",
  policyVersion: "feedback-privacy-en-v1",
  modelVersion: "feedback-en-rules-v1",
  deterministicRedactionCount: 1,
  scannerRedactionCount: 0,
} as const;

const derivedProjection = {
  type: "feedback-derived-analysis",
  version: "1.0.0",
  ...derivedFields,
} as const;

const derivedAnalysis = {
  type: "feedback-analysis-receipt",
  version: "1.0.0",
  receiptId: UUID_A,
  ...derivedFields,
  analyzedAt: GENERATED_AT,
} as const;

const safeDiagnostics = {
  type: "feedback-game-diagnostics",
  version: "1.0.0",
  surfaceId: "site.generator",
  consentConfirmed: true,
  provenanceContractId: "generator.renderer-diagnostics.v1",
  renderer: "webgl2",
  backend: "browser",
  viewportBucket: "large-landscape",
  frameRateBucket: "30-59",
  frameTimeBucket: "17-33ms",
  featureIds: ["renderer.frame-loop", "renderer.scene-generation"],
  counters: [
    { code: "frame-drop", count: 3 },
    { code: "fallback-activation", count: 1 },
  ],
  errorCodes: ["renderer.device-lost"],
} as const;

const bugPacket = {
  packetId: UUID_A,
  acceptedAt: GENERATED_AT,
  surfaceId: "site.generator",
  issueType: "functionality",
  severity: 3,
  releaseId: "release-2026.07.18",
  buildId: "site-2026.07.18.1",
  analysis: derivedProjection,
  gameDiagnostics: safeDiagnostics,
} as const;

const reviewPacket = {
  packetId: UUID_B,
  acceptedAt: GENERATED_AT,
  satisfaction: 4,
  analysis: {
    ...derivedProjection,
    sentiment: "positive",
    intentIds: ["praise"],
    themeIds: ["overall-experience"],
  },
} as const;

describe("strict schema mode", () => {
  it("publishes the backwards-compatible schema policy order", () => {
    expect(SCHEMA_UNKNOWN_FIELDS_POLICIES).toEqual(["strip", "reject"]);
    expect(SCHEMA_IDENTITY_POLICIES).toEqual(["compatible", "exact"]);
    expect(Object.isFrozen(SCHEMA_UNKNOWN_FIELDS_POLICIES)).toBe(true);
    expect(Object.isFrozen(SCHEMA_IDENTITY_POLICIES)).toBe(true);
    expect(() =>
      (SCHEMA_UNKNOWN_FIELDS_POLICIES as unknown as string[]).push("unsafe"),
    ).toThrow();
  });

  it("runtime-freezes closed feedback vocabularies and definitions", () => {
    expect(Object.isFrozen(FEEDBACK_PERSISTABLE_ISSUE_TYPES)).toBe(true);
    expect(Object.isFrozen(FEEDBACK_SURFACE_DEFINITIONS)).toBe(true);
    expect(
      FEEDBACK_SURFACE_DEFINITIONS.every((entry) =>
        Object.isFrozen(entry),
      ),
    ).toBe(true);
    expect(() =>
      (FEEDBACK_PERSISTABLE_ISSUE_TYPES as unknown as string[]).push(
        "narrative",
      ),
    ).toThrow();
    expect(
      Reflect.set(
        FEEDBACK_SURFACE_DEFINITIONS[0] as unknown as object,
        "kind",
        "admin",
      ),
    ).toBe(false);
  });

  it("preserves historical strip behaviour unless rejection is requested", () => {
    const schema = createSchema(
      { known: field.string() },
      "strip-compatible",
      { version: "1.0.0", piiEnforcement: "strict" },
    );

    const result = schema.validate({
      known: "allowed",
      legacyExtra: "stripped",
    });

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({
      type: "strip-compatible",
      version: "1.0.0",
      known: "allowed",
    });
  });

  it("rejects unknown root and nested fields without reflecting attacker input", () => {
    const unknownRoot = FeedbackBugPacketSchema.validate({
      ...bugPacket,
      forbiddenSyntheticMarker: "never-reflect-this-value",
    });
    const unknownNested = FeedbackBugPacketSchema.validate({
      ...bugPacket,
      analysis: {
        ...derivedProjection,
        arbitraryTrace: "never-reflect-this-value",
      },
    });

    expect(unknownRoot.valid).toBe(false);
    expect(unknownNested.valid).toBe(false);
    expect(unknownRoot.errors?.join(" ")).not.toContain(
      "forbiddenSyntheticMarker",
    );
    expect(unknownRoot.errors?.join(" ")).not.toContain(
      "never-reflect-this-value",
    );
    expect(unknownNested.errors?.join(" ")).not.toContain("arbitraryTrace");
  });

  it("rejects mismatched feedback contract type and version", () => {
    expect(
      FeedbackBugPacketSchema.validate({
        ...bugPacket,
        type: "synthetic-other-contract",
      }).valid,
    ).toBe(false);
    expect(
      FeedbackBugPacketSchema.validate({
        ...bugPacket,
        version: "9.9.9",
      }).valid,
    ).toBe(false);
  });

  it("fails closed before cloning an adversarially complex strict payload", () => {
    const repeatedBlock = {
      type: "paragraph",
      depth: 0,
      children: [{ type: "text", text: "Synthetic text" }],
    };
    const result = FeedbackRichTextAstSchema.validate({
      type: "doc",
      schemaVersion: "1",
      children: Array.from({ length: 10_001 }, () => repeatedBlock),
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "validation_complexity_limit" }),
    );
  });

  it("bounds malformed scalar containers before the recursive clone", () => {
    let malformedScalar: Record<string, unknown> = { leaf: "synthetic" };
    for (let depth = 0; depth < 20_000; depth += 1) {
      malformedScalar = { child: malformedScalar };
    }

    const result = FeedbackBugPacketSchema.validate({
      ...bugPacket,
      surfaceId: malformedScalar,
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "validation_complexity_limit" }),
    );
  });
});

describe("transient narrative contracts", () => {
  it("accepts the allowlisted rich-text AST and strips it at storage preparation", () => {
    const input = {
      type: "doc",
      schemaVersion: "1",
      children: [
        {
          type: "paragraph",
          depth: 0,
          children: [
            {
              type: "text",
              text: "The menu stopped responding.",
              marks: ["bold"],
            },
          ],
        },
        {
          type: "listItem",
          listType: "bullet",
          depth: 1,
          children: [
            {
              type: "text",
              text: "It happened after opening settings.",
            },
          ],
        },
      ],
    };

    const result = FeedbackRichTextAstSchema.validate(input);
    const prepared = FeedbackRichTextAstSchema.prepareForStorage(
      result.value ?? {},
      () => "must-not-encrypt",
      () => "must-not-hash",
    );

    expect(result.valid).toBe(true);
    expect(prepared.children[0].children[0].text).toBeNull();
    expect(FeedbackRichTextAstSchema.getPiiAudit()).toContainEqual(
      expect.objectContaining({
        field: "children[].children[].text",
        classification: "high",
        action: "clear",
        logHandling: "omit",
      }),
    );
  });

  it("rejects HTML, links, excessive text, unsupported formatting, and unknown nodes", () => {
    const ast = (text: string, extra: Record<string, unknown> = {}) => ({
      type: "doc",
      schemaVersion: "1",
      children: [
        {
          type: "paragraph",
          depth: 0,
          children: [{ type: "text", text, ...extra }],
        },
      ],
    });

    expect(
      FeedbackRichTextAstSchema.validate(ast("<strong>unsafe</strong>")).valid,
    ).toBe(false);
    expect(
      FeedbackRichTextAstSchema.validate(ast("https://invalid.example/path"))
        .valid,
    ).toBe(false);
    for (const disallowed of [
      "ftp://invalid.example/path",
      "mailto:someone@example.invalid",
      "javascript:alert(1)",
      "data:text/plain,synthetic",
      "blob:synthetic-object",
      "file:///synthetic/path",
      "//invalid.example/path",
      "[label] (relative-target)",
      "www.example.invalid",
    ]) {
      expect(
        FeedbackRichTextAstSchema.validate(ast(disallowed)).valid,
      ).toBe(false);
    }
    expect(
      FeedbackRichTextAstSchema.validate(ast("x".repeat(4_001))).valid,
    ).toBe(false);
    expect(
      FeedbackRichTextAstSchema.validate(ast("Cafe\u0301")).valid,
    ).toBe(false);
    expect(
      FeedbackRichTextAstSchema.validate(ast("\uff21lice")).valid,
    ).toBe(false);
    expect(FEEDBACK_UNICODE_NORMALIZATION_PROFILE).toBe(
      "unicode-15.1.0-nfkc-v1",
    );
    expect(
      FeedbackRichTextAstSchema.validate(ast("\u1c89ynthetic")).valid,
    ).toBe(false);
    expect(FeedbackRichTextAstSchema.validate(ast("\u1c89")).valid).toBe(
      false,
    );
    expect(
      FeedbackRichTextAstSchema.validate(ast("\ua7f1ynthetic")).valid,
    ).toBe(false);
    expect(FeedbackRichTextAstSchema.validate(ast("\ua7f1")).valid).toBe(
      false,
    );
    for (const postProfileAssignment of [
      0x10940,
      0x11db0,
      0x16ea0,
      0x1e6c0,
      0x323b0,
    ]) {
      expect(
        FeedbackRichTextAstSchema.validate(
          ast(`${String.fromCodePoint(postProfileAssignment)}ynthetic`),
        ).valid,
      ).toBe(false);
    }
    expect(
      FeedbackRichTextAstSchema.validate(ast("Lone\ud800surrogate")).valid,
    ).toBe(false);
    expect(
      FeedbackRichTextAstSchema.validate(ast("Zero\u200bwidth")).valid,
    ).toBe(false);
    expect(FeedbackRichTextAstSchema.validate(ast("Café")).valid).toBe(true);
    expect(
      FeedbackRichTextAstSchema.validate(ast("Plain text", { link: "no" }))
        .valid,
    ).toBe(false);
    const invalidMark = FeedbackRichTextAstSchema.validate(
      ast("Plain text", { marks: ["synthetic-sensitive-value"] }),
    );
    expect(invalidMark.valid).toBe(false);
    expect(invalidMark.errors?.join(" ")).not.toContain(
      "synthetic-sensitive-value",
    );
    expect(
      FeedbackRichTextAstSchema.validate({
        type: "doc",
        schemaVersion: "1",
        children: [
          {
            type: "image",
            depth: 0,
            children: [{ type: "text", text: "No embedded media" }],
          },
        ],
      }).valid,
    ).toBe(false);
  });

  it("enforces Unicode profile assignment before host NFKC", () => {
    const unsupportedText = "\u1c89ynthetic";
    const originalNormalize = String.prototype.normalize;
    let unsupportedTextReachedNormalization = false;

    String.prototype.normalize = function (
      form?: "NFC" | "NFD" | "NFKC" | "NFKD",
    ): string {
      if (String(this) === unsupportedText) {
        unsupportedTextReachedNormalization = true;
        throw new Error("Unsupported text reached host normalization.");
      }
      return originalNormalize.call(this, form);
    };

    try {
      const result = FeedbackRichTextAstSchema.validate({
        type: "doc",
        schemaVersion: "1",
        children: [
          {
            type: "paragraph",
            depth: 0,
            children: [{ type: "text", text: unsupportedText }],
          },
        ],
      });
      expect(result.valid).toBe(false);
      expect(unsupportedTextReachedNormalization).toBe(false);
    } finally {
      String.prototype.normalize = originalNormalize;
    }
  });

  it("rejects oversized text before profile normalization work", () => {
    const oversizedText = "x".repeat(1_000_000);
    const originalNormalize = String.prototype.normalize;
    let oversizedTextReachedNormalization = false;

    String.prototype.normalize = function (
      form?: "NFC" | "NFD" | "NFKC" | "NFKD",
    ): string {
      if (String(this) === oversizedText) {
        oversizedTextReachedNormalization = true;
        throw new Error("Oversized text reached host normalization.");
      }
      return originalNormalize.call(this, form);
    };

    try {
      const result = FeedbackRichTextAstSchema.validate({
        type: "doc",
        schemaVersion: "1",
        children: [
          {
            type: "paragraph",
            depth: 0,
            children: [{ type: "text", text: oversizedText }],
          },
        ],
      });
      expect(result.valid).toBe(false);
      expect(oversizedTextReachedNormalization).toBe(false);
    } finally {
      String.prototype.normalize = originalNormalize;
    }
  });

  it("bounds formatting-node overhead independently of text length", () => {
    const blocks = [100, 100, 57].map((nodeCount) => ({
      type: "paragraph",
      depth: 0,
      children: Array.from({ length: nodeCount }, () => ({
        type: "text",
        text: "x",
      })),
    }));

    expect(
      FeedbackRichTextAstSchema.validate({
        type: "doc",
        schemaVersion: "1",
        children: blocks,
      }).valid,
    ).toBe(false);
  });

  it("counts block separators in the extracted narrative limit", () => {
    const document = (first: string, second: string) => ({
      type: "doc",
      schemaVersion: "1",
      children: [
        {
          type: "paragraph",
          depth: 0,
          children: [{ type: "text", text: first }],
        },
        {
          type: "paragraph",
          depth: 0,
          children: [{ type: "text", text: second }],
        },
      ],
    });

    expect(
      FeedbackRichTextAstSchema.validate(
        document("a".repeat(1_999), "b".repeat(2_000)),
      ).valid,
    ).toBe(true);
    expect(
      FeedbackRichTextAstSchema.validate(
        document("a".repeat(2_000), "b".repeat(2_000)),
      ).valid,
    ).toBe(false);
  });

  it("counts Unicode code points consistently with the private scanner", () => {
    const ast = (text: string) => ({
      type: "doc",
      schemaVersion: "1",
      children: [
        {
          type: "paragraph",
          depth: 0,
          children: [{ type: "text", text }],
        },
      ],
    });

    expect(
      FeedbackRichTextAstSchema.validate(ast("😀".repeat(3_000))).valid,
    ).toBe(true);
    expect(
      FeedbackRichTextAstSchema.validate(ast("😀".repeat(4_001))).valid,
    ).toBe(false);
  });

  it("validates bounded encrypted envelopes without inspecting ciphertext", () => {
    const envelope = {
      schemaVersion: "1",
      keyId: "feedback-ingestion-key-1",
      algorithm: "RSA-OAEP-256+A256GCM",
      wrappedKey: "A".repeat(342),
      iv: "B".repeat(16),
      ciphertext: "C".repeat(512),
      authenticationTag: "A".repeat(22),
    };

    const validatedEnvelope =
      FeedbackEncryptedNarrativeEnvelopeSchema.validate(envelope);
    expect(validatedEnvelope.valid).toBe(true);
    expect(
      FeedbackEncryptedNarrativeEnvelopeSchema.validate({
        ...envelope,
        ciphertext: "C".repeat(65_537),
      }).valid,
    ).toBe(false);
    expect(
      FeedbackEncryptedNarrativeEnvelopeSchema.validate({
        ...envelope,
        wrappedKey: "A".repeat(343),
      }).valid,
    ).toBe(false);
    expect(
      FeedbackEncryptedNarrativeEnvelopeSchema.validate({
        ...envelope,
        ciphertext: "A",
      }).valid,
    ).toBe(false);
    expect(
      FeedbackEncryptedNarrativeEnvelopeSchema.validate({
        ...envelope,
        iv: "***",
      }).valid,
    ).toBe(false);
    expect(
      FeedbackEncryptedNarrativeEnvelopeSchema.validate({
        ...envelope,
        authenticationTag: `${"A".repeat(21)}B`,
      }).valid,
    ).toBe(false);

    const logSafe = FeedbackEncryptedNarrativeEnvelopeSchema.sanitizeForLog(
      envelope,
      () => "must-not-pseudonymize",
    );
    expect(logSafe).toEqual({
      schemaVersion: "1",
      keyId: "feedback-ingestion-key-1",
      algorithm: "RSA-OAEP-256+A256GCM",
    });
    expect(FeedbackEncryptedNarrativeEnvelopeSchema.getPiiAudit()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "ciphertext",
          action: "clear",
          logHandling: "omit",
        }),
        expect.objectContaining({
          field: "wrappedKey",
          action: "clear",
          logHandling: "omit",
        }),
      ]),
    );
  });

  it("keeps narrative only inside the transient analysis request", () => {
    const envelope = FeedbackEncryptedNarrativeEnvelopeSchema.validate({
      schemaVersion: "1",
      keyId: "feedback-ingestion-key-1",
      algorithm: "RSA-OAEP-256+A256GCM",
      wrappedKey: "A".repeat(342),
      iv: "B".repeat(16),
      ciphertext: "C".repeat(512),
      authenticationTag: "A".repeat(22),
    });
    expect(envelope.valid).toBe(true);

    const request = FeedbackTransientAnalysisRequestSchema.validate({
      schemaVersion: "1",
      requestId: UUID_A,
      purpose: "bug",
      deterministicRedactionCount: 1,
      envelope: envelope.value,
    });

    expect(request.valid).toBe(true);
    expect(request.value).toMatchObject({
      type: "feedback-transient-analysis-request",
      version: "1.0.0",
      envelope: {
        type: "feedback-encrypted-narrative-envelope",
        version: "1.0.0",
      },
    });
    expect(FeedbackAnalysisReceiptSchema.validate(derivedAnalysis).valid).toBe(
      true,
    );
    expect(FeedbackDerivedAnalysisSchema.validate(derivedProjection).valid).toBe(
      true,
    );
  });

  it("uses a separate fallback result instead of issuing structured-only receipts", () => {
    expect(
      FeedbackAnalysisReceiptSchema.validate({
        receiptId: UUID_A,
        status: "structured-only",
        intentIds: [],
        themeIds: [],
        policyVersion: "feedback-privacy-en-v1",
        modelVersion: "feedback-en-rules-v1",
        deterministicRedactionCount: 0,
        scannerRedactionCount: 0,
        analyzedAt: GENERATED_AT,
      }).valid,
    ).toBe(false);

    expect(
      FeedbackAnalysisReceiptSchema.validate({
        ...derivedAnalysis,
        status: "structured-only",
      }).valid,
    ).toBe(false);
  });

  it("rejects duplicate closed classifier outputs", () => {
    expect(
      FeedbackDerivedAnalysisSchema.validate({
        ...derivedProjection,
        intentIds: ["functionality", "functionality"],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackDerivedAnalysisSchema.validate({
        ...derivedProjection,
        themeIds: ["navigation", "navigation"],
      }).valid,
    ).toBe(false);
  });
});

describe("feedback context and intake contracts", () => {
  it("publishes stable accessible star-rating scales", () => {
    expect(FEEDBACK_SEVERITY_LEVELS.map(({ value, id }) => [value, id])).toEqual(
      [
        [1, "cosmetic"],
        [2, "minor"],
        [3, "disruptive"],
        [4, "blocking"],
        [5, "critical"],
      ],
    );
    expect(
      FEEDBACK_SATISFACTION_LEVELS.map(({ value, id }) => [value, id]),
    ).toEqual([
      [1, "very-poor"],
      [2, "poor"],
      [3, "fair"],
      [4, "good"],
      [5, "excellent"],
    ]);
    expect(FEEDBACK_BUG_COOLDOWN_SECONDS).toEqual([
      300,
      900,
      3_600,
      21_600,
      86_400,
    ]);
    expect(Object.isFrozen(FEEDBACK_BUG_COOLDOWN_SECONDS)).toBe(true);
    expect(FEEDBACK_REVIEW_COOLDOWN_SECONDS).toBe(2_592_000);
  });

  it("validates a capability-projected context without exposing capabilities", () => {
    const result = FeedbackContextSchema.validate({
      generatedAt: GENERATED_AT,
      catalogVersion: "2026-07-18",
      surfaces: [
        {
          id: "site.generator",
          labelKey: "feedback.surface.generator",
          kind: "game",
          gameDiagnosticsEligible: true,
        },
        {
          id: "site.home",
          labelKey: "feedback.surface.home",
          kind: "public",
          gameDiagnosticsEligible: false,
        },
      ],
      selectedSurfaceId: "site.home",
      flags: {
        bugReport: true,
        review: true,
        transientAnalysis: true,
        reporting: false,
        admin: false,
        mcp: false,
        publicHonesty: false,
        gameDiagnostics: true,
        anonymous: false,
      },
      eligibility: {
        bugReport: true,
        review: false,
        gameDiagnostics: true,
        reviewAvailableAt: "2026-08-17T11:05:00.000Z",
      },
      ingestionKey: {
        keyId: "feedback-ingestion-key-1",
        algorithm: "RSA-OAEP-256",
        publicJwk: {
          kty: "RSA",
          alg: "RSA-OAEP-256",
          use: "enc",
          key_ops: ["wrapKey"],
          n: RSA_MODULUS,
          e: "AQAB",
          ext: true,
        },
        expiresAt: "2026-07-18T11:10:00.000Z",
      },
    });

    expect(result.valid).toBe(true);
    expect(result.value).not.toHaveProperty("capabilities");
    expect(
      FeedbackSurfaceCatalogSchema.validate({
        generatedAt: GENERATED_AT,
        catalogVersion: "2026-07-18",
        surfaces: result.value?.surfaces,
      }).valid,
    ).toBe(true);
    expect(
      FeedbackContextSchema.validate({
        ...result.value,
        ingestionKey: {
          ...result.value?.ingestionKey,
          expiresAt: "2026-07-18T12:05:00.000Z",
        },
      }).valid,
    ).toBe(false);
    expect(
      FeedbackContextSchema.validate({
        ...result.value,
        selectedSurfaceId: "admin.users",
      }).valid,
    ).toBe(false);
    for (const publicJwk of [
      { ...result.value?.ingestionKey?.publicJwk, e: "AAAAA" },
      { ...result.value?.ingestionKey?.publicJwk, e: "AAAB" },
      { ...result.value?.ingestionKey?.publicJwk, n: "A".repeat(342) },
      { ...result.value?.ingestionKey?.publicJwk, ext: false },
    ]) {
      expect(
        FeedbackContextSchema.validate({
          ...result.value,
          ingestionKey: {
            ...result.value?.ingestionKey,
            publicJwk,
          },
        }).valid,
      ).toBe(false);
    }
    for (const keyId of ["feedback:key", "_feedback-key", ".feedback-key"]) {
      expect(
        FeedbackContextSchema.validate({
          ...result.value,
          ingestionKey: {
            ...result.value?.ingestionKey,
            keyId,
          },
        }).valid,
      ).toBe(false);
    }

    const cooldownContext = {
      ...result.value,
      eligibility: {
        ...result.value?.eligibility,
        bugReport: false,
        gameDiagnostics: false,
        bugAvailableAt: "2026-07-18T11:10:00.000Z",
        bugRetryAfterSeconds: 300,
      },
    };
    expect(FeedbackContextSchema.validate(cooldownContext).valid).toBe(true);
    expect(
      FeedbackContextSchema.validate({
        ...cooldownContext,
        eligibility: {
          ...cooldownContext.eligibility,
          bugRetryAfterSeconds: 299,
        },
      }).valid,
    ).toBe(false);
    expect(
      FeedbackContextSchema.validate({
        ...cooldownContext,
        eligibility: {
          ...cooldownContext.eligibility,
          bugAvailableAt: undefined,
        },
      }).valid,
    ).toBe(false);
    expect(
      FeedbackContextSchema.validate({
        ...cooldownContext,
        eligibility: {
          ...cooldownContext.eligibility,
          bugAvailableAt: "2026-07-19T11:05:00.000Z",
          bugRetryAfterSeconds: 86_400,
        },
      }).valid,
    ).toBe(true);
    expect(
      FeedbackContextSchema.validate({
        ...cooldownContext,
        eligibility: {
          ...cooldownContext.eligibility,
          bugAvailableAt: "2026-07-19T11:05:00.001Z",
          bugRetryAfterSeconds: 86_401,
        },
      }).valid,
    ).toBe(false);
    expect(
      FeedbackContextSchema.validate({
        ...result.value,
        eligibility: {
          ...result.value?.eligibility,
          reviewAvailableAt: "2026-08-17T11:05:00.001Z",
        },
      }).valid,
    ).toBe(false);
    expect(
      FeedbackContextSchema.validate({
        ...result.value,
        surfaces: [],
        selectedSurfaceId: undefined,
        eligibility: {
          ...result.value?.eligibility,
          bugReport: true,
          gameDiagnostics: false,
        },
      }).valid,
    ).toBe(false);
    expect(
      FeedbackContextSchema.validate({
        ...result.value,
        surfaces: result.value?.surfaces?.filter(
          (surface) => !surface.gameDiagnosticsEligible,
        ),
        selectedSurfaceId: "site.home",
        eligibility: {
          ...result.value?.eligibility,
          bugReport: true,
          gameDiagnostics: true,
        },
      }).valid,
    ).toBe(false);
  });

  it("rejects duplicate surfaces and diagnostics eligibility on non-game surfaces", () => {
    const surface = {
      id: "site.home",
      labelKey: "feedback.surface.home",
      kind: "public",
      gameDiagnosticsEligible: false,
    };
    expect(
      FeedbackSurfaceCatalogSchema.validate({
        generatedAt: GENERATED_AT,
        catalogVersion: "2026-07-18",
        surfaces: [surface, { ...surface }],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackSurfaceCatalogSchema.validate({
        generatedAt: GENERATED_AT,
        catalogVersion: "2026-07-18",
        surfaces: [{ ...surface, gameDiagnosticsEligible: true }],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackSurfaceCatalogSchema.validate({
        generatedAt: GENERATED_AT,
        catalogVersion: "2026-07-18",
        surfaces: [
          {
            id: "admin.users",
            labelKey: "feedback.surface.adminUsers",
            kind: "public",
            gameDiagnosticsEligible: false,
          },
        ],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackSurfaceCatalogSchema.validate({
        generatedAt: GENERATED_AT,
        catalogVersion: "2026-07-18",
        surfaces: [
          {
            id: "game.player-system",
            labelKey: "feedback.surface.playerSystem",
            kind: "game",
            gameDiagnosticsEligible: true,
          },
        ],
      }).valid,
    ).toBe(false);
  });

  it("accepts partial dirty drafts but prevents cross-form fields", () => {
    expect(
      FeedbackDraftUpsertRequestSchema.validate({
        draftId: UUID_A,
        kind: "bug",
        revision: 1,
        surfaceId: "site.home",
        severity: 2,
      }).valid,
    ).toBe(true);
    expect(
      FeedbackDraftUpsertRequestSchema.validate({
        draftId: UUID_A,
        kind: "review",
        revision: 1,
        satisfaction: 5,
        severity: 2,
      }).valid,
    ).toBe(false);
    expect(
      FeedbackDraftUpsertRequestSchema.validate({
        draftId: UUID_A,
        kind: "bug",
        revision: 1,
      }).valid,
    ).toBe(false);
  });

  it("validates final bug and review requests separately", () => {
    expect(
      FeedbackBugSubmissionRequestSchema.validate({
        submissionId: UUID_A,
        draftId: UUID_B,
        surfaceId: "site.home",
        issueType: "accessibility",
        severity: 4,
        analysisReceiptId: UUID_A,
      }).valid,
    ).toBe(true);

    expect(
      FeedbackReviewSubmissionRequestSchema.validate({
        submissionId: UUID_A,
        satisfaction: 5,
        analysisReceiptId: UUID_B,
      }).valid,
    ).toBe(true);

    expect(
      FeedbackBugSubmissionRequestSchema.validate({
        submissionId: UUID_A,
        surfaceId: "site.home",
        issueType: "privacy-security",
        severity: 5,
      }).valid,
    ).toBe(false);

    const logSafeBug = FeedbackBugSubmissionRequestSchema.sanitizeForLog(
      {
        submissionId: UUID_A,
        draftId: UUID_B,
        surfaceId: "site.home",
        issueType: "functionality",
        severity: 3,
      },
      () => "must-not-pseudonymize",
    );
    expect(logSafeBug).not.toHaveProperty("submissionId");
    expect(logSafeBug).not.toHaveProperty("draftId");
  });

  it("bounds drafts to a server-owned 24-hour expiry", () => {
    expect(
      FeedbackDraftPacketSchema.validate({
        draftId: UUID_A,
        kind: "bug",
        revision: 2,
        surfaceId: "site.home",
        severity: 2,
        serverUpdatedAt: GENERATED_AT,
        expiresAt: "2026-07-19T11:05:00.000Z",
      }).valid,
    ).toBe(true);
    expect(
      FeedbackDraftReceiptSchema.validate({
        draftId: UUID_A,
        revision: 2,
        savedAt: GENERATED_AT,
        expiresAt: "2026-07-19T11:05:00.000Z",
      }).valid,
    ).toBe(true);
  });

  it("rejects non-v4 workflow identifiers", () => {
    expect(
      FeedbackReviewSubmissionRequestSchema.validate({
        submissionId: "00000000-0000-0000-0000-000000000000",
        satisfaction: 5,
      }).valid,
    ).toBe(false);
    expect(
      FeedbackReviewSubmissionRequestSchema.validate({
        submissionId: "123e4567-e89b-12d3-a456-426614174000",
        satisfaction: 5,
      }).valid,
    ).toBe(false);
    expect(
      FeedbackReviewSubmissionRequestSchema.validate({
        submissionId: UUID_A.toUpperCase(),
        satisfaction: 5,
      }).valid,
    ).toBe(false);
  });

  it("returns only identifier-free acceptance and structured-only results", () => {
    expect(
      FeedbackAcceptanceReceiptSchema.validate({
        packetId: UUID_A,
        kind: "bug",
        acceptedAt: GENERATED_AT,
        nextEligibleAt: "2026-07-18T11:10:00.000Z",
      }).valid,
    ).toBe(true);
    for (const cooldownSeconds of FEEDBACK_BUG_COOLDOWN_SECONDS) {
      expect(
        FeedbackAcceptanceReceiptSchema.validate({
          packetId: UUID_A,
          kind: "bug",
          acceptedAt: GENERATED_AT,
          nextEligibleAt: new Date(
            Date.parse(GENERATED_AT) + cooldownSeconds * 1_000,
          ).toISOString(),
        }).valid,
      ).toBe(true);
    }
    expect(
      FeedbackAcceptanceReceiptSchema.validate({
        packetId: UUID_A,
        kind: "review",
        acceptedAt: GENERATED_AT,
        nextEligibleAt: "2026-08-17T11:05:00.000Z",
      }).valid,
    ).toBe(true);
    for (const invalidReceipt of [
      {
        packetId: UUID_A,
        kind: "bug",
        acceptedAt: GENERATED_AT,
        nextEligibleAt: "2026-07-18T11:05:01.000Z",
      },
      {
        packetId: UUID_A,
        kind: "bug",
        acceptedAt: GENERATED_AT,
        nextEligibleAt: "2026-08-17T11:05:00.000Z",
      },
      {
        packetId: UUID_A,
        kind: "review",
        acceptedAt: GENERATED_AT,
        nextEligibleAt: "2026-08-17T11:04:59.999Z",
      },
    ]) {
      expect(
        FeedbackAcceptanceReceiptSchema.validate(invalidReceipt).valid,
      ).toBe(false);
    }
    expect(
      FeedbackStructuredOnlyAnalysisResultSchema.validate({
        status: "structured-only-required",
        reasonCode: "analysis-unavailable",
      }).valid,
    ).toBe(true);
    expect(
      FeedbackStructuredOnlyAnalysisResultSchema.validate({
        status: "structured-only-required",
        reasonCode: "contains-user-text",
      }).valid,
    ).toBe(false);
  });
});

describe("identifier-free persisted feedback packets", () => {
  it("accepts structured bug and review packets", () => {
    expect(FeedbackBugPacketSchema.validate(bugPacket).valid).toBe(true);
    expect(FeedbackReviewPacketSchema.validate(reviewPacket).valid).toBe(true);
    expect(FeedbackBugPacketSchema.getPiiAudit()).toEqual([]);
    expect(FeedbackReviewPacketSchema.getPiiAudit()).toEqual([]);
  });

  it("prevents transient receipt join keys entering persisted analysis", () => {
    expect(
      FeedbackBugPacketSchema.validate({
        ...bugPacket,
        analysis: derivedAnalysis,
      }).valid,
    ).toBe(false);
  });

  it("composes the validated identifier-free analysis projection", () => {
    const analysis = FeedbackDerivedAnalysisSchema.validate(derivedProjection);
    expect(analysis.valid).toBe(true);
    expect(
      FeedbackReviewPacketSchema.validate({
        ...reviewPacket,
        analysis: analysis.value,
      }).valid,
    ).toBe(true);
  });

  it("preserves omission of optional packet projections during storage preparation", () => {
    const minimalBug = FeedbackBugPacketSchema.validate({
      packetId: UUID_A,
      acceptedAt: GENERATED_AT,
      surfaceId: "site.home",
      issueType: "functionality",
      severity: 2,
      releaseId: "release-2026.07.18",
      buildId: "site-2026.07.18.1",
    });
    const minimalReview = FeedbackReviewPacketSchema.validate({
      packetId: UUID_B,
      acceptedAt: GENERATED_AT,
      satisfaction: 4,
    });
    expect(minimalBug.valid).toBe(true);
    expect(minimalReview.valid).toBe(true);

    const preparedBug = FeedbackBugPacketSchema.prepareForStorage(
      minimalBug.value ?? {},
      () => "must-not-encrypt",
      () => "must-not-hash",
    );
    const preparedReview = FeedbackReviewPacketSchema.prepareForStorage(
      minimalReview.value ?? {},
      () => "must-not-encrypt",
      () => "must-not-hash",
    );

    expect(preparedBug).not.toHaveProperty("analysis");
    expect(preparedBug).not.toHaveProperty("gameDiagnostics");
    expect(preparedReview).not.toHaveProperty("analysis");
    const readBug = FeedbackBugPacketSchema.prepareForRead(
      preparedBug,
      (value) => value,
    );
    const readReview = FeedbackReviewPacketSchema.prepareForRead(
      preparedReview,
      (value) => value,
    );
    expect(Object.prototype.hasOwnProperty.call(readBug, "analysis")).toBe(
      false,
    );
    expect(
      Object.prototype.hasOwnProperty.call(readBug, "gameDiagnostics"),
    ).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(readReview, "analysis")).toBe(
      false,
    );
    expect(FeedbackBugPacketSchema.validate(preparedBug).valid).toBe(true);
    expect(FeedbackReviewPacketSchema.validate(preparedReview).valid).toBe(
      true,
    );
  });

  it.each([
    "narrative",
    "ciphertext",
    "reporterId",
    "accountId",
    "pseudonym",
    "ipAddress",
    "userAgent",
    "sessionId",
    "locale",
    "url",
    "referrer",
    "clientTimestamp",
    "screenshot",
    "pixels",
    "quote",
    "summary",
    "embedding",
    "contentHash",
    "modelTrace",
  ])("rejects privacy-forbidden packet field %s", (fieldName) => {
    const result = FeedbackBugPacketSchema.validate({
      ...bugPacket,
      [fieldName]: "synthetic-sensitive-value",
    });

    expect(result.valid).toBe(false);
    expect(result.errors?.join(" ")).not.toContain(
      "synthetic-sensitive-value",
    );
    expect(result.errors?.join(" ")).not.toContain(fieldName);
  });
});

describe("privacy-safe game evidence", () => {
  it("accepts bucketed renderer diagnostics with explicit consent", () => {
    expect(FeedbackGameDiagnosticsSchema.validate(safeDiagnostics).valid).toBe(
      true,
    );
  });

  it("rejects player-system, exact/fingerprinting data, and unconsented capture", () => {
    expect(
      FeedbackGameDiagnosticsSchema.validate({
        ...safeDiagnostics,
        surfaceId: "player-system",
      }).valid,
    ).toBe(false);
    expect(
      FeedbackGameDiagnosticsSchema.validate({
        ...safeDiagnostics,
        consentConfirmed: false,
      }).valid,
    ).toBe(false);
    expect(
      FeedbackGameDiagnosticsSchema.validate({
        ...safeDiagnostics,
        exactWidth: 1920,
        exactHeight: 1080,
        adapterName: "synthetic-adapter",
        rawWarning: "synthetic-warning",
      }).valid,
    ).toBe(false);
  });

  it("rejects duplicate diagnostic identifiers and counter codes", () => {
    expect(
      FeedbackGameDiagnosticsSchema.validate({
        ...safeDiagnostics,
        featureIds: ["renderer.frame-loop", "renderer.frame-loop"],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackGameDiagnosticsSchema.validate({
        ...safeDiagnostics,
        errorCodes: ["renderer.device-lost", "renderer.device-lost"],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackGameDiagnosticsSchema.validate({
        ...safeDiagnostics,
        counters: [
          { code: "frame-drop", count: 1 },
          { code: "frame-drop", count: 2 },
        ],
      }).valid,
    ).toBe(false);
  });

  it("rejects safe-looking arbitrary diagnostic identifiers and surface mismatches", () => {
    expect(
      FeedbackGameDiagnosticsSchema.validate({
        ...safeDiagnostics,
        provenanceContractId: "alice.smith",
      }).valid,
    ).toBe(false);
    expect(
      FeedbackGameDiagnosticsSchema.validate({
        ...safeDiagnostics,
        errorCodes: ["john.smith"],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackBugSubmissionRequestSchema.validate({
        submissionId: UUID_A,
        surfaceId: "site.home",
        issueType: "gameplay",
        severity: 3,
        gameDiagnostics: safeDiagnostics,
      }).valid,
    ).toBe(false);
  });

  it("composes a validated diagnostic fragment into a persisted packet", () => {
    const diagnostics = FeedbackGameDiagnosticsSchema.validate(safeDiagnostics);
    expect(diagnostics.valid).toBe(true);
    expect(
      FeedbackBugPacketSchema.validate({
        ...bugPacket,
        gameDiagnostics: diagnostics.value,
      }).valid,
    ).toBe(true);
  });

  it("defines a manifest for server reconstruction, never client pixels", () => {
    const result = FeedbackGameReconstructionManifestSchema.validate({
      reconstructionId: UUID_A,
      bugPacketId: UUID_B,
      createdAt: GENERATED_AT,
      expiresAt: "2026-08-17T11:05:00.000Z",
      curatedAssetSetId: "generator-public-assets-v1",
      noticeKey: "feedback.reconstruction.not-literal-screenshot",
      diagnostics: safeDiagnostics,
    });

    expect(result.valid).toBe(true);
    expect(result.value).not.toHaveProperty("pixels");
    expect(result.value).not.toHaveProperty("blobUrl");
  });
});

describe("materialized report contracts", () => {
  it("validates a bounded hourly bug-health report", () => {
    const report = {
      reportId: UUID_A,
      windowStart: HOUR_START,
      windowEnd: HOUR_END,
      revision: 1,
      generatedAt: GENERATED_AT,
      acceptedCount: 5,
      rejectedCount: 1,
      diagnosticsAttachedCount: 2,
      deterministicRedactionCount: 2,
      scannerRedactionCount: 1,
      processorLagSeconds: 300,
      rates: {
        rejectionRate: 0.166667,
        deterministicRedactionsPerAccepted: 0.4,
        scannerRedactionsPerAccepted: 0.2,
      },
      traffic: {
        denominator: 1_000,
        acceptedPerTenThousand: 50,
      },
      targetDistribution: [{ id: "site.home", count: 5 }],
      issueTypeDistribution: [{ id: "functionality", count: 5 }],
      severityDistribution: [
        { id: "3", count: 2 },
        { id: "5", count: 3 },
      ],
      intentDistribution: [{ id: "functionality", count: 3 }],
      buildDistribution: [{ id: "site-2026.07.18.1", count: 5 }],
      rendererDistribution: [{ id: "webgl2", count: 2 }],
      backendDistribution: [{ id: "browser", count: 2 }],
      viewportDistribution: [{ id: "large-landscape", count: 2 }],
      frameRateDistribution: [{ id: "30-59", count: 2 }],
      frameTimeDistribution: [{ id: "17-33ms", count: 2 }],
      diagnosticFeatureDistribution: [
        { id: "renderer.frame-loop", count: 2 },
      ],
      diagnosticCounterDistribution: [{ id: "frame-drop", count: 6 }],
      diagnosticErrorDistribution: [{ id: "renderer.device-lost", count: 1 }],
      abuseBlockBands: [{ id: "five-minutes", count: 2 }],
      comparison: {
        previousHourRatio: 1.25,
        sevenDaySameHourRatio: 3,
      },
      advisories: [
        {
          code: "severity-five",
          level: "advisory",
          triggerCount: 3,
          recommendationIds: ["inspect-release"],
        },
        {
          code: "critical-regression",
          level: "critical",
          triggerCount: 3,
          recommendationIds: ["inspect-release", "verify-renderer-health"],
        },
      ],
    };
    const result = FeedbackHourlyBugReportSchema.validate(report);

    expect(result.valid).toBe(true);
    expect(
      FeedbackHourlyBugReportSchema.validate({
        ...report,
        targetDistribution: [{ id: "site.home", count: 4 }],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackHourlyBugReportSchema.validate({
        ...report,
        advisories: [
          { ...report.advisories[0], triggerCount: 999_999 },
          report.advisories[1],
        ],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackHourlyBugReportSchema.validate({
        ...report,
        advisories: [
          {
            ...report.advisories[0],
            recommendationIds: ["review-top-intents"],
          },
          report.advisories[1],
        ],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackHourlyBugReportSchema.validate({
        ...report,
        targetDistribution: [{ id: "john.smith", count: 5 }],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackHourlyBugReportSchema.validate({
        ...report,
        windowStart: "2026-07-18T10:30:00.000Z",
      }).valid,
    ).toBe(false);
    expect(
      FeedbackHourlyBugReportSchema.validate({
        ...report,
        rates: { ...report.rates, rejectionRate: 0.2 },
      }).valid,
    ).toBe(false);
    expect(
      FeedbackHourlyBugReportSchema.validate({
        ...report,
        intentDistribution: [{ id: "functionality", count: 61 }],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackHourlyBugReportSchema.validate({
        ...report,
        diagnosticCounterDistribution: [
          { id: "frame-drop", count: 10_001 },
        ],
      }).valid,
    ).toBe(true);
    expect(
      FeedbackHourlyBugReportSchema.validate({
        ...report,
        diagnosticCounterDistribution: [
          { id: "frame-drop", count: 20_001 },
        ],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackHourlyBugReportSchema.validate({
        ...report,
        advisories: [
          { ...report.advisories[0], triggerCount: 0 },
          report.advisories[1],
        ],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackHourlyBugReportSchema.validate({
        ...report,
        advisories: [
          { ...report.advisories[0], recommendationIds: [] },
          report.advisories[1],
        ],
      }).valid,
    ).toBe(false);
  });

  it("validates daily satisfaction without free-text summaries", () => {
    const result = FeedbackDailySatisfactionReportSchema.validate({
      reportId: UUID_A,
      windowStart: "2026-07-17T00:00:00.000Z",
      windowEnd: "2026-07-18T00:00:00.000Z",
      revision: 1,
      generatedAt: "2026-07-18T02:15:00.000Z",
      processorLagSeconds: 8_100,
      acceptedReviewCount: 21,
      meanStars: 3.8,
      medianStars: 4,
      starDistribution: [
        { id: "1", count: 1 },
        { id: "2", count: 2 },
        { id: "3", count: 4 },
        { id: "4", count: 8 },
        { id: "5", count: 6 },
      ],
      sentimentDistribution: [{ id: "positive", count: 10 }],
      intentDistribution: [{ id: "praise", count: 8 }],
      rollingWindows: [
        { period: "7-days", reviewCount: 21, meanStars: 3.5 },
        { period: "30-days", reviewCount: 80, meanStars: 3.8 },
        { period: "90-days", reviewCount: 220, meanStars: 4 },
      ],
      previousPeriodDeltaStars: -0.3,
      advisories: [
        {
          code: "satisfaction-drop",
          level: "advisory",
          triggerCount: 21,
          recommendationIds: ["review-top-intents"],
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(
      FeedbackDailySatisfactionReportSchema.validate({
        ...result.value,
        advisories: [
          {
            ...result.value?.advisories[0],
            triggerCount: 1,
          },
        ],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackDailySatisfactionReportSchema.validate({
        ...result.value,
        summary: "must never be stored",
      }).valid,
    ).toBe(false);
    expect(
      FeedbackDailySatisfactionReportSchema.validate({
        ...result.value,
        acceptedReviewCount: 1,
        meanStars: 5,
        medianStars: 5,
        starDistribution: [{ id: "5", count: 1 }],
        sentimentDistribution: [],
        intentDistribution: [],
        rollingWindows: [
          { period: "7-days", reviewCount: 0 },
          { period: "30-days", reviewCount: 0 },
          { period: "90-days", reviewCount: 0 },
        ],
        previousPeriodDeltaStars: undefined,
        advisories: [],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackDailySatisfactionReportSchema.validate({
        ...result.value,
        sentimentDistribution: [{ id: "positive", count: 22 }],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackDailySatisfactionReportSchema.validate({
        ...result.value,
        rollingWindows: [
          { period: "7-days", reviewCount: 90, meanStars: 3.5 },
          { period: "30-days", reviewCount: 80, meanStars: 3.8 },
          { period: "90-days", reviewCount: 220, meanStars: 4 },
        ],
      }).valid,
    ).toBe(false);
  });

  it("represents a zero-review day without invented statistics", () => {
    const zeroReport = {
      reportId: UUID_A,
      windowStart: "2026-07-17T00:00:00.000Z",
      windowEnd: "2026-07-18T00:00:00.000Z",
      revision: 1,
      generatedAt: "2026-07-18T02:15:00.000Z",
      processorLagSeconds: 8_100,
      acceptedReviewCount: 0,
      starDistribution: [],
      sentimentDistribution: [],
      intentDistribution: [],
      rollingWindows: [
        { period: "7-days", reviewCount: 0 },
        { period: "30-days", reviewCount: 0 },
        { period: "90-days", reviewCount: 0 },
      ],
      advisories: [],
    };
    expect(
      FeedbackDailySatisfactionReportSchema.validate(zeroReport).valid,
    ).toBe(true);
    expect(
      FeedbackDailySatisfactionReportSchema.validate({
        ...zeroReport,
        meanStars: 3,
        medianStars: 3,
      }).valid,
    ).toBe(false);
  });

  it("enforces public honesty privacy thresholds and weekly gaps", () => {
    const suppressed = FeedbackPublicSummarySchema.validate({
      snapshotId: UUID_A,
      generatedAt: GENERATED_AT,
      asOf: HONESTY_AS_OF,
      freshness: "fresh",
      reportAgeSeconds: 39_900,
      rollingWindowDays: 90,
      state: "suppressed",
      weeklyPoints: honestyWeeks(),
    });
    const publicSnapshot = FeedbackPublicSummarySchema.validate({
      snapshotId: UUID_B,
      generatedAt: GENERATED_AT,
      asOf: HONESTY_AS_OF,
      freshness: "fresh",
      reportAgeSeconds: 39_900,
      rollingWindowDays: 90,
      state: "published",
      acceptedReviewCount: 25,
      averageStars: 4.2,
      trend: "up",
      comparison: {
        previousAcceptedReviewCount: 30,
        previousAverageStars: 4.1,
        deltaStars: 0.1,
      },
      weeklyPoints: honestyWeeks({ count: 16, average: 4.3 }),
    });

    expect(suppressed.valid).toBe(true);
    expect(publicSnapshot.valid).toBe(true);
    expect(
      FeedbackPublicSummarySchema.validate({
        ...publicSnapshot.value,
        trend: "down",
      }).valid,
    ).toBe(false);
    expect(
      FeedbackPublicSummarySchema.validate({
        ...publicSnapshot.value,
        comparison: {
          ...publicSnapshot.value?.comparison,
          deltaStars: 0.2,
        },
      }).valid,
    ).toBe(false);
    expect(
      FeedbackPublicSummarySchema.validate({
        ...publicSnapshot.value,
        comparison: {
          ...publicSnapshot.value?.comparison,
          previousAcceptedReviewCount: 9,
        },
      }).valid,
    ).toBe(false);
    expect(
      FeedbackPublicSummarySchema.validate({
        ...publicSnapshot.value,
        trend: "flat",
        comparison: {
          previousAcceptedReviewCount: 30,
          previousAverageStars: 4.11,
          deltaStars: 0.09,
        },
      }).valid,
    ).toBe(true);
    expect(
      FeedbackPublicSummarySchema.validate({
        ...publicSnapshot.value,
        trend: "down",
        comparison: {
          previousAcceptedReviewCount: 30,
          previousAverageStars: 4.3,
          deltaStars: -0.1,
        },
      }).valid,
    ).toBe(true);
    expect(
      FeedbackPublicSummarySchema.validate({
        ...publicSnapshot.value,
        trend: undefined,
        comparison: undefined,
      }).valid,
    ).toBe(true);
    expect(
      FeedbackPublicSummarySchema.validate({
        ...suppressed.value,
        acceptedReviewCount: 9,
      }).valid,
    ).toBe(false);
    expect(
      FeedbackPublicSummarySchema.validate({
        ...publicSnapshot.value,
        weeklyPoints: [
          ...honestyWeeks().slice(0, 12),
          {
            weekStart: "2026-07-13T00:00:00.000Z",
            state: "published",
            acceptedReviewCount: 9,
            averageStars: 5,
          },
        ],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackPublicSummarySchema.validate({
        ...publicSnapshot.value,
        weeklyPoints: [
          ...honestyWeeks().slice(0, 11),
          {
            weekStart: "2026-07-06T00:00:00.000Z",
            state: "published",
            acceptedReviewCount: 16,
            averageStars: 4.3,
          },
          {
            weekStart: "2026-07-06T00:00:00.000Z",
            state: "published",
            acceptedReviewCount: 16,
            averageStars: 4.3,
          },
        ],
      }).valid,
    ).toBe(false);
    expect(
      FeedbackPublicSummarySchema.validate({
        ...publicSnapshot.value,
        reportAgeSeconds: 1,
      }).valid,
    ).toBe(false);
    expect(
      FeedbackPublicSummarySchema.validate({
        ...suppressed.value,
        weeklyPoints: [
          ...honestyWeeks().slice(0, 12),
          {
            weekStart: "2026-07-13T00:00:00.000Z",
            state: "published",
            acceptedReviewCount: 10,
            averageStars: 4,
          },
        ],
      }).valid,
    ).toBe(false);
  });

  it("validates replay-safe checkpoints and manifests", () => {
    const bugCheckpoint = {
      checkpointId: "checkpoint:bug-hourly:2026-07-18T10",
      processor: "bug-hourly",
      windowKey: "2026-07-18T10",
      revision: 1,
      completedAt: GENERATED_AT,
      reportId: UUID_A,
    };
    const bugManifest = {
      manifestId: UUID_A,
      processor: "bug-hourly",
      windowKey: "2026-07-18T10",
      revision: 1,
      generatedAt: GENERATED_AT,
      sourcePacketCount: 5,
      lateArrivalCount: 0,
      outputReportId: UUID_B,
      status: "published",
    };
    const reconciliationCheckpoint = {
      checkpointId:
        "checkpoint:commit-reconciliation:2026-07-18T11:00",
      processor: "commit-reconciliation",
      windowKey: "2026-07-18T11:00",
      revision: 1,
      completedAt: GENERATED_AT,
    };
    const reconciliationManifest = {
      manifestId: UUID_A,
      processor: "commit-reconciliation",
      windowKey: "2026-07-18T11:00",
      revision: 1,
      generatedAt: GENERATED_AT,
      sourcePacketCount: 0,
      lateArrivalCount: 0,
      status: "no-op",
    };

    expect(
      FeedbackProcessorCheckpointSchema.validate(bugCheckpoint).valid,
    ).toBe(true);
    expect(
      FeedbackMaterializationManifestSchema.validate(bugManifest).valid,
    ).toBe(true);
    expect(
      FeedbackProcessorCheckpointSchema.validate(reconciliationCheckpoint)
        .valid,
    ).toBe(true);
    expect(
      FeedbackMaterializationManifestSchema.validate(reconciliationManifest)
        .valid,
    ).toBe(true);

    for (const invalidCheckpoint of [
      {
        ...bugCheckpoint,
        checkpointId: "checkpoint:review-daily:2026-07-18T10",
      },
      { ...bugCheckpoint, windowKey: "2026-07-18T10:00:00Z" },
      {
        ...reconciliationCheckpoint,
        windowKey: "2026-07-18T11:03",
        checkpointId:
          "checkpoint:commit-reconciliation:2026-07-18T11:03",
      },
      { ...reconciliationCheckpoint, reportId: UUID_A },
    ]) {
      expect(
        FeedbackProcessorCheckpointSchema.validate(invalidCheckpoint).valid,
      ).toBe(false);
    }

    for (const invalidManifest of [
      { ...bugManifest, lateArrivalCount: 6 },
      { ...bugManifest, lateArrivalCount: 1 },
      {
        ...bugManifest,
        revision: 2,
        status: "corrected",
        lateArrivalCount: 0,
      },
      {
        ...bugManifest,
        status: "no-op",
        outputReportId: undefined,
      },
      {
        ...reconciliationManifest,
        status: "published",
        outputReportId: UUID_B,
      },
      {
        ...reconciliationManifest,
        lateArrivalCount: 1,
        sourcePacketCount: 1,
      },
    ]) {
      expect(
        FeedbackMaterializationManifestSchema.validate(invalidManifest)
          .valid,
      ).toBe(false);
    }
  });
});
