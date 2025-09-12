type FieldType = "string" | "number" | "boolean" | "object" | "array" | "ref";

import { type PII } from "./pii.js";
import { getSchemaForType } from "./schema.js";

export class FieldBuilder<TExternal = unknown, TInternal = TExternal> {
  _type!: TExternal;
  _storageType!: TInternal;
  isSystem = false;
  isImmutable = false;
  isRequired = true;
  validatorFn?: (value: any) => boolean;
  _description: string = "";
  _version: string = "1.0";
  shape?: Record<string, FieldBuilder<any>>;
  itemType?: FieldBuilder<any>;
  refType?: string;
  _pii: PII = {
    classification: "none",
    action: "none",
    logHandling: "plain",
    purpose: "an ordinary value",
  };
  enumValues?: readonly TInternal[];

  constructor(
    public type: FieldType,
    options: {
      shape?: Record<string, FieldBuilder<any>>;
      itemType?: FieldBuilder<any>;
      refType?: string;
    } = {}
  ) {
    this.shape = options.shape;
    this.itemType = options.itemType;
    this.refType = options.refType;
  }

  immutable(): FieldBuilder<TExternal, TInternal> {
    this.isImmutable = true;
    return this;
  }

  system(): FieldBuilder<TExternal, TInternal> {
    this.isSystem = true;
    return this;
  }

  required(): FieldBuilder<TExternal, TInternal> {
    this.isRequired = true;
    return this;
  }

  optional(): FieldBuilder<TExternal, TInternal> {
    this.isRequired = false;
    return this;
  }

  validator(
    fn: (value: TInternal) => boolean
  ): FieldBuilder<TExternal, TInternal> {
    this.validatorFn = fn;
    return this;
  }

  description(desc: string): FieldBuilder<TExternal, TInternal> {
    this._description = desc;
    return this;
  }

  version(ver: string): FieldBuilder<TExternal, TInternal> {
    this._version = ver;
    return this;
  }

  /// PID informs the schema PII handling of the manner in
  /// which to handle data relating to this field.
  PID(pii: PII): FieldBuilder<TExternal, TInternal> {
    this._pii = pii;
    return this;
  }

  enum<const U extends readonly TInternal[]>(
    values: U
  ): FieldBuilder<U[number]> {
    if (
      this.type !== "string" &&
      this.type !== "number" &&
      !(
        this.type === "array" &&
        (this.itemType?.type === "string" || this.itemType?.type === "number")
      )
    ) {
      throw new Error(
        "Enums are only supported on string or number fields or arrays of strings or numbers."
      );
    }
    this.enumValues = values;
    return this as any;
  }

  as<U>(): FieldBuilder<U, TInternal> {
    const clone = new FieldBuilder<U, TInternal>(this.type, {
      shape: this.shape,
      itemType: this.itemType,
    });
    clone.enumValues = this.enumValues;
    clone.isImmutable = this.isImmutable;
    clone.isSystem = this.isSystem;
    clone.isRequired = this.isRequired;
    clone._description = this._description;
    clone._version = this._version;
    clone._pii = this._pii;
    clone.validatorFn = this.validatorFn as any;
    return clone;
  }
}

export default FieldBuilder;
