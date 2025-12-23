import { describe, expect, it } from "vitest";
import { createSchema, field, renderSchemaDescription } from "../src/index.js";

describe("Known issues coverage", () => {
  it("should mark optional fields as optional in describe()", () => {
    const S = createSchema(
      { opt: field.string().optional(), req: field.string() },
      "OptionalDescribe",
      { version: "1.0.0", piiEnforcement: "strict" }
    );

    const meta = S.describe();
    expect(meta.shape.opt.optional).toBe(true);
    expect(meta.shape.req.optional).toBe(false);
  });

  it("should respect the actual ref type in composition validation", async () => {
    const RefSchema = createSchema({ id: field.string() }, "asset", {
      version: "1.0.0",
      piiEnforcement: "strict",
    });

    const Holder = createSchema(
      { ref: field.ref<typeof RefSchema["_shape"]>("asset") },
      "Holder",
      { version: "1.0.0", piiEnforcement: "strict" }
    );

    const refValue = { type: "other", id: "x1" };

    await expect(
      Holder.validateComposition(
        { type: "Holder", version: "1.0.0", ref: refValue } as any,
        { resolveEntity: async () => null, maxDepth: 0 }
      )
    ).rejects.toThrow(/Reference type mismatch/);
  });

  it("renderSchemaDescription should surface field descriptions", () => {
    const S = createSchema(
      { title: field.string().description("A human readable title") },
      "DescTest",
      { version: "1.0.0", piiEnforcement: "strict" }
    );

    const rendered = renderSchemaDescription(S);
    const title = rendered.fields.find((f) => f.name === "title");
    expect(title?.description).toBe("A human readable title");
  });
});
