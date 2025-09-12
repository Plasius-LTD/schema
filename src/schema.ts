import { Infer } from "./infer.js";
import { FieldType, Schema, SchemaOptions, SchemaShape } from "./types.js";
import { field } from "./field.js";
import { PIIAction, PIIClassification, PIILogHandling } from "./pii.js";
import { FieldBuilder } from "./field.builder.js";

const globalSchemaRegistry = new Map<string, Schema<any>>();

function validateEnum(
  key: string,
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
      return `Field ${key} contains invalid enum values: ${invalid.join(", ")}`;
    }
  } else {
    if (!values.includes(value)) {
      return `Field ${key} must be one of: ${values.join(", ")}`;
    }
  }
}

export function createSchema<S extends SchemaShape>(
  shape: S,
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
    shape: {
      ...systemFields,
      ...shape,
    } as S,

    // 🔗 Metadata about the schema
    meta: { entityType, version },

    // 🔗 Validate input against the schema
    validate(input: unknown, existing?: Record<string, any>) {
      const errors: string[] = [];
      const result: any = {};

      if (typeof input !== "object" || input === null) {
        return { valid: false, errors: ["Input must be an object"] };
      }

      for (const key in schema.shape) {
        const fieldDef = schema.shape[key];
        const value = (input as any)[key];

        // Guard against missing field definitions to satisfy TypeScript
        if (!fieldDef) {
          errors.push(`Field definition missing for: ${key}`);
          continue;
        }

        if (value === undefined || value === null) {
          if (!(fieldDef.optional ?? false)) {
            errors.push(`Missing required field: ${key}`);
          }
          continue;
        }

        // Immutable check
        if (
          fieldDef.isImmutable &&
          existing &&
          existing[key] !== undefined &&
          value !== existing[key]
        ) {
          errors.push(`Field is immutable: ${key}`);
          continue;
        }

        // PII classification awareness (optional validation)
        // PII enforcement
        if (
          fieldDef._pii?.classification === "high" &&
          fieldDef.isRequired === true
        ) {
          const missing = value === undefined || value === null || value === "";
          if (missing) {
            const msg = `High PII field must not be empty: ${key}`;
            if (
              options.piiEnforcement === "strict" ||
              !options.piiEnforcement
            ) {
              errors.push(msg);
            } else if (options.piiEnforcement === "warn") {
              console.warn(`WARN (PII Enforcement): ${msg}`);
            }
            // If "none" — do nothing
            if (
              options.piiEnforcement !== "none" &&
              options.piiEnforcement !== "warn"
            ) {
              continue; // prevent adding invalid value
            }
          }
        }
        // Validator check
        if (fieldDef.validator && value !== undefined && value !== null) {
          const valid = fieldDef.validator(value);
          if (!valid) {
            errors.push(`Invalid value for field: ${key}`);
            continue;
          }
        }

        switch (fieldDef.type) {
          case "string":
            if (typeof value !== "string")
              errors.push(`Field ${key} must be string`);
            else {
              const enumValues = (fieldDef as any).enum;
              if (Array.isArray(enumValues)) {
                const enumError = validateEnum(key, value, enumValues);
                if (enumError) errors.push(enumError);
              }
            }
            break;
          case "number":
            if (typeof value !== "number")
              errors.push(`Field ${key} must be number`);
            break;
          case "boolean":
            if (typeof value !== "boolean")
              errors.push(`Field ${key} must be boolean`);
            break;
          case "object":
            if (
              typeof value !== "object" ||
              value === null ||
              Array.isArray(value)
            ) {
              errors.push(`Field ${key} must be object`);
            } else if (fieldDef.shape) {
              for (const [childKey, childDef] of Object.entries(
                fieldDef.shape
              ) as [string, FieldBuilder<any>][]) {
                const childValue = value[childKey];
                if (
                  (childValue === undefined || childValue === null) &&
                  !childDef.optional
                ) {
                  errors.push(`Missing required field: ${key}.${childKey}`);
                  continue;
                }
                if (
                  childDef.validator &&
                  childValue !== undefined &&
                  childValue !== null
                ) {
                  const valid = childDef.validator(childValue);
                  if (!valid) {
                    errors.push(`Invalid value for field: ${key}.${childKey}`);
                  }
                }
                // Recursively validate nested object shapes
                if (
                  childDef.type === "object" &&
                  childDef.shape &&
                  childValue !== undefined &&
                  childValue !== null
                ) {
                  // Call validate recursively for nested objects
                  // We can use similar logic as above, but for brevity, call the same logic recursively:
                  const nestedErrors: string[] = [];
                  for (const [grandChildKey, grandChildDef] of Object.entries(
                    childDef.shape
                  ) as [string, FieldBuilder<any>][]) {
                    const grandChildValue = childValue[grandChildKey];
                    if (
                      (grandChildValue === undefined ||
                        grandChildValue === null) &&
                      !grandChildDef.optional
                    ) {
                      nestedErrors.push(
                        `Missing required field: ${key}.${childKey}.${grandChildKey}`
                      );
                      continue;
                    }
                    if (
                      grandChildDef.validator &&
                      grandChildValue !== undefined &&
                      grandChildValue !== null
                    ) {
                      const valid = grandChildDef.validator(grandChildValue);
                      if (!valid) {
                        nestedErrors.push(
                          `Invalid value for field: ${key}.${childKey}.${grandChildKey}`
                        );
                      }
                    }
                  }
                  if (nestedErrors.length > 0) {
                    errors.push(...nestedErrors);
                  }
                }
              }
            }
            break;
          case "array":
            if (!Array.isArray(value)) {
              errors.push(`Field ${key} must be an array`);
            } else if (fieldDef.itemType?.type === "string") {
              if (!value.every((v) => typeof v === "string")) {
                errors.push(`Field ${key} must be string[]`);
              } else {
                const enumValues = (fieldDef.itemType as any)?.enum;
                if (Array.isArray(enumValues)) {
                  const enumError = validateEnum(key, value, enumValues);
                  if (enumError) errors.push(enumError);
                }
              }
            } else if (fieldDef.itemType?.type === "number") {
              if (!value.every((v) => typeof v === "number")) {
                errors.push(`Field ${key} must be number[]`);
              }
            } else if (fieldDef.itemType?.type === "boolean") {
              if (!value.every((v) => typeof v === "boolean")) {
                errors.push(`Field ${key} must be boolean[]`);
              }
            } else if (fieldDef.itemType?.type === "object") {
              if (
                !value.every(
                  (v) =>
                    typeof v === "object" && v !== null && !Array.isArray(v)
                )
              ) {
                errors.push(`Field ${key} must be object[]`);
              } else if (fieldDef.itemType.shape) {
                value.forEach((item, idx) => {
                  for (const [childKey, childDef] of Object.entries(
                    fieldDef.itemType!.shape!
                  )) {
                    const childValue = item[childKey];
                    if (
                      (childValue === undefined || childValue === null) &&
                      !childDef.optional
                    ) {
                      errors.push(
                        `Missing required field: ${key}[${idx}].${childKey}`
                      );
                      continue;
                    }
                    if (
                      childDef.validator &&
                      childValue !== undefined &&
                      childValue !== null
                    ) {
                      const valid = childDef.validator(childValue);
                      if (!valid) {
                        errors.push(
                          `Invalid value for field: ${key}[${idx}].${childKey}`
                        );
                      }
                    }
                  }
                });
              }
            } else if (fieldDef.itemType?.type === "ref") {
              const expectedType = (fieldDef.itemType as any).refType;
              value.forEach((ref, idx) => {
                if (
                  !ref ||
                  typeof ref !== "object" ||
                  ref === null ||
                  typeof ref.type !== "string" ||
                  typeof ref.id !== "string" ||
                  (expectedType && ref.type !== expectedType)
                ) {
                  errors.push(
                    `Field ${key}[${idx}] must be a reference object with type: ${expectedType}`
                  );
                }
              });
              // If the ref also defines a shape, validate recursively
              if ((fieldDef.itemType as any).shape) {
                value.forEach((ref, idx) => {
                  if (ref && typeof ref === "object" && ref !== null) {
                    for (const [childKey, childDef] of Object.entries(
                      fieldDef.shape ?? {}
                    ) as [string, FieldBuilder<any>][]) {
                      const childValue = ref[childKey];
                      if (
                        (childValue === undefined || childValue === null) &&
                        !childDef.optional
                      ) {
                        errors.push(
                          `Missing required field: ${key}[${idx}].${childKey}`
                        );
                        continue;
                      }
                      if (
                        childDef.validator &&
                        childValue !== undefined &&
                        childValue !== null
                      ) {
                        const valid = childDef.validator(childValue);
                        if (!valid) {
                          errors.push(
                            `Invalid value for field: ${key}[${idx}].${childKey}`
                          );
                        }
                      }
                    }
                  }
                });
              }
            } else {
              errors.push(`Field ${key} has unsupported array item type`);
            }
            break;
          // 🚀 NEW: validate ref
          case "ref":
            if (
              typeof value !== "object" ||
              value === null ||
              typeof value.type !== "string" ||
              typeof value.id !== "string"
            ) {
              errors.push(`Field ${key} must be { type: string; id: string }`);
            }
            break;
          default:
            errors.push(
              `Unknown type for field ${key}: ${(fieldDef as any).type}`
            );
        }

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

      for (const [key, def] of Object.entries(schema.shape)) {
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
      const result: any = {};
      for (const key in shape) {
        const field = shape[key];
        if (!field) continue;
        const value = input[key];

        if (field._pii?.action === "encrypt") {
          result[key + "Encrypted"] = encryptFn(value);
        } else if (field._pii?.action === "hash") {
          result[key + "Hash"] = hashFn(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    },

    prepareForRead(
      stored: Record<string, any>,
      decryptFn: (value: string) => any
    ): Record<string, any> {
      const result: any = {};
      for (const key in shape) {
        const field = shape[key];
        if (!field) continue;

        if (field._pii?.action === "encrypt") {
          result[key] = decryptFn(stored[key + "Encrypted"]);
        } else {
          result[key] = stored[key];
        }
      }
      return result;
    },
    // 🔍 Sanitize for logging (redact/pseudonymize PII)
    sanitizeForLog(
      data: Record<string, any>,
      pseudonymFn: (value: any) => string
    ): Record<string, any> {
      const output: any = {};
      for (const key in shape) {
        const field = shape[key];
        if (!field) continue;
        const value = data[key];

        if (field._pii?.logHandling === "omit") continue;
        if (field._pii?.logHandling === "redact") {
          output[key] = "[REDACTED]";
        } else if (field._pii?.logHandling === "pseudonym") {
          output[key] = pseudonymFn(value);
        } else {
          output[key] = value;
        }
      }
      return output;
    },
    getPiiAudit(): Array<{
      field: string;
      classification: PIIClassification;
      action: PIIAction;
      logHandling?: PIILogHandling;
      purpose?: string;
    }> {
      const piiFields: Array<any> = [];

      for (const key in shape) {
        const field = shape[key];
        if (!field) continue;
        if (field._pii && field._pii.classification !== "none") {
          piiFields.push({
            field: key,
            classification: field._pii.classification,
            action: field._pii.action,
            logHandling: field._pii.logHandling,
            purpose: field._pii.purpose,
          });
        }
      }

      return piiFields;
    },

    scrubPiiForDelete(stored: Record<string, any>): Record<string, any> {
      const result: any = { ...stored };

      for (const key in shape) {
        const field = shape[key];
        if (!field) continue;

        if (field._pii?.action === "encrypt") {
          result[key + "Encrypted"] = null;
        } else if (field._pii?.action === "hash") {
          result[key + "Hash"] = null;
        } else if (field._pii?.action === "clear") {
          result[key] = null;
        }
        // else: not PII — leave unchanged
      }

      return result;
    },

    describe() {
      const description: Record<string, any> = {};
      for (const [key, def] of Object.entries(schema.shape)) {
        description[key] = {
          type: def.type,
          optional: !!def.optional,
          description: def._description ?? "",
          version: def._version ?? "",
          enum: (def as any).enum ?? undefined,
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