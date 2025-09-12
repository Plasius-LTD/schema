import { describe, it, beforeAll } from "vitest";
import { createSchema } from "../src/schema.js";
import { field } from "../src/field.js";
import {
  registerComponentSchema,
  createComponentSchema,
} from "../src/components.js";
import { expectValid, expectInvalid } from "./test-utils";
import { Infer } from "../src/infer";
import { BaseComponent } from "@plasius/entity-types";

describe("Component schema validation", () => {
  beforeAll(() => {
    // Register some example component schemas
    createComponentSchema(
      {
        type: field
          .string()
          .system()
          .description("Physics component type")
          .version("1.0"),
        version: field
          .string()
          .system()
          .description("Physics component version")
          .version("1.0"),
        enabled: field
          .boolean()
          .description("Is the physics component enabled?")
          .version("1.0"),
        shape: field
          .string()
          .enum(["box", "sphere", "capsule"])
          .optional()
          .description("The shape of the physics collider")
          .version("1.0"),
        mass: field.number().optional(),
      },
      "physics",
      "1.0"
    );

    createComponentSchema(
      {
        type: field
          .string()
          .system()
          .description("Shadow component type")
          .version("1.0"),
        version: field
          .string()
          .system()
          .description("Shadow component version")
          .version("1.0"),
        casts: field
          .boolean()
          .description("Does this entity cast shadows?")
          .version("1.0"),
        receives: field
          .boolean()
          .description("Does this entity receive shadows?")
          .version("1.0"),
      },
      "shadow",
      "1.0"
    );
  });

  const modelAssetSchema = createSchema(
    {
      type: field.string().system(),
      version: field.string().system(),
      url: field.string(),
      components: field
        .array(
          field.object({
            type: field
              .string()
              .description("Type of the component")
              .version("1.0")
              .enum(["physics", "shadow", "animation"]),
            config: field.ref("baseComponent").as<BaseComponent>(),
          })
        )
        .description("List of components attached to this model asset")
        .version("1.0"),
    },
    "TestModel",
    { version: "1.0", piiEnforcement: "strict" }
  );

  it("validates a correct components array", () => {
    const result = modelAssetSchema.validate({
      type: "Test Component",
      version: "1.0",
      url: "https://example.com/model.glb",
      components: [
        {
          type: "physics",
          config: {
            type: "physics",
            version: "1.0",
            enabled: true,
            shape: "box",
            mass: 10,
          },
        },
        {
          type: "shadow",
          config: {
            type: "shadow",
            version: "1.0",
            casts: true,
            receives: false,
          },
        },
      ],
    });

    expectValid<Infer<typeof modelAssetSchema>>(result);
  });

  it("fails on unknown component type", () => {
    const result = modelAssetSchema.validate({
      type: "Test Component",
      version: "1.0",
      url: "https://example.com/model.glb",
      components: [
        {
          type: "unknownType",
          config: {
            version: "1.0",
            type: "unknownType",
          },
        },
      ],
    });

    expectInvalid<Infer<typeof modelAssetSchema>>(
      result,
      "Unknown component type 'unknownType' at components[0]"
    );
  });

  it("fails when component config is missing required fields", () => {
    const result = modelAssetSchema.validate({
      type: "Test Component",
      version: "1.0",
      url: "https://example.com/model.glb",
      components: [
        {
          type: "shadow",
          config: {
            type: "shadow",
            version: "1.0",
            casts: true,
            // receives is missing!
          },
        },
      ],
    });

    expectInvalid<Infer<typeof modelAssetSchema>>(
      result,
      "components[0].config.receives is required"
    );
  });

  it("fails when component config has wrong type", () => {
    const result = modelAssetSchema.validate({
      type: "Test Component",
      version: "1.0",
      url: "https://example.com/model.glb",
      components: [
        {
          type: "physics",
          config: {
            type: "physics",
            version: "1.0",
            enabled: "yes", // should be boolean
            shape: "triangle", // invalid enum value
          },
        },
      ],
    });

    expectInvalid<Infer<typeof modelAssetSchema>>(
      result,
      "Field components[0].config.shape must be one of: box, sphere, capsule"
    );
    expectInvalid<Infer<typeof modelAssetSchema>>(
      result,
      "Field components[0].config.shape must be one of: box, sphere, capsule"
    );
  });

  it("passes when optional component config is omitted", () => {
    const result = modelAssetSchema.validate({
      type: "Test Component",
      version: "1.0",
      url: "https://example.com/model.glb",
      components: [
        {
          type: "physics",
          config: {
            type: "physics",
            version: "1.0",
            enabled: true,
          },
        },
      ],
    });
    expectValid<Infer<typeof modelAssetSchema>>(result);
  });
});
