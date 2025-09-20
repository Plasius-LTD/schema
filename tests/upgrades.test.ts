

import { describe, it, expect, vi } from "vitest";

// NOTE: These imports assume the public API shape. Adjust if your package re-exports differently.
import { createSchema } from "../src";
import type { SchemaUpgradeStep, SchemaUpgradeFunction } from "../src/types";

/**
 * Helper to build a minimal schema with a provided schemaUpgrade spec and target version.
 * We keep shape minimal to focus on upgrade behaviour rather than field validation.
 */
function makeSchema(
  entityType: string,
  version: string,
  schemaUpgrade: SchemaUpgradeStep[] | SchemaUpgradeFunction
) {
    return createSchema({
        
    }, entityType, { version, schemaUpgrade });
}

/**
 * Build a sample entity with explicit type/version so that "from" is well-defined.
 */
function entity(v: string, extra: Record<string, any> = {}) {
  return { type: "User", version: v, ...extra };
}

describe("schema upgrade (SchemaUpgradeSpec)", () => {
  it("applies cascading steps from the entity's current version up to the target", () => {
    const log = vi.fn();

    const steps: SchemaUpgradeStep[] = [
      {
        to: "1.1.0",
        run: (input) => {
          // mark first step
          const out = { ...input, s110: true };
          return { ok: true, value: out };
        },
      },
      {
        to: "2.0.0",
        run: (input) => {
          // mark second step
          const out = { ...input, s200: true };
          return { ok: true, value: out };
        },
      },
    ];

    const schema = makeSchema("User", "2.0.0", steps);

    const res = schema.upgrade(entity("1.0.0", { a: 1 }), (m) => log(m));

    expect(res.ok).toBe(true);
    expect(res.value).toBeTruthy();
    // Both steps should have applied
    expect(res.value).toMatchObject({ a: 1, s110: true, s200: true });

    // Optional: ensure logs were produced if the implementation logs per-step
    // We don't assert exact messages, just that something might have been logged
    // Comment this out if your implementation doesn't log.
    // expect(log).toHaveBeenCalled();
  });

  it("skips earlier steps when the entity is already beyond them", () => {
    const steps: SchemaUpgradeStep[] = [
      {
        to: "1.1.0",
        run: (input) => ({ ok: true, value: { ...input, s110: true } }),
      },
      {
        to: "1.2.0",
        run: (input) => ({ ok: true, value: { ...input, s120: true } }),
      },
      {
        to: "2.0.0",
        run: (input) => ({ ok: true, value: { ...input, s200: true } }),
      },
    ];

    const schema = makeSchema("User", "2.0.0", steps);

    // Start from 1.2.0 -> should only apply the 2.0.0 step
    const res = schema.upgrade(entity("1.2.0", { b: 2 }));

    expect(res.ok).toBe(true);
    expect(res.value).toBeTruthy();
    expect(res.value).toMatchObject({ b: 2, s200: true });
    // Ensure earlier step flags are not present
    expect(res.value).not.toHaveProperty("s110");
    expect(res.value).not.toHaveProperty("s120");
  });

  it("supports a single universal upgrader function", () => {
    const single: SchemaUpgradeFunction = (input, ctx) => {
      // Ensure ctx is passed and reflects requested versions
      expect(typeof ctx.from).toBe("string");
      expect(typeof ctx.to).toBe("string");
      expect(ctx.entityType).toBe("User");
      return { ok: true, value: { ...input, upgraded: `${ctx.from}->${ctx.to}` } };
    };

    const schema = makeSchema("User", "1.5.0", single);

    const res = schema.upgrade(entity("1.2.3", { name: "Ada" }));

    expect(res.ok).toBe(true);
    expect(res.value).toMatchObject({ name: "Ada", upgraded: "1.2.3->1.5.0" });
  });

  it("propagates errors from a failing step and halts", () => {
    const steps: SchemaUpgradeStep[] = [
      {
        to: "1.1.0",
        run: () => ({ ok: false, errors: ["boom"] }),
      },
      {
        to: "2.0.0",
        // This should never run if the first failed
        run: (input) => ({ ok: true, value: { ...input, shouldNotRun: true } }),
      },
    ];

    const schema = makeSchema("User", "2.0.0", steps);

    const res = schema.upgrade(entity("1.0.0", { c: 3 }));

    expect(res.ok).toBe(false);
    expect(res.errors).toBeTruthy();
    // Ensure the later step did not execute
    expect(res as any).not.toHaveProperty("value.shouldNotRun");
  });
});