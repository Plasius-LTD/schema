import FieldBuilder from "./field.builder.js";
import { Infer } from "./infer.js";
import { PII, PIIAction, PIIClassification, PIILogHandling } from "./pii.js";

export type FieldTypeMap = {
  string: string;
  number: number;
  boolean: boolean;
  object: Record<string, unknown>;
  "string[]": string[];
  "number[]": number[];
  "boolean[]": boolean[];
  "object[]": Record<string, unknown>[];
  ref: RefEntityId;
  "ref[]": RefEntityId[];
};

export type FieldType = keyof FieldTypeMap;

export type PIIEnforcement = "strict" | "warn" | "none";

export interface SchemaOptions {
  version?: string;
  table?: string;
  schemaValidator?: (value: any) => boolean;
  piiEnforcement?: PIIEnforcement; // How should PII be enforced?
}
export type SchemaShape = Record<string, FieldBuilder<any>>;

export interface FieldDefinition<T = unknown> {
  type: FieldType;
  __valueType?: T;
  optional?: boolean;
  immutable?: boolean;
  description?: string;
  refType?: string;
  version?: string;
  deprecated?: boolean;
  deprecatedVersion?: string;
  system?: boolean;
  autoValidate?: boolean;
  refPolicy?: "eager" | "lazy";
  enum?: string[];
  _shape?: SchemaShape;
  pii?: PII;
  validator?: (value: any) => boolean;
}

export interface ValidateCompositionOptions {
  resolveEntity: (type: string, id: string) => Promise<any | null>;
  validatorContext?: { visited: Set<string> };
  maxDepth?: number;
  log?: (msg: string) => void; // Optional for trace/debug
  onlyFields?: string[]; // NEW
}

export interface Schema<T extends SchemaShape> {
  //// The shape of the schema.
  _shape: T;

  //// System metadata about the schema
  meta: { entityType: string; version: string };

  //// Methods for schema validation
  schemaValidator: (entity: Infer<T>) => boolean;

  // Validate an input object against the schema
  validate: (
    input: unknown,
    existing?: Record<string, any>
  ) => ValidationResult<Infer<T>>;

  // Validate an input object against the schema, with options for composition validation
  validateComposition: (
    entity: Infer<T>,
    options: ValidateCompositionOptions
  ) => Promise<void>;

  //// Optional methods for schema metadata

  // Get the tableName for this schema
  tableName?: () => string | undefined; // Optional method to get the table name

  //// 🔒 Optional methods for PII handling

  // 🔒 Auto-prepare for read (decrypt PII)
  prepareForRead(
    stored: Record<string, any>,
    decryptFn: (value: string) => any | null
  ): Record<string, any>;

  // 🔒 Auto-prepare for storage (encrypt/hash PII)
  prepareForStorage(
    input: Record<string, any>,
    encryptFn: (value: any) => string,
    hashFn: (value: any) => string
  ): Record<string, any>;

  // 🔒 Sanitize data for logging (e.g., redact PII)
  sanitizeForLog(
    data: Record<string, any>,
    pseudonymFn: (value: any) => string
  ): Record<string, any>;

  // 🔒 Get PII audit information
  getPiiAudit(): Array<{
    field: string;
    classification: PIIClassification;
    action: PIIAction;
    logHandling?: PIILogHandling;
    purpose?: string;
  }> | null;

  // 🔒 Scrub PII for deletion (e.g., clear or hash sensitive data)
  scrubPiiForDelete(stored: Record<string, any>): Record<string, any>;

  describe(): {
    entityType: string;
    version: string;
    shape: Record<
      string,
      {
        type: FieldType;
        optional: boolean;
        immutable: boolean;
        description: string;
        version: string;
        deprecated: boolean;
        deprecatedVersion: string | null;
        system: boolean;
        enum: string[] | null;
        refType: string | null;
        pii: PII | null;
      }
    >;
  };
}

export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? T[K] extends (...args: any[]) => any
      ? T[K]
      : DeepReadonly<T[K]>
    : T[K];
};

export interface ValidationResult<T> {
  valid: boolean;
  value?: DeepReadonly<T>;
  errors?: string[];
}

export type RefEntityId<T extends string = string> = {
  type: T;
  id: string;
};
