type FieldType = "string" | "number" | "boolean" | "object" | "array" | "ref";

import { type PII } from "./pii.js";
import { getSchemaForType } from "./schema.js";

export class FieldBuilder<TExternal = unknown, TInternal = TExternal> {
  _type!: TExternal;
  _storageType!: TInternal;
  isSystem = false;
  isImmutable = false;
  isRequired = true;
  _validator?: (value: any) => boolean;
  _description: string = "";
  _version: string = "1.0.0";
  _default?: TInternal | (() => TInternal);
  _upgrade?: (
    value: any,
    ctx: {
      entityFrom: string;
      entityTo: string;
      fieldTo: string;
      fieldName: string;
    }
  ) => { ok: boolean; value?: any; error?: string };
  _shape?: Record<string, FieldBuilder<any>>;
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
    this._shape = options.shape;
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
    this._validator = fn;
    return this;
  }

  description(desc: string): FieldBuilder<TExternal, TInternal> {
    this._description = desc;
    return this;
  }

  default(
    value: TInternal | (() => TInternal)
  ): FieldBuilder<TExternal, TInternal> {
    this._default = value;
    // Supplying a default implies the value may be omitted at input time.
    // Do not couple defaulting with validation.
    this.isRequired = false;
    return this;
  }

  /**
   * Configure an upgrader used when validating older entities against a newer schema.
   * The upgrader receives the current field value and version context, and should
   * return { ok: true, value } with the upgraded value, or { ok: false, error }.
   */
  upgrade(
    fn: (
      value: any,
      ctx: {
        entityFrom: string;
        entityTo: string;
        fieldTo: string;
        fieldName: string;
      }
    ) => { ok: boolean; value?: any; error?: string }
  ): FieldBuilder<TExternal, TInternal> {
    this._upgrade = fn;
    return this;
  }

  getDefault(): TInternal | undefined {
    const v = this._default;
    return typeof v === "function" ? (v as () => TInternal)() : v;
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

  min(min: number): FieldBuilder<TExternal, TInternal> {
    if (this.type === "number") {
      const prevValidator = this._validator;
      this._validator = (value: any) => {
        const valid = typeof value === "number" && value >= min;
        return prevValidator ? prevValidator(value) && valid : valid;
      };
    } else if (this.type === "string") {
      const prevValidator = this._validator;
      this._validator = (value: any) => {
        const valid = typeof value === "string" && value.length >= min;
        return prevValidator ? prevValidator(value) && valid : valid;
      };
    } else if (this.type === "array") {
      const prevValidator = this._validator;
      this._validator = (value: any) => {
        const valid = Array.isArray(value) && value.length >= min;
        return prevValidator ? prevValidator(value) && valid : valid;
      };
    } else {
      throw new Error(
        "Min is only supported on number, string, or array fields."
      );
    }
    return this;
  }

  max(max: number): FieldBuilder<TExternal, TInternal> {
    if (this.type === "number") {
      const prevValidator = this._validator;
      this._validator = (value: any) => {
        const valid = typeof value === "number" && value <= max;
        return prevValidator ? prevValidator(value) && valid : valid;
      };
    } else if (this.type === "string") {
      const prevValidator = this._validator;
      this._validator = (value: any) => {
        const valid = typeof value === "string" && value.length <= max;
        return prevValidator ? prevValidator(value) && valid : valid;
      };
    } else if (this.type === "array") {
      const prevValidator = this._validator;
      this._validator = (value: any) => {
        const valid = Array.isArray(value) && value.length <= max;
        return prevValidator ? prevValidator(value) && valid : valid;
      };
    } else {
      throw new Error(
        "Max is only supported on number, string, or array fields."
      );
    }
    return this;
  }

  pattern(regex: RegExp): FieldBuilder<TExternal, TInternal> {
    if (this.type !== "string") {
      throw new Error("Pattern is only supported on string fields.");
    }
    const prevValidator = this._validator;
    this._validator = (value: any) => {
      const valid = typeof value === "string" && regex.test(value);
      return prevValidator ? prevValidator(value) && valid : valid;
    };
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

  /**
   * Create a shallow clone with a different external type parameter.
   * Note: shape and itemType are passed by reference (shallow). If you need
   * deep isolation of nested FieldBuilders, clone them explicitly.
   */
  as<U>(): FieldBuilder<U, TInternal> {
    const clone = new FieldBuilder<U, TInternal>(this.type, {
      shape: this._shape,
      itemType: this.itemType,
      refType: this.refType,
    });
    clone.enumValues = this.enumValues;
    clone.isImmutable = this.isImmutable;
    clone.isSystem = this.isSystem;
    clone.isRequired = this.isRequired;
    clone._description = this._description;
    clone._version = this._version;
    clone._pii = this._pii;
    clone._validator = this._validator as any;
    clone._default = this._default as any;
    clone._upgrade = this._upgrade;
    // refType already provided in constructor options above
    return clone;
  }
}

export default FieldBuilder;
