import { describe, it, expect } from "vitest";
import { createSchema, field } from "../src/index.js";

// Define the new-style schema using field() builders.
const userSchema = createSchema(
  {
    name: field
      .string()
      // simple custom rule to prove validator hooks are exercised
      .validator((v) => typeof v === "string" && v.trim().length >= 2),

    // Best friend is a reference to another user entity
    bestFriend: field.ref("user"),

    // Characters is an array of references to character entities
    characters: field.array(field.ref("character")),
  },
  "user",
  { version: "1.0.0", piiEnforcement: "strict" }
);

// Example of a compiled/standalone validator function consumers might use
// (wrapping the schema.validate for ergonomics/perf in app code)
const isValidUser = (input: unknown) => userSchema.validate(input as any).valid;

describe("validate() with field()-based schema", () => {
  it("validates a correct object", () => {
    const input = {
      type: "user",
      version: "1.0.0",
      name: "Alice",
      bestFriend: { type: "user", id: "user-123" },
      characters: [{ type: "character", id: "char-1" }],
    };

    const result = userSchema.validate(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("detects missing required field (name)", () => {
    const input = {
      type: "user",
      version: "1.0.0",
      bestFriend: { type: "user", id: "user-123" },
      characters: [],
    };

    const result = userSchema.validate(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: name");
  });

  it("detects invalid ref shape for bestFriend", () => {
    const input = {
      type: "user",
      version: "1.0.0",
      name: "Test",
      bestFriend: { id: "user-123" }, // missing type
      characters: [],
    };

    const result = userSchema.validate(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Field bestFriend must be { type: string; id: string }"
    );
  });

  // --- Additional tests proving field-level validators are executed ---
  it("rejects name that fails custom validator (too short)", () => {
    const input = {
      type: "user",
      version: "1.0.0",
      name: "A", // too short per custom validator
      bestFriend: { type: "user", id: "user-123" },
      characters: [],
    };
    const result = userSchema.validate(input);
    expect(result.valid).toBe(false);
    // be tolerant to exact wording, but ensure the error points at `name`
    expect(
      result.errors?.some((e: string) => e.toLowerCase().includes("name"))
    ).toBe(true);
  });

  it("accepts name that passes custom validator (>=2 chars)", () => {
    const input = {
      type: "user",
      version: "1.0.0",
      name: "Al",
      bestFriend: { type: "user", id: "user-123" },
      characters: [],
    };
    expect(isValidUser(input)).toBe(true);
  });
});
