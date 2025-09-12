import { describe, it, expect } from "vitest";
import { userSchema } from "./test-utils.js";

describe("validate()", () => {
  it("validates correct object", () => {
    const input = {
      type: "user",
      version: "1.0",
      name: "Alice",
      bestFriend: { type: "user", id: "user-123" },
      characters: [{ type: "character", id: "char-1" }],
    };

    const result = userSchema.validate(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("detects missing required field", () => {
    const input = {
      type: "user",
      version: "1.0",
      bestFriend: { type: "user", id: "user-123" },
      characters: [],
    };

    const result = userSchema.validate(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: name");
  });

  it("detects invalid ref shape", () => {
    const input = {
      type: "user",
      version: "1.0",
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
});
