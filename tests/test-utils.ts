// tests/test-utils.ts
import { createSchema } from "../src/schema.js";
import { Infer } from "../src/infer.js";
import { field } from "../src/field.js";
import { expect } from "vitest";
import { ValidationResult } from "../src/types.js";
import { SchemaShape, validateUUID } from "../src/index.js";

// Mock "character" schema
export const characterSchema = createSchema(
  {
    name: field.string().description("Character name").version("1.0.0"),
  },
  "character"
);
export type Character = Infer<typeof characterSchema>;

const userShape: SchemaShape = {
  id: field.string().system().validator(validateUUID).immutable(),
  name: field.string().description("User name").version("1.0.0"),

  bestFriend: field
    .string()
    .optional()
    .description("User's best friend ID")
    .version("1.0.0")
    .validator(validateUUID),

  characters: field
    .array(field.ref("character").as<Character>())
    .optional()
    .description("Characters owned by this user")
    .version("1.0.0"),
};
// Mock "user" schema
export const userSchema = createSchema(userShape, "user");

export type User = Infer<typeof userSchema>;

// Simple in-memory mock "DB"
export const mockDb: {
  [key: string]: {
    type: string;
    version: string;
    name: string;
    bestFriend?: { type: string; id: string };
    characters?: { type: string; id: string }[];
  };
} = {
  "user:user-1": {
    type: "user",
    version: "1.0.0",
    name: "Alice",
    bestFriend: { type: "user", id: "user-2" },
    characters: [{ type: "character", id: "char-1" }],
  },
  "user:user-2": {
    type: "user",
    version: "1.0.0",
    name: "Bob",
    bestFriend: { type: "user", id: "user-1" }, // cycle!
    characters: [],
  },
  "character:char-1": {
    type: "character",
    version: "1.0.0",
    name: "Hero",
  },
};

// Mock resolver
export async function mockResolveEntity(type: string, id: string) {
  const key = `${type}:${id}`;
  return mockDb[key] ?? null;
}

export function expectValid<T>(result: ValidationResult<T>) {
  if (!result.valid) {
    console.error("Validation failed with errors:", result.errors);
  }
  expect(result.valid).toBe(true);
}

export function expectInvalid<T>(
  result: ValidationResult<T>,
  expectedErrorSubstring: string
) {
  if (result.valid) {
    console.error("Expected failure but got valid result!");
  } else {
    console.log("Validation errors:", result.errors);
  }
  expect(result.valid).toBe(false);
  expect(
    result.errors?.some((e) => e.includes(expectedErrorSubstring)) ?? false
  ).toBe(true);
}