import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock FieldBuilder so we can assert how field.ts wires it up ---
// We mock the *dependency module* that field.ts imports: "./field.builder.js"
vi.mock("../src/field.builder.js", () => {
  class MockFieldBuilder<T = unknown> {
    public type: string;
    public options?: Record<string, unknown>;
    public calls: { method: string; args: any[] }[] = [];

    constructor(type: string, options?: Record<string, unknown>) {
      this.type = type;
      this.options = options;
    }

    validator(fn: (value: unknown) => boolean) {
      this.calls.push({ method: "validator", args: [fn] });
      return this;
    }

    PID(cfg: Record<string, unknown>) {
      this.calls.push({ method: "PID", args: [cfg] });
      return this;
    }

    min(n: number) {
      this.calls.push({ method: "min", args: [n] });
      return this;
    }

    max(n: number) {
      this.calls.push({ method: "max", args: [n] });
      return this;
    }

    description(text: string) {
      this.calls.push({ method: "description", args: [text] });
      return this;
    }
  }

  return { FieldBuilder: MockFieldBuilder };
});

// Import after the mock so field.ts uses our mocked FieldBuilder
import { field } from "../src/field";

// Small helper to fetch a recorded call by method name
const getCall = (fb: any, method: string) =>
  fb.calls.find((c: any) => c.method === method);

// Helper to run the first validator that was attached and return its boolean result
const runFirstValidator = (fb: any, value: unknown) => {
  const call = getCall(fb, "validator");
  if (!call) throw new Error("No validator attached");
  const fn = call.args[0] as (v: unknown) => boolean;
  return fn(value);
};

// --- Tests ---

describe("field factory basics", () => {
  it("string/number/boolean create FieldBuilder of correct type", () => {
    const s = field.string();
    const n = field.number();
    const b = field.boolean();

    expect(s.type).toBe("string");
    expect(n.type).toBe("number");
    expect(b.type).toBe("boolean");
  });
});

describe("validators: email/phone/url/uuid", () => {
  it("email wires PID, validator, and description and validates", () => {
    const fb = field.email() as any;
    expect(fb.type).toBe("string");

    // PID + description were set
    expect(getCall(fb, "PID").args[0]).toMatchObject({
      classification: "high",
      action: "encrypt",
    });
    expect(getCall(fb, "description").args[0]).toMatch(/email address/i);

    // Validator behaves sensibly
    expect(runFirstValidator(fb, "user@example.com")).toBe(true);
    expect(runFirstValidator(fb, "not-an-email")).toBe(false);
  });

  it("phone wires PID and validates", () => {
    const fb = field.phone() as any;
    expect(getCall(fb, "PID").args[0]).toMatchObject({
      classification: "high",
      action: "encrypt",
    });
    expect(getCall(fb, "description").args[0]).toMatch(/phone number/i);
    expect(runFirstValidator(fb, "+442079460018")).toBe(true);
    expect(runFirstValidator(fb, "123")).toBe(false);
    expect(runFirstValidator(fb, "123 123 123")).toBe(false);
    expect(runFirstValidator(fb, "+441234567890123456")).toBe(false);
  });

  it("url wires PID and validates", () => {
    const fb = field.url() as any;
    expect(getCall(fb, "PID").args[0]).toMatchObject({
      classification: "low",
      action: "hash",
    });
    expect(getCall(fb, "description").args[0]).toMatch(/url/i);
    expect(runFirstValidator(fb, "https://example.com/path")).toBe(true);
    expect(runFirstValidator(fb, "ht!tp://bad-url")).toBe(false);
  });

  it("uuid wires PID and validates", () => {
    const fb = field.uuid() as any;
    expect(getCall(fb, "PID").args[0]).toMatchObject({
      classification: "low",
      action: "hash",
    });
    expect(getCall(fb, "description").args[0]).toMatch(/uuid/i);
    expect(runFirstValidator(fb, "550e8400-e29b-41d4-a716-446655440000")).toBe(
      true
    );
    expect(runFirstValidator(fb, "not-a-uuid")).toBe(false);
  });
});

describe("date/time validators", () => {
  it("dateTimeISO validates full ISO 8601 date-time", () => {
    const fb = field.dateTimeISO() as any;
    expect(getCall(fb, "description").args[0]).toMatch(/ISO 8601/);
    expect(runFirstValidator(fb, "2023-10-05T14:30:00Z")).toBe(true);
    expect(runFirstValidator(fb, "2023-13-02T23:04:05Z")).toBe(false);
    expect(runFirstValidator(fb, "2023-11-02T28:04:05Z")).toBe(false);
  });

  it("dateISO (date only) validates", () => {
    const fb = field.dateISO() as any;
    expect(getCall(fb, "description").args[0]).toMatch(/date only/i);
    expect(runFirstValidator(fb, "2024-02-29")).toBe(true); // leap day valid
    expect(runFirstValidator(fb, "2024-02-30")).toBe(false);
  });

  it("timeISO (time only) validates", () => {
    const fb = field.timeISO() as any;
    expect(getCall(fb, "description").args[0]).toMatch(/time only/i);
    expect(runFirstValidator(fb, "23:59:59")).toBe(true);
    expect(runFirstValidator(fb, "24:00:00")).toBe(false);
  });
});

describe("text validators", () => {
  it("richText uses validateRichText and marks lower sensitivity", () => {
    const fb = field.richText() as any;
    expect(getCall(fb, "PID").args[0]).toMatchObject({
      classification: "low",
      action: "clear",
    });
    expect(runFirstValidator(fb, "<p>Hello</p>")).toBe(true);
    expect(runFirstValidator(fb, "<script>alert('x')</script>")).toBe(false);
  });

  it("generalText uses validateSafeText", () => {
    const fb = field.generalText() as any;
    expect(getCall(fb, "PID").args[0]).toMatchObject({
      classification: "none",
      action: "none",
    });
    expect(runFirstValidator(fb, "Just a sentence.")).toBe(true);
    expect(runFirstValidator(fb, "<b>Not allowed</b>")).toBe(false);
  });
});

describe("geo & versioning", () => {
  it("latitude enforces -90..90", () => {
    const fb = field.latitude() as any;
    expect(getCall(fb, "min").args[0]).toBe(-90);
    expect(getCall(fb, "max").args[0]).toBe(90);
    expect(getCall(fb, "description").args[0]).toMatch(/WGS 84/);
  });

  it("longitude enforces -180..180", () => {
    const fb = field.longitude() as any;
    expect(getCall(fb, "min").args[0]).toBe(-180);
    expect(getCall(fb, "max").args[0]).toBe(180);
    expect(getCall(fb, "description").args[0]).toMatch(/WGS 84/);
  });

  it("version uses semver validator", () => {
    const fb = field.version() as any;
    expect(getCall(fb, "description").args[0]).toMatch(/semantic version/i);
    expect(runFirstValidator(fb, "1.2.3")).toBe(true);
    expect(runFirstValidator(fb, "1.2")).toBe(false);
  });
});

describe("codes: country & language", () => {
  it("countryCode uses ISO 3166 validator", () => {
    const fb = field.countryCode() as any;
    expect(getCall(fb, "description").args[0]).toMatch(/ISO 3166/i);
    expect(runFirstValidator(fb, "GB")).toBe(true);
    expect(runFirstValidator(fb, "ZZ")).toBe(false);
  });

  it("languageCode uses BCP 47 validator", () => {
    const fb = field.languageCode() as any;
    expect(getCall(fb, "description").args[0]).toMatch(/BCP 47/i);
    expect(runFirstValidator(fb, "en")).toBe(true);
    expect(runFirstValidator(fb, "en-GB")).toBe(true);
    expect(runFirstValidator(fb, "english-UK")).toBe(false);
  });
});
