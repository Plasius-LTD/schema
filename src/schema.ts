import { Infer } from "./infer.js";
import {
  FieldType,
  Schema,
  SchemaOptions,
  SchemaShape,
  SchemaUpgradeResult,
  SchemaUpgradeSpec,
} from "./types.js";
import { field } from "./field.js";
import { PIIAction, PIIClassification, PIILogHandling } from "./pii.js";
import {
  enforcePIIField,
  prepareForStorage as piiPrepareForStorage,
  prepareForRead as piiPrepareForRead,
  sanitizeForLog as piiSanitizeForLog,
  getPiiAudit as piiGetPiiAudit,
  scrubPiiForDelete as piiScrubPiiForDelete,
} from "./pii.js";
import { FieldBuilder } from "./field.builder.js";
import { validateSemVer } from "./validation/version.SEMVER2.0.0.js";

const globalSchemaRegistry = new Map<string, Schema<any>>();

function cmpSemver(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10));
  const pb = b.split(".").map((n) => parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }
  return 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: apply schema upgrade using SchemaUpgradeSpec (function or cascading steps)
// ──────────────────────────────────────────────────────────────────────────────
function applySchemaUpgrade(
  spec: SchemaUpgradeSpec,
  input: Record<string, any>,
  ctx: {
    from: string;
    to: string;
    entityType: string;
    describe: () => { entityType: string; version: string; shape: Record<string, any> };
    log?: (msg: string) => void;
  }
): SchemaUpgradeResult {
  // Single universal upgrader
  if (typeof spec === "function") {
    return spec(input, ctx);
  }

  // Cascading steps: sort by target version, then apply those between from..to
  const steps = [...spec].sort((s1, s2) => cmpSemver(s1.to, s2.to));
  let working: Record<string, any> = { ...input };
  let fromVersion = ctx.from;

  for (const step of steps) {
    // Apply step if it advances beyond current `from` and does not exceed target `to`
    if (cmpSemver(fromVersion, step.to) < 0 && cmpSemver(step.to, ctx.to) <= 0) {
      ctx.log?.(`Upgrading entity from v${fromVersion} → v${step.to}`);
      const res = step.run(working, { ...ctx, from: fromVersion, to: step.to });
      if (!res || res.ok !== true || !res.value) {
        return {
          ok: false,
          errors: res?.errors?.length
            ? res.errors
            : [`Failed to upgrade entity from v${fromVersion} to v${step.to}`],
        };
      }
      working = res.value;
      fromVersion = step.to;
    }
  }

  // If no steps applied or we stopped before ctx.to, the caller will normalize type/version.
  return { ok: true, value: working };
}

function validateEnum(
  parentKey: string,
  value: any,
  enumValues?: Array<string | number>
): string | undefined {
  if (!enumValues) return;

  const values = Array.isArray(enumValues)
    ? enumValues
    : Array.from(enumValues);

  if (Array.isArray(value)) {
    const invalid = value.filter((v) => !values.includes(v));
    if (invalid.length > 0) {
      return `Field ${parentKey} contains invalid enum values: ${invalid.join(
        ", "
      )}`;
    }
  } else {
    if (!values.includes(value)) {
      return `Field ${parentKey} must be one of: ${values.join(", ")}`;
    }
  }
}

// Helper: some builders may store enum/optional/validator under different keys
// schema.ts
function getEnumValues(def: any): Array<string | number> | undefined {
  const src = Array.isArray(def?.enum)
    ? def.enum
    : Array.isArray(def?.enumValues)
    ? def.enumValues
    : Array.isArray(def?._enum)
    ? def._enum
    : Array.isArray(def?._enumValues)
    ? def._enumValues
    : def?._enumSet instanceof Set
    ? Array.from(def._enumSet)
    : undefined;

  if (!src) return undefined;
  const ok = src.every(
    (v: unknown) => typeof v === "string" || typeof v === "number"
  );
  return ok ? (src as Array<string | number>) : undefined;
}

// Apply default value when provided and input is nullish
function applyDefault(
  def: any,
  current: any
): { value: any; applied: boolean } {
  if (
    (current === undefined || current === null) &&
    typeof def?.getDefault === "function"
  ) {
    const next = def.getDefault();
    if (next !== undefined) {
      return { value: next, applied: true };
    }
  }
  return { value: current, applied: false };
}

function isOptional(def: any): boolean {
  return def?.isRequired === false;
}

function getValidator(def: any): ((v: any) => boolean) | undefined {
  return def?._validator ?? undefined;
}

function getShape(def: any): Record<string, any> | undefined {
  return def?._shape ?? def?.shape ?? undefined;
}

// ──────────────────────────────────────────────────────────────────────────────
// Validation helpers (extracted from validate())
// ──────────────────────────────────────────────────────────────────────────────

function checkMissingRequired(
  parentKey: string,
  key: string,
  value: any,
  def: any,
  errors: string[]
): { missing: boolean } {
  if (value === undefined || value === null) {
    const path = parentKey ? `${parentKey}.${key}` : key;
    if (!isOptional(def)) {
      errors.push(`Missing required field: ${path}`);
    }
    return { missing: true };
  }
  return { missing: false };
}

function checkImmutable(
  parentKey: string,
  key: string,
  value: any,
  def: any,
  existing: Record<string, any> | undefined,
  errors: string[]
): { immutableViolation: boolean } {
  if (
    def.isImmutable &&
    existing &&
    existing[key] !== undefined &&
    value !== existing[key]
  ) {
    const path = parentKey ? `${parentKey}.${key}` : key;
    errors.push(`Field is immutable: ${path}`);
    return { immutableViolation: true };
  }
  return { immutableViolation: false };
}

function runCustomValidator(
  parentKey: string,
  key: string,
  value: any,
  def: any,
  errors: string[]
): { invalid: boolean } {
  const validator = getValidator(def);
  if (validator && value !== undefined && value !== null) {
    const valid = validator(value);
    if (!valid) {
      const path = parentKey ? `${parentKey}.${key}` : key;
      errors.push(`Invalid value for field: ${path}`);
      return { invalid: true };
    }
  }
  return { invalid: false };
}

function validateStringField(
  parentKey: string,
  key: string,
  value: any,
  def: any,
  errors: string[]
) {
  const path = parentKey ? `${parentKey}.${key}` : key;
  if (typeof value !== "string") {
    errors.push(`Field ${path} must be string`);
    return;
  }

  const enumValues = getEnumValues(def);
  if (Array.isArray(enumValues)) {
    const enumError = validateEnum(path, value, enumValues);
    if (enumError) {
      errors.push(enumError);
    }
  }
}

function validateNumberField(
  parentKey: string,
  key: string,
  value: any,
  _def: any,
  errors: string[]
) {
  const enumPath = parentKey ? `${parentKey}.${key}` : key;
  if (typeof value !== "number") {
    errors.push(`Field ${enumPath} must be number`);
  }
}

function validateBooleanField(
  parentKey: string,
  key: string,
  value: any,
  _def: any,
  errors: string[]
) {
  const path = parentKey ? `${parentKey}.${key}` : key;
  if (typeof value !== "boolean") {
    errors.push(`Field ${path} must be boolean`);
  }
}

function validateObjectChildren(
  parentKey: string,
  obj: any,
  shape: Record<string, any>,
  errors: string[]
) {
  for (const [childKey, childDef] of Object.entries(shape) as [
    string,
    FieldBuilder<any>
  ][]) {
    let childValue = obj[childKey];

    // Apply defaults before required checks
    const { value: withDefault, applied } = applyDefault(childDef, childValue);
    if (applied) {
      obj[childKey] = withDefault;
      childValue = withDefault;
    }

    // Required check
    const { missing } = checkMissingRequired(
      parentKey,
      childKey,
      childValue,
      childDef,
      errors
    );
    if (missing) continue;

    // Custom validator (per-field)
    const { invalid } = runCustomValidator(
      parentKey,
      childKey,
      childValue,
      childDef,
      errors
    );
    if (invalid) continue;

    // Type-specific validation (string/number/boolean/object/array/ref)
    // This will recurse into nested objects via validateObjectField → validateObjectChildren
    validateByType(parentKey, childKey, childValue, childDef, errors);
  }
}

function validateObjectField(
  parentKey: string,
  key: string,
  value: any,
  def: any,
  errors: string[]
) {
  const path = parentKey ? `${parentKey}.${key}` : key;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    errors.push(`Field ${path} must be object`);
    return;
  }
  const objShape = getShape(def);
  if (objShape) validateObjectChildren(path, value, objShape, errors);
}

function validateArrayOfStrings(
  parentKey: string,
  key: string,
  arr: any[],
  itemDef: any,
  errors: string[]
) {
  const path = parentKey ? `${parentKey}.${key}` : key;
  if (!arr.every((v) => typeof v === "string")) {
    errors.push(`Field ${path} must be string[]`);
    return;
  }
  const enumValues = getEnumValues(itemDef);
  if (Array.isArray(enumValues)) {
    const enumError = validateEnum(path, arr, enumValues);
    if (enumError) {
      errors.push(enumError);
    }
  }

  const validator = getValidator(itemDef);
  if (validator) {
    arr.forEach((v, idx) => {
      if (!validator(v)) {
        errors.push(`Invalid value for field: ${path}[${idx}]`);
      }
    });
  }
}

function validateArrayOfNumbers(
  parentKey: string,
  key: string,
  arr: any[],
  itemDef: any,
  errors: string[]
) {
  const path = parentKey ? `${parentKey}.${key}` : key;
  if (!arr.every((v) => typeof v === "number")) {
    errors.push(`Field ${path} must be number[]`);
  }

  const enumValues = getEnumValues(itemDef);
  if (Array.isArray(enumValues)) {
    const enumError = validateEnum(path, arr, enumValues);
    if (enumError) {
      errors.push(enumError);
    }
  }

  const validator = getValidator(itemDef);
  if (validator) {
    arr.forEach((v, idx) => {
      if (!validator(v)) {
        errors.push(`Invalid value for field: ${path}[${idx}]`);
      }
    });
  }
}

function validateArrayOfBooleans(
  parentKey: string,
  key: string,
  arr: any[],
  _itemDef: any,
  errors: string[]
) {
  const path = parentKey ? `${parentKey}.${key}` : key;
  if (!arr.every((v) => typeof v === "boolean")) {
    errors.push(`Field ${path} must be boolean[]`);
  }

  const validator = getValidator(_itemDef);
  if (validator) {
    arr.forEach((v, idx) => {
      if (!validator(v)) {
        errors.push(`Invalid value for field: ${path}[${idx}]`);
      }
    });
  }
}

function validateArrayOfObjects(
  parentKey: string,
  key: string,
  arr: any[],
  itemDef: any,
  errors: string[]
) {
  const path = parentKey ? `${parentKey}.${key}` : key;

  if (
    !Array.isArray(arr) ||
    !arr.every((v) => typeof v === "object" && v !== null && !Array.isArray(v))
  ) {
    errors.push(`Field ${path} must be object[]`);
    return;
  }

  const itemShape = getShape(itemDef);
  if (!itemShape) return;

  arr.forEach((item, idx) => {
    const itemParent = `${path}[${idx}]`;
    for (const [childKey, childDef] of Object.entries(itemShape) as [
      string,
      FieldBuilder<any>
    ][]) {
      let childValue = (item as any)[childKey];

      const { value: withDefault, applied } = applyDefault(
        childDef,
        childValue
      );
      if (applied) {
        (item as any)[childKey] = withDefault;
        childValue = withDefault;
      }

      // Required check (path-aware)
      const { missing } = checkMissingRequired(
        itemParent,
        childKey,
        childValue,
        childDef,
        errors
      );
      if (missing) continue;

      // Custom validator (path-aware)
      const { invalid } = runCustomValidator(
        itemParent,
        childKey,
        childValue,
        childDef,
        errors
      );
      if (invalid) continue;

      // Type-specific validation (recurses into nested object/array/ref)
      validateByType(itemParent, childKey, childValue, childDef, errors);
    }
  });
}

function validateArrayField(
  parentKey: string,
  key: string,
  value: any,
  def: any,
  errors: string[]
) {
  const path = parentKey ? `${parentKey}.${key}` : key;
  if (!Array.isArray(value)) {
    errors.push(`Field ${key} must be an array`);
    return;
  }
  const itemType = def.itemType?.type;
  if (itemType === "string")
    return validateArrayOfStrings(parentKey, key, value, def.itemType, errors);
  if (itemType === "number")
    return validateArrayOfNumbers(parentKey, key, value, def.itemType, errors);
  if (itemType === "boolean")
    return validateArrayOfBooleans(parentKey, key, value, def.itemType, errors);
  if (itemType === "object")
    return validateArrayOfObjects(parentKey, key, value, def.itemType, errors);
  if (itemType === "ref") {
    const expectedType = (def.itemType as any).refType;
    value.forEach((ref: any, idx: number) => {
      if (
        !ref ||
        typeof ref !== "object" ||
        ref === null ||
        typeof ref.type !== "string" ||
        typeof ref.id !== "string" ||
        (expectedType && ref.type !== expectedType)
      ) {
        errors.push(
          `Field ${path}[${idx}] must be a reference object with type: ${expectedType}`
        );
      }
    });
    const refShape = getShape(def.itemType);
    if (refShape) {
      value.forEach((ref: any, idx: number) => {
        if (ref && typeof ref === "object" && ref !== null) {
          for (const [childKey, childDef] of Object.entries(refShape) as [
            string,
            FieldBuilder<any>
          ][]) {
            const childPath = `${path}[${idx}].${childKey}`;
            let childValue = ref[childKey];
            const { value: withDefault, applied } = applyDefault(
              childDef,
              childValue
            );
            if (applied) {
              ref[childKey] = withDefault;
              childValue = withDefault;
            }
            if (
              (childValue === undefined || childValue === null) &&
              !isOptional(childDef)
            ) {
              errors.push(`Missing required field: ${childPath}`);
              continue;
            }
            const childValidator = getValidator(childDef);
            if (
              childValidator &&
              childValue !== undefined &&
              childValue !== null
            ) {
              const valid = childValidator(childValue);
              if (!valid) {
                errors.push(`Invalid value for field: ${childPath}`);
                continue;
              }
            }

            validateByType(
              `${path}[${idx}]`,
              childKey,
              childValue,
              childDef,
              errors
            );
          }
        }
      });
    }
    return;
  }
  errors.push(`Field ${path} has unsupported array item type`);
}

function validateRefField(
  parentKey: string,
  key: string,
  value: any,
  def: any,
  errors: string[]
) {
  const path = parentKey ? `${parentKey}.${key}` : key;
  if (
    typeof value !== "object" ||
    value === null ||
    typeof value.type !== "string" ||
    typeof value.id !== "string"
  ) {
    errors.push(`Field ${path} must be { type: string; id: string }`);
    return;
  }

  const expectedType = (def as any).refType;
  if (expectedType && value.type !== expectedType) {
    errors.push(
      `Field ${path} must reference type: ${expectedType} (got ${value.type})`
    );
  }
}

  function validateByType(
    parentKey: string,
    key: string,
    value: any,
    def: any,
    errors: string[]
  ) {
    const path = parentKey ? `${parentKey}.${key}` : key;
  switch (def.type) {
    case "string":
      return validateStringField(parentKey, key, value, def, errors);
    case "number":
      return validateNumberField(parentKey, key, value, def, errors);
    case "boolean":
      return validateBooleanField(parentKey, key, value, def, errors);
    case "object":
      return validateObjectField(parentKey, key, value, def, errors);
    case "array":
      return validateArrayField(parentKey, key, value, def, errors);
    case "ref":
      return validateRefField(parentKey, key, value, def, errors);
    default:
      errors.push(`Unknown type for field ${path}: ${def.type}`);
  }
}

export function createSchema<S extends SchemaShape>(
  _shape: S,
  entityType: string,
  options: SchemaOptions = {
    version: "1.0.0",
    table: "",
    schemaValidator: () => true,
    piiEnforcement: "none",
    schemaUpgrade: undefined,
  }
): Schema<S> {
  const systemFields = {
    type: field.string().immutable().system(),
    version: field.string().immutable().system().validator(validateSemVer),
  };

  const version = options.version || "1.0.0";
  const store = options.table || "";

  // Optional schema-level upgrader supplied by the caller via options.schemaUpgrade
  const schemaUpgrade: SchemaUpgradeSpec | undefined = (options as any)
    .schemaUpgrade;

  const schema: Schema<S> = {
    // 🔗 Define the schema shape
    _shape: {
      ...systemFields,
      ..._shape,
    } as S,

    // 🔗 Metadata about the schema
    meta: { entityType, version },

    // 🔗 Validate input against the schema
    validate(input: unknown, existing?: Record<string, any>) {
      const errors: string[] = [];
      const result: any = {};

      if (typeof input !== "object" || input === null) {
        return { valid: false, errors: ["Input must be an object"] } as any;
      }
      // Work on a non-mutating copy that includes system defaults for first-time objects
      const working: Record<string, any> = { ...(input as any) };
      if (working.type == null) working.type = entityType;
      if (working.version == null) working.version = version;

      // ── Schema-level upgrade (runs once before any field checks) ─────────────
      const fromVersion = String(working.version ?? "0.0.0");
      const toVersion = String(version);
      if (schemaUpgrade && cmpSemver(fromVersion, toVersion) < 0) {
        const upgradeRes = applySchemaUpgrade(schemaUpgrade, { ...working }, {
          from: fromVersion,
          to: toVersion,
          entityType,
          describe: () => schema.describe(),
        });
        if (!upgradeRes || upgradeRes.ok !== true || !upgradeRes.value) {
          const errs = upgradeRes?.errors?.length
            ? upgradeRes.errors
            : [`Failed to upgrade entity from v${fromVersion} to v${toVersion}`];
          errors.push(...errs);
          // Stop early if the schema-level migration itself failed
          return { valid: false, errors } as any;
        }
        // Use the upgraded value as our new working copy
        for (const k of Object.keys(working)) delete (working as any)[k];
        Object.assign(working, upgradeRes.value);
        // Ensure system defaults remain correct after user migration
        working.type = entityType;
        working.version = toVersion;
      }

      for (const key in schema._shape) {
        const def = schema._shape[key];
        let value = working[key];

        if (!def) {
          errors.push(`Field definition missing for: ${key}`);
          continue;
        }

        // Apply defaults before required/validation checks
        const { value: withDefault, applied } = applyDefault(def, value);
        if (applied) {
          working[key] = withDefault;
          value = withDefault;
        }

        // 1) Required
        const { missing } = checkMissingRequired("", key, value, def, errors);
        if (missing) continue;

        // 2) Immutable
        const { immutableViolation } = checkImmutable(
          "",
          key,
          value,
          def,
          existing,
          errors
        );
        if (immutableViolation) continue;

        // 3) PII enforcement (may short-circuit)
        const { shortCircuit } = enforcePIIField(
          "",
          key,
          value,
          def,
          options.piiEnforcement ?? "none",
          errors,
          console
        );
        if (shortCircuit) continue;

        // A local validator for this field that returns errors instead of pushing into the outer array
        const validateField = (val: any): string[] => {
          const localErrors: string[] = [];
          const { invalid } = runCustomValidator(
            "",
            key,
            val,
            def,
            localErrors
          );
          if (!invalid) {
            validateByType("", key, val, def, localErrors);
          }
          return localErrors;
        };

        // First pass validation
        let fieldValue = value;
        let fieldErrors = validateField(fieldValue);

        // Attempt upgrade if invalid and an upgrader exists and entity is older than schema
        const entityFrom = String(working.version ?? "0.0.0");
        const entityTo = String(version);
        const fieldTo = String((def as any)._version ?? entityTo);
        const hasUpgrader = typeof (def as any)._upgrade === "function";

        if (
          fieldErrors.length > 0 &&
          hasUpgrader &&
          cmpSemver(entityFrom, entityTo) < 0
        ) {
          const up = (def as any)._upgrade as (
            value: any,
            ctx: {
              entityFrom: string;
              entityTo: string;
              fieldTo: string;
              fieldName: string;
            }
          ) => { ok: boolean; value?: any; error?: string };

          const res = up(fieldValue, {
            entityFrom,
            entityTo,
            fieldTo,
            fieldName: key,
          });
          if (res && res.ok) {
            fieldValue = res.value;
            fieldErrors = validateField(fieldValue);
          } else {
            fieldErrors.push(
              res?.error ||
                `Failed to upgrade field ${key} from v${entityFrom} to v${entityTo}`
            );
          }
        }

        result[key] = fieldValue;
        // Apply or record errors
        if (fieldErrors.length !== 0) {
          errors.push(...fieldErrors);
          continue;
        }
      }

      if (errors.length === 0 && options.schemaValidator) {
        const castValue = result as Infer<S>;
        if (!options.schemaValidator(castValue)) {
          errors.push("Schema-level validation failed.");
        }
      }

      return {
        valid: errors.length === 0,
        value: result as Infer<S>,
        errors,
      };
    },

    // specific validator for a schema to allow conditional validation
    schemaValidator: options.schemaValidator!, // <== expose it here!

    /**
     * Runs the optional schema-level upgrade function once, without validating.
     * Useful for offline migrations or testing migration logic.
     */
    upgrade(
      input: Record<string, any>,
      log?: (msg: string) => void
    ): {
      ok: boolean;
      value?: Record<string, any>;
      errors?: string[];
    } {
      const fromVersion = String((input as any)?.version ?? "0.0.0");
      const toVersion = String(version);
      if (!schemaUpgrade || cmpSemver(fromVersion, toVersion) >= 0) {
        // Nothing to do – already current or no upgrader provided.
        return {
          ok: true,
          value: { ...input, type: entityType, version: toVersion },
        };
      }
      const res = applySchemaUpgrade(
        schemaUpgrade,
        { ...(input as any) },
        {
          from: fromVersion,
          to: toVersion,
          entityType,
          describe: () => schema.describe(),
          log,
        }
      );
      if (res && res.ok && res.value) {
        const out = { ...res.value, type: entityType, version: toVersion };
        return { ok: true, value: out };
      }
      return {
        ok: false,
        errors: res?.errors?.length
          ? res.errors
          : [`Failed to upgrade entity from v${fromVersion} to v${toVersion}`],
      };
    },

    /**
     * Recursively validates entity references defined in this schema.
     *
     * Traverses fields of type `ref` and arrays of `ref` and resolves each target
     * entity using the provided `resolveEntity` function. When `autoValidate` is
     * enabled (default) and the field's `refPolicy` is `eager`, the referenced
     * entity's schema is fetched and validated via `validateComposition` up to
     * `maxDepth` levels.
     *
     * Skips fields not listed in `onlyFields` when provided. Prevents cycles via
     * a `visited` set in `validatorContext`.
     *
     * @param entity The root entity to validate (must include `type` and `id`).
     * @param options Options controlling traversal and resolution behavior.
     * @param options.resolveEntity Function to resolve a referenced entity by type and id.
     * @param options.validatorContext Internal context (visited set) to prevent cycles.
     * @param options.maxDepth Maximum depth for recursive validation (default: 5).
     * @param options.onlyFields Optional whitelist of field names to validate.
     * @param options.log Optional logger for traversal/debug output.
     *
     * @throws Error if a broken reference is encountered (target cannot be resolved).
     */
    async validateComposition(entity, options) {
      const {
        resolveEntity,
        validatorContext = { visited: new Set() },
        maxDepth = 5,
        log,
      } = options;

      const entityKey = `${(entity as any).type}:${(entity as any).id}`;
      if (validatorContext.visited.has(entityKey)) {
        log?.(`Skipping already visited entity ${entityKey}`);
        return;
      }
      validatorContext.visited.add(entityKey);
      log?.(`Validating composition for entity ${entityKey}`);

      for (const [key, def] of Object.entries(schema._shape)) {
        // NEW: skip if not in onlyFields
        if (options.onlyFields && !options.onlyFields.includes(key)) {
          log?.(`Skipping field ${key} (not in onlyFields)`);
          continue;
        }

        const autoValidate = (def as any).autoValidate !== false;
        const refPolicy = (def as any).refPolicy ?? "eager";
        const value = (entity as any)[key];
        if (!value) continue;

        if (def.type === "ref") {
          const refType = (def as any).refType as string;
          if (!refType)
            throw new Error(`Missing refType for reference field ${key}`);
          const ref = value as { type: string; id: string };
          if (ref.type && ref.type !== refType) {
            throw new Error(
              `Reference type mismatch for field ${key}: expected ${refType}, got ${ref.type}`
            );
          }
          const target = await options.resolveEntity(refType, ref.id);
          if (!target)
            throw new Error(
              `Broken reference: ${refType} ${ref.id} in field ${key}`
            );
          log?.(`Resolved ${refType} ${ref.id} from field ${key}`);

          if (autoValidate && refPolicy === "eager") {
            const targetSchema = getSchemaForType(refType);
            if (options.maxDepth! > 0 && targetSchema) {
              await targetSchema.validateComposition(target, {
                ...options,
                maxDepth: options.maxDepth! - 1,
              });
            }
          }
          // Handle array of refs: type === "array" and itemType?.type === "ref"
        } else if (def.type === "array" && def.itemType?.type === "ref") {
          const refType = (def.itemType as any).refType as string;
          if (!refType)
            throw new Error(`Missing refType for reference array field ${key}`);
          const refs = value as Array<{ type: string; id: string }>;
          for (const ref of refs) {
            if (ref.type && ref.type !== refType) {
              throw new Error(
                `Reference type mismatch for field ${key}: expected ${refType}, got ${ref.type}`
              );
            }
            const target = await options.resolveEntity(refType, ref.id);
            if (!target)
              throw new Error(
                `Broken reference: ${refType} ${ref.id} in field ${key}`
              );
            log?.(`Resolved ${refType} ${ref.id} from field ${key}`);

            if (autoValidate && refPolicy === "eager") {
              const targetSchema = getSchemaForType(refType);
              if (options.maxDepth! > 0 && targetSchema) {
                await targetSchema.validateComposition(target, {
                  ...options,
                  maxDepth: options.maxDepth! - 1,
                });
              }
            }
          }
        }
      }
    },

    /**
     * Returns the configured table name for this schema.
     *
     * @throws Error if no store/table name has been defined for this schema.
     */
    tableName(): string {
      if (!store || store === "") {
        throw new Error("Store is not defined for this schema");
      }
      return store;
    },

    /**
     * Transforms an input object for persistence by applying PII protection
     * according to field annotations (e.g., encryption and hashing).
     *
     * @param input The raw entity data.
     * @param encryptFn Function used to encrypt sensitive values.
     * @param hashFn Function used to hash sensitive values.
     * @returns A new object safe to store.
     */
    prepareForStorage(
      input: Record<string, any>,
      encryptFn: (value: any) => string,
      hashFn: (value: any) => string
    ): Record<string, any> {
      return piiPrepareForStorage(_shape, input, encryptFn, hashFn);
    },

    /**
     * Reverses storage transformations for read paths (e.g., decrypts values)
     * according to PII annotations, returning a consumer-friendly object.
     *
     * @param stored Data retrieved from storage.
     * @param decryptFn Function used to decrypt values that were encrypted on write.
     * @returns A new object suitable for application consumption.
     */
    prepareForRead(
      stored: Record<string, any>,
      decryptFn: (value: string) => any
    ): Record<string, any> {
      return piiPrepareForRead(_shape, stored, decryptFn);
    },

    /**
     * Produces a log-safe copy of the provided data by redacting or pseudonymizing
     * PII fields in accordance with field annotations.
     *
     * @param data Arbitrary data to sanitize for logging.
     * @param pseudonymFn Function producing stable pseudonyms for sensitive values.
     * @returns A copy safe to emit to logs.
     */
    sanitizeForLog(
      data: Record<string, any>,
      pseudonymFn: (value: any) => string
    ): Record<string, any> {
      return piiSanitizeForLog(_shape, data, pseudonymFn);
    },

    /**
     * Returns a list of fields annotated with PII metadata for auditing purposes.
     * Each entry includes classification, required action, and optional log policy.
     */
    getPiiAudit(): Array<{
      field: string;
      classification: PIIClassification;
      action: PIIAction;
      logHandling?: PIILogHandling;
      purpose?: string;
    }> {
      return piiGetPiiAudit(_shape);
    },

    /**
     * Produces a copy of stored data suitable for data deletion flows by scrubbing
     * or blanking PII per field annotations.
     *
     * @param stored Data as persisted.
     * @returns A copy with PII removed or neutralized for deletion.
     */
    scrubPiiForDelete(stored: Record<string, any>): Record<string, any> {
      return piiScrubPiiForDelete(_shape, stored);
    },

    /**
     * Returns a normalized description of the schema suitable for documentation
     * or UI rendering (type, optionality, enum values, PII flags, etc.).
     */
    describe() {
      const description: Record<string, any> = {};
      for (const [key, def] of Object.entries(schema._shape)) {
        description[key] = {
          type: def.type,
          optional: isOptional(def),
          immutable: !!def.isImmutable,
          system: !!def.isSystem,
          description: def._description ?? "",
          version: def._version ?? "",
          deprecated: (def as any).deprecated ?? false,
          deprecatedVersion: (def as any).deprecatedVersion ?? null,
          enum: getEnumValues(def as any),
          refType: (def as any).refType ?? undefined,
          pii: def._pii ?? undefined,
        };
      }

      return {
        entityType,
        version,
        hasSchemaUpgrade: !!schemaUpgrade,
        shape: description,
      };
    },
  };

  // Register the schema globally
  globalSchemaRegistry.set(entityType, schema);
  return schema;
}

/**
 * Retrieves a previously registered schema by its `entityType` from the
 * in-process global schema registry.
 */
export function getSchemaForType(type: string): Schema<any> | undefined {
  return globalSchemaRegistry.get(type);
}

/**
 * Returns all schemas registered in the in-process global registry.
 */
export function getAllSchemas(): Schema<any>[] {
  return Array.from(globalSchemaRegistry.values());
}

/**
 * Renders a schema into a simplified descriptor for front-end consumption.
 * Intended for documentation and admin tooling rather than validation.
 */
export function renderSchemaDescription(
  schema: Schema<any>
): {
  title: string;
  fields: Array<{
    name: string;
    type: FieldType;
    optional: boolean;
    description: string;
    deprecated: boolean;
    pii?: string;
  }>;
} {
  const meta = schema.describe();
  return {
    title: `${meta.entityType} (v${meta.version})`,
    fields: Object.entries(meta.shape).map(([name, def]) => ({
      name,
      type: def.type,
      optional: def.optional,
      description: def.description,
      deprecated: def.deprecated,
      pii: def.pii ? def.pii.classification : undefined,
    })),
  };
}
