import { describe, expect, it } from "vitest";
import { createSchema } from "../src/schema.js";
import { field } from "../src/field.js";
import { expectValid, expectInvalid } from "./test-utils.js";

// --- PII: sanitizeForLog should clean output correctly ---
describe("PII log sanitization", () => {
  const LogSchema = createSchema(
    {
      email: field.string().PID({
        classification: "high",
        action: "encrypt",
        logHandling: "redact",
        purpose: "user contact",
      }),
      sessionId: field.string().PID({
        classification: "low",
        action: "hash",
        logHandling: "pseudonym",
        purpose: "session correlation",
      }),
      nickname: field.string().PID({
        classification: "none",
        action: "none",
        logHandling: "plain",
      }),
      internalNote: field.string().PID({
        classification: "low",
        action: "clear",
        logHandling: "omit",
        purpose: "ops-only",
      }),
    },
    "LogSchema",
    { version: "1.0.0", piiEnforcement: "strict" }
  );

  it("should redact, pseudonymize, pass-through, and omit according to logHandling", () => {
    const input = {
      email: "a@b.com",
      sessionId: "abc123",
      nickname: "phil",
      internalNote: "sensitive",
      other: "visible-but-not-in-shape",
    } as const;

    const pseudo = (v: any) => `pseudo(${String(v).length})`;
    const out = LogSchema.sanitizeForLog(input as any, pseudo);

    // redact
    expect(out.email).toBe("[REDACTED]");
    // pseudonym
    expect(out.sessionId).toBe("pseudo(6)");
    // plain
    expect(out.nickname).toBe("phil");
    // omitted entirely
    expect(Object.prototype.hasOwnProperty.call(out, "internalNote")).toBe(
      false
    );
    // unknown fields are not included (shape-driven)
    expect(Object.prototype.hasOwnProperty.call(out, "other")).toBe(false);

    // ensure no storage artifacts leak into logs
    expect(Object.keys(out).some((k) => k.endsWith("Encrypted"))).toBe(false);
    expect(Object.keys(out).some((k) => k.endsWith("Hash"))).toBe(false);
  });

  it("should handle missing optional fields by simply excluding them from sanitized output", () => {
    const minimal = { email: "x@y.com", sessionId: "id" } as const;
    const out = LogSchema.sanitizeForLog(minimal as any, (v) => `p(${v})`);
    expect(out.email).toBe("[REDACTED]");
    expect(out.sessionId).toBe("p(id)");
    // nickname/internalNote omitted if not present
    expect(out.nickname).toBe(undefined);
    expect(Object.prototype.hasOwnProperty.call(out, "internalNote")).toBe(
      false
    );
  });

  // --- PII: auditing of shape metadata ---
  describe("PII auditing", () => {
    it("getPiiAudit should include only fields with classification !== 'none' and capture action/logHandling/purpose", () => {
      const audit = LogSchema.getPiiAudit();
      expect(audit).toEqual([
        {
          field: "email",
          classification: "high",
          action: "encrypt",
          logHandling: "redact",
          purpose: "user contact",
        },
        {
          field: "sessionId",
          classification: "low",
          action: "hash",
          logHandling: "pseudonym",
          purpose: "session correlation",
        },
        {
          field: "internalNote",
          classification: "low",
          action: "clear",
          logHandling: "omit",
          purpose: "ops-only",
        },
      ]);
    });

    it("getPiiAudit should not include fields with classification 'none' (e.g., nickname)", () => {
      const audit = LogSchema.getPiiAudit();
      const fields = audit?.map((a) => a.field);
      expect(fields?.includes("nickname")).toBe(false);
      expect(fields).toEqual(["email", "sessionId", "internalNote"]);
    });

    it("audit content should be independent of enforcement mode", () => {
      const AltSchema = createSchema(
        {
          email: field.string().PID({
            classification: "high",
            action: "encrypt",
            logHandling: "redact",
          }),
        },
        "Alt",
        { version: "1.0.0", piiEnforcement: "none" }
      );
      expect(AltSchema.getPiiAudit()).toEqual([
        {
          field: "email",
          classification: "high",
          action: "encrypt",
          logHandling: "redact",
          purpose: undefined,
        },
      ]);
    });
  });
});

describe("PII read/write symmetry for hashed fields", () => {
  const HashSchema = createSchema(
    {
      sessionId: field.string().PID({
        classification: "low",
        action: "hash",
        logHandling: "pseudonym",
      }),
      note: field.string(),
    },
    "HashSchema",
    { version: "1.0.0", piiEnforcement: "strict" }
  );

  it("should surface hash values via prepareForRead", () => {
    const hashFn = (v: any) => `hash(${v})`;
    const encryptFn = (v: any) => `enc(${v})`;
    const stored = HashSchema.prepareForStorage(
      { sessionId: "abc123", note: "ok" } as any,
      encryptFn,
      hashFn
    );

    expect(stored.sessionIdHash).toBe("hash(abc123)");
    expect(stored.note).toBe("ok");

    const read = HashSchema.prepareForRead(stored as any, (v) => v);
    expect(read.sessionId).toBe("hash(abc123)");
    expect(read.note).toBe("ok");
  });

  it("handles nested PII in objects/arrays/refs for storage/read/sanitize/scrub", () => {
    const Nested = createSchema(
      {
        profile: field.object({
          email: field.email(),
          prefs: field.object({
            theme: field.string().PID({
              classification: "low",
              action: "encrypt",
              logHandling: "pseudonym",
            }),
          }),
        }),
        tags: field.array(
          field.object({
            label: field.string().PID({
              classification: "low",
              action: "hash",
              logHandling: "redact",
            }),
          })
        ),
        owner: field.ref("user") as any,
      },
      "NestedPII",
      { version: "1.0.0", piiEnforcement: "strict" }
    );

    (Nested._shape as any).owner._shape = {
      name: field.string().PID({
        classification: "high",
        action: "clear",
        logHandling: "omit",
      }),
    };

    const input = {
      profile: {
        email: "a@b.com",
        prefs: { theme: "dark" },
      },
      tags: [{ label: "x" }],
      owner: { type: "user", id: "u1", name: "Alice" },
    };

    const encryptFn = (v: any) => `enc(${v})`;
    const hashFn = (v: any) => `hash(${v})`;

    const stored = Nested.prepareForStorage(input as any, encryptFn, hashFn);
    expect(stored.profile.prefs.themeEncrypted).toBe("enc(dark)");
    expect(stored.tags[0].labelHash).toBe("hash(x)");
    expect(stored.owner.name).toBeNull();

    const read = Nested.prepareForRead(stored as any, (v) => v);
    expect(read.profile.prefs.theme).toBe("enc(dark)");
    expect(read.tags[0].label).toBe("hash(x)");
    expect(read.owner.name).toBeNull();

    const sanitized = Nested.sanitizeForLog(read as any, (v) => `p(${v})`);
    expect(sanitized.profile.prefs.theme).toBe("p(enc(dark))");
    expect(sanitized.tags[0].label).toBe("[REDACTED]");
    expect(Object.prototype.hasOwnProperty.call(sanitized.owner, "name")).toBe(
      false
    );

    const scrubbed = Nested.scrubPiiForDelete(stored as any);
    expect(scrubbed.profile.prefs.themeEncrypted).toBeNull();
    expect(scrubbed.tags[0].labelHash).toBeNull();
    expect(scrubbed.owner.name).toBeNull();
  });

  it("omits optional PII fields when missing instead of emitting null artifacts", () => {
    const Optional = createSchema(
      {
        maybe: field
          .string()
          .PID({ classification: "high", action: "encrypt", logHandling: "redact" })
          .optional(),
        maybeHash: field
          .string()
          .PID({ classification: "low", action: "hash", logHandling: "pseudonym" })
          .optional(),
        maybeClear: field
          .string()
          .PID({ classification: "low", action: "clear", logHandling: "omit" })
          .optional(),
      },
      "OptionalPII",
      { version: "1.0.0", piiEnforcement: "strict" }
    );

    const encryptFn = (v: any) => `enc(${v})`;
    const hashFn = (v: any) => `hash(${v})`;

    const stored = Optional.prepareForStorage({}, encryptFn, hashFn);
    expect(stored).toEqual({});

    const read = Optional.prepareForRead(stored as any, (v) => v);
    expect(read).toEqual({});

    const scrubbed = Optional.scrubPiiForDelete(stored as any);
    expect(scrubbed).toEqual({});
  });

  it("keeps type/id when sanitizing refs without nested shape", () => {
    const RefSchema = createSchema(
      { owner: field.ref("user") },
      "RefLog",
      { version: "1.0.0", piiEnforcement: "strict" }
    );

    const sanitized = RefSchema.sanitizeForLog(
      { owner: { type: "user", id: "u1" } } as any,
      (v) => `p(${v})`
    );

    expect(sanitized.owner).toEqual({ type: "user", id: "u1" });
  });
});
