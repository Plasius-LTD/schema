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

  it("validates ref array child fields using their validators", () => {
    const refWithShape = field.ref("asset") as any;
    refWithShape._shape = { active: field.boolean() };

    const Collection = createSchema(
      { assets: field.array(refWithShape) },
      "Collection",
      { version: "1.0.0", piiEnforcement: "strict" }
    );

    const result = Collection.validate({
      assets: [{ type: "asset", id: "a1", active: "yes" }],
    });

    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("assets[0].active"))).toBe(
      true
    );
  });

  it("runs item validators for arrays of primitives", () => {
    const WithTags = createSchema(
      { tags: field.array(field.string().pattern(/^ok$/)) },
      "WithTags",
      { version: "1.0.0", piiEnforcement: "strict" }
    );

    const result = WithTags.validate({ tags: ["bad"] });
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("tags"))).toBe(true);
  });

  it("rejects ref fields with the wrong refType during validate", () => {
    const Holder = createSchema({ ref: field.ref("asset") }, "Holder", {
      version: "1.0.0",
      piiEnforcement: "strict",
    });

    const result = Holder.validate({ ref: { type: "other", id: "x1" } });
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("asset"))).toBe(true);
  });

  it("describe() surfaces system/immutable/deprecation metadata", () => {
    const S = createSchema(
      {
        id: field.string().immutable().system(),
        name: field.string().optional(),
      },
      "Meta",
      { version: "1.2.3", piiEnforcement: "strict" }
    );

    const meta = S.describe();
    expect(meta.shape.id.system).toBe(true);
    expect(meta.shape.id.immutable).toBe(true);
    expect(meta.shape.id.version).toBe("1.0.0");
    expect(meta.shape.id.deprecated).toBe(false);
    expect(meta.shape.id.deprecatedVersion).toBeNull();

    expect(meta.shape.name.optional).toBe(true);
    expect(meta.shape.name.system).toBe(false);
    expect(meta.shape.name.immutable).toBe(false);
  });
});
