import { describe, it, expect } from "vitest";
import { field } from "../src/field";
import { createSchema } from "../src/schema";

/**
 * This test verifies that when an older entity (v1.0.0) is validated against a newer
 * schema (v2.0.0), a field-level `.upgrade()` function is invoked to transform the
 * value into the new shape, and that validation passes with the upgraded value.
 */

describe("schema field upgrade flow", () => {
  it("upgrades old displayName string → new object shape", () => {
    const userV2 = createSchema(
      {
        // v2 requires an object { given, family } instead of a plain string
        displayName: field
          .object({
            given: field.string().required(),
            family: field.string().required(),
          })
          .version("2.0.0")
          .upgrade((value, { entityFrom, entityTo, fieldTo, fieldName }) => {
            if (typeof value === "string") {
              const parts = value.trim().split(/\s+/);
              const given = parts.shift() ?? "";
              const family = parts.join(" ") || "Unknown";
              return { ok: true, value: { given, family } };
            }
            return {
              ok: false,
              error: `Cannot upgrade ${fieldName} from non-string`,
            };
          }),
      },
      "User",
      { version: "2.0.0", table: "users" }
    );

    const oldEntity = {
      version: "1.0.0",
      displayName: "Ada Lovelace",
    } as const;

    const res = userV2.validate(oldEntity);
    // Expect our validation contract: no errors and transformed value
    expect(Array.isArray(res.errors)).toBe(true);
    expect(res.errors?.length).toBe(0);
    expect(res.value?.displayName).toEqual({
      given: "Ada",
      family: "Lovelace",
    });
  });

  it("fails validation when upgrade is not possible", () => {
    const userV2 = createSchema(
      {
        age: field
          .number()
          .version("2.0.0")
          .upgrade((value) => {
            // Only upgrade from numeric strings like "42"
            if (typeof value === "string" && /^\d+$/.test(value)) {
              return { ok: true, value: Number(value) };
            }
            return { ok: false, error: "age cannot be upgraded" };
          })
          .required(),
      },
      "User",
      { version: "2.0.0", table: "users" }
    );

    const oldEntity = { version: "1.0.0", age: "forty two" } as const;
    const res = userV2.validate(oldEntity);

    expect(Array.isArray(res.errors)).toBe(true);
    expect(res.errors?.length).toBeGreaterThan(0);
    // Should keep original invalid value when upgrade fails
    expect(res.value?.age).toBe("forty two");
  });
});
