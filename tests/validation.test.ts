import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePhone,
  validateUrl,
  validateUUID,
  validateDateTimeISO,
  validateCountryCode,
  validateCurrencyCode,
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
  });

  it("rejects invalid currency codes", () => {
    expect(validateCurrencyCode("XXX")).toBe(true); // XXX is a valid ISO placeholder currency!
    expect(validateCurrencyCode("ABC")).toBe(false);
    expect(validateCurrencyCode("usd")).toBe(true); // case insensitive
  });
});
