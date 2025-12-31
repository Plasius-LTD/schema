import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePhone,
  validateUrl,
  validateUUID,
  validateDateTimeISO,
  validateCountryCode,
  validateCurrencyCode,
  validateName,
  validateSafeText,
  validatePercentage,
  validateRichText,
  validateUserId,
  validateUserIdArray,
  validateLanguage,
} from "../src/validation";

describe("validateEmail", () => {
  it("accepts valid emails", () => {
    expect(validateEmail("test@example.com")).toBe(true);
    expect(validateEmail("user.name+tag+sorting@example.co.uk")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(validateEmail("not-an-email")).toBe(false);
    expect(validateEmail("user@com")).toBe(false);
  });
});

describe("validatePhone", () => {
  it("accepts valid E.164 phones", () => {
    expect(validatePhone("+14155552671")).toBe(true);
    expect(validatePhone("+447911123456")).toBe(true);
  });

  it("rejects invalid phones", () => {
    expect(validatePhone("123456")).toBe(false);
    expect(validatePhone("0044123456789")).toBe(false);
  });
});

describe("validateUrl", () => {
  it("accepts valid URLs", () => {
    expect(validateUrl("https://example.com")).toBe(true);
    expect(validateUrl("http://www.example.co.uk/path")).toBe(true);
  });

  it("rejects invalid URLs", () => {
    expect(validateUrl("ftp://example.com")).toBe(false);
    expect(validateUrl("www.example.com")).toBe(false);
    expect(validateUrl("not-a-url")).toBe(false);
  });
});

describe("validateUUID", () => {
  it("accepts valid UUIDs", () => {
    expect(validateUUID("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });

  it("rejects invalid UUIDs", () => {
    expect(validateUUID("not-a-uuid")).toBe(false);
    expect(validateUUID("123456")).toBe(false);
  });
});

describe("validateDateTimeISO", () => {
  it("accepts valid ISO dates", () => {
    const now = new Date().toISOString();
    expect(validateDateTimeISO(now)).toBe(true);
  });

  it("rejects invalid dates", () => {
    expect(validateDateTimeISO("not-a-date")).toBe(false);
    expect(validateDateTimeISO("2023-13-01T00:00:00Z")).toBe(false); // invalid month
  });
});

describe("validateCountryCode", () => {
  it("accepts valid country codes", () => {
    expect(validateCountryCode("GB")).toBe(true);
    expect(validateCountryCode("US")).toBe(true);
    expect(validateCountryCode("FR")).toBe(true);
    expect(validateCountryCode("PS")).toBe(true); // ISO 3166-1 alpha-2: State of Palestine
  });

  it("rejects invalid country codes", () => {
    expect(validateCountryCode("XX")).toBe(false);
    expect(validateCountryCode("")).toBe(false);
    expect(validateCountryCode("gb")).toBe(true); // case insensitive
  });
});

describe("validateCurrencyCode", () => {
  it("accepts valid currency codes", () => {
    expect(validateCurrencyCode("USD")).toBe(true);
    expect(validateCurrencyCode("EUR")).toBe(true);
    expect(validateCurrencyCode("GBP")).toBe(true);
    expect(validateCurrencyCode("SLE")).toBe(true); // ISO 4217 Sierra Leone Leone (new code)
    expect(validateCurrencyCode("SLL")).toBe(true); // Legacy Sierra Leone Leone
  });

  it("rejects invalid currency codes", () => {
    expect(validateCurrencyCode("XXX")).toBe(true); // XXX is a valid ISO placeholder currency!
    expect(validateCurrencyCode("ABC")).toBe(false);
    expect(validateCurrencyCode("usd")).toBe(true); // case insensitive
  });
});

describe("validateName", () => {
  it("accepts names with letters, accents, apostrophes, and hyphens", () => {
    expect(validateName("José Ángel")).toBe(true);
    expect(validateName("O'Connor")).toBe(true);
    expect(validateName("Jean-Luc Picard")).toBe(true);
  });

  it("rejects names with control chars, digits, or symbols", () => {
    expect(validateName("Bad\u0001")).toBe(false);
    expect(validateName("Name123")).toBe(false);
    expect(validateName("Name@Example")).toBe(false);
  });
});

describe("validateSafeText", () => {
  it("accepts trimmed safe text", () => {
    expect(validateSafeText("Hello world")).toBe(true);
  });

  it("rejects dangerous or empty text", () => {
    expect(validateSafeText("  ")).toBe(false);
    expect(validateSafeText("<script>alert(1)</script>")).toBe(false);
    expect(validateSafeText("SELECT * FROM users")).toBe(false);
  });
});

describe("validatePercentage", () => {
  it("accepts 0-100 inclusive", () => {
    expect(validatePercentage(0)).toBe(true);
    expect(validatePercentage(50)).toBe(true);
    expect(validatePercentage(100)).toBe(true);
  });

  it("rejects out-of-range or non-number", () => {
    expect(validatePercentage(-1)).toBe(false);
    expect(validatePercentage(100.0001)).toBe(false);
    expect(validatePercentage("50" as any)).toBe(false);
  });
});

describe("validateRichText", () => {
  it("accepts benign rich text", () => {
    expect(validateRichText("<p>Hello</p>")).toBe(true);
  });

  it("rejects dangerous content", () => {
    expect(validateRichText("<script>alert('x')</script>")).toBe(false);
    expect(validateRichText('<a href="javascript:alert(1)">x</a>')).toBe(false);
    expect(validateRichText('<img src="#" onload="alert(1)">')).toBe(false);
  });
});

describe("validateUserId", () => {
  it("accepts Google, Microsoft, and Apple style subs", () => {
    expect(validateUserId("123456789012345678901")).toBe(true); // Google digits
    expect(validateUserId("123e4567-e89b-12d3-a456-426614174000")).toBe(true); // Microsoft UUID
    expect(validateUserId("apple-user_01")).toBe(true); // Apple-style opaque
  });

  it("rejects empty or malformed subs", () => {
    expect(validateUserId("")).toBe(false);
    expect(validateUserId("short")).toBe(false);
    expect(validateUserId("bad space")).toBe(false);
  });

  it("validates arrays of subs", () => {
    expect(
      validateUserIdArray([
        "123456789012345678901",
        "123e4567-e89b-12d3-a456-426614174000",
      ])
    ).toBe(true);
    expect(validateUserIdArray(["123", "bad"])).toBe(false);
  });
});

describe("validateLanguage", () => {
  it("accepts BCP47 language tags", () => {
    expect(validateLanguage("en")).toBe(true);
    expect(validateLanguage("sr-Cyrl-RS")).toBe(true);
    expect(validateLanguage("en-GB-u-ca-gregory")).toBe(true);
  });

  it("rejects malformed or unknown language tags", () => {
    expect(validateLanguage("zz")).toBe(false); // unknown language
    expect(validateLanguage("en-GB-123456789")).toBe(false); // variant too long
    expect(validateLanguage("")).toBe(false);
  });
});
