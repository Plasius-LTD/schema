import { Infer } from "./infer.js";
import { FieldType, Schema, SchemaOptions, SchemaShape } from "./types.js";
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

const globalSchemaRegistry = new Map<string, Schema<any>>();

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

function isOptional(def: any): boolean {
  return (def?.isRequired ?? false) === false;
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
    const childValue = obj[childKey];

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
      const childValue = (item as any)[childKey];

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
            const childValue = ref[childKey];
            if (
              (childValue === undefined || childValue === null) &&
              !isOptional(childDef)
            ) {
              errors.push(
                `Missing required field: ${path}[${idx}].${childKey}`
              );
              continue;
            }
            const childValidator = getValidator(childDef);
            if (
              childValidator &&
              childValue !== undefined &&
              childValue !== null
            ) {
              const valid = childValidator(childValue);
              if (!valid)
                errors.push(
                  `Invalid value for field: ${path}[${idx}].${childKey}`
                );
            }
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
  _def: any,
  errors: string[]
) {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof value.type !== "string" ||
    typeof value.id !== "string"
  ) {
    const path = parentKey ? `${parentKey}.${key}` : key;
    errors.push(`Field ${path} must be { type: string; id: string }`);
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
    version: "1.0",
    table: "",
    schemaValidator: () => true,
    piiEnforcement: "none",
  }
): Schema<S> {
  const systemFields = {
    type: field.string().immutable().system(),
    version: field.string().immutable().system(),
  };

  const version = options.version || "1.0";
  const store = options.table || "";
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

      if (!(input as any).type || !(input as any).version) {
        (input as any).type = entityType;
        (input as any).version = version;
      }

      for (const key in schema._shape) {
        const def = schema._shape[key];
        const value = (input as any)[key];

        if (!def) {
          errors.push(`Field definition missing for: ${key}`);
          continue;
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

        // 4) Custom validator
        const { invalid } = runCustomValidator("", key, value, def, errors);
        if (invalid) continue;

        // 5) Type-specific validation
        validateByType("", key, value, def, errors);

        // Assign value regardless; storage transforms happen elsewhere
        result[key] = value;
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

    // 🔗 Validate composition (references) recursively
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

        const refType = (def as any).refType as string;
        const autoValidate = (def as any).autoValidate !== false;
        const refPolicy = (def as any).refPolicy ?? "eager";
        const value = (entity as any)[key];
        if (!value) continue;

        if (def.type === "ref") {
          const ref = value as { type: string; id: string };
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
          const refs = value as Array<{ type: string; id: string }>;
          for (const ref of refs) {
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

    tableName(): string {
      if (!store || store === "") {
        throw new Error("Store is not defined for this schema");
      }
      return store;
    },

    // 🔒 Auto-prepare for storage (encrypt/hash PII)
    prepareForStorage(
      input: Record<string, any>,
      encryptFn: (value: any) => string,
      hashFn: (value: any) => string
    ): Record<string, any> {
      return piiPrepareForStorage(_shape, input, encryptFn, hashFn);
    },

    prepareForRead(
      stored: Record<string, any>,
      decryptFn: (value: string) => any
    ): Record<string, any> {
      return piiPrepareForRead(_shape, stored, decryptFn);
    },

    // 🔍 Sanitize for logging (redact/pseudonymize PII)
    sanitizeForLog(
      data: Record<string, any>,
      pseudonymFn: (value: any) => string
    ): Record<string, any> {
      return piiSanitizeForLog(_shape, data, pseudonymFn);
    },

    getPiiAudit(): Array<{
      field: string;
      classification: PIIClassification;
      action: PIIAction;
      logHandling?: PIILogHandling;
      purpose?: string;
    }> {
      return piiGetPiiAudit(_shape);
    },

    scrubPiiForDelete(stored: Record<string, any>): Record<string, any> {
      return piiScrubPiiForDelete(_shape, stored);
    },

    describe() {
      const description: Record<string, any> = {};
      for (const [key, def] of Object.entries(schema._shape)) {
        description[key] = {
          type: def.type,
          optional: !!def.optional,
          description: def._description ?? "",
          version: def._version ?? "",
          enum: getEnumValues(def as any),
          refType: (def as any).refType ?? undefined,
          pii: def._pii ?? undefined,
        };
      }

      return {
        entityType,
        version,
        shape: description,
      };
    },
  };

  // Register the schema globally
  globalSchemaRegistry.set(entityType, schema);
  return schema;
}

// 🔗 Retrieve a previously registered schema globally
export function getSchemaForType(type: string): Schema<any> | undefined {
  return globalSchemaRegistry.get(type);
}

// 🔗 Retrieve all registered schemas globally
export function getAllSchemas(): Schema<any>[] {
  return Array.from(globalSchemaRegistry.values());
}

/**
 * Renders a schema description to a simplified frontend-consumable format.
 * This can be used in UIs for schema explorers, documentation, or admin tools.
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