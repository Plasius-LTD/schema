import { describe, it, expect } from "vitest";
import { createSchema } from "../src/schema.js";
import { field } from "../src/field.js";

describe("createSchema", () => {
  it("should create schema with correct meta", () => {
    const schemaShape = {
      name: field.string().required(),
      age: field.number().optional(),
      bestFriend: field.ref("user"),
      friends: field.array(field.ref("user")),
    };

    const schema = createSchema(schemaShape, "user", {
      version: "1.0",
      piiEnforcement: "strict",
      table: "user",
    });

    expect(schema.meta.entityType).toBe("user");
    expect(schema.meta.version).toBe("1.0");

    expect(schema.shape.name.type).toBe("string");
    expect(schema.shape.age.type).toBe("number");
    expect(schema.shape.bestFriend.type).toBe("ref");
    expect(schema.shape.friends.type).toBe("array");
    expect(schema.shape.friends.itemType?.type).toBe("ref");
  });
});
