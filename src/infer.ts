import { SchemaShape } from "./types.js";

type InferField<T> = T extends { _type: infer U }
  ? U
  : T extends { type: "string" }
    ? string
    : T extends { type: "number" }
      ? number
      : T extends { type: "boolean" }
        ? boolean
        : T extends { type: "array"; itemType: infer Item }
          ? InferField<Item>[]
          : T extends { type: "object"; shape: infer Shape extends SchemaShape }
            ? InferFromShape<Shape>
            : unknown;

type IsOptional<T> = T extends { isRequired: false } ? true : false;

type InferFromShape<S extends SchemaShape> = {
  [K in keyof S]: IsOptional<S[K]> extends true
    ? InferField<S[K]> | undefined
    : InferField<S[K]>;
};

type InferFromSchema<T extends { shape: SchemaShape }> = InferFromShape<
  T["shape"]
>;

type IsSchema<T> = T extends { shape: SchemaShape } ? true : false;

export type Infer<T> =
  IsSchema<T> extends true
    ? InferFromSchema<T & { shape: SchemaShape }>
    : InferFromShape<T & SchemaShape>;
