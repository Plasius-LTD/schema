import { FieldBuilder } from "./field.builder.js";
import { Infer } from "./infer.js";
import { SchemaShape } from "./types.js";

export const field = {
  string: () => new FieldBuilder<string>("string"),
  number: () => new FieldBuilder<number>("number"),
  boolean: () => new FieldBuilder<boolean>("boolean"),
  object: <T extends Record<string, FieldBuilder>>(fields: T) =>
    new FieldBuilder<T>("object", { shape: fields }),
  array: (itemType: FieldBuilder) => new FieldBuilder("array", { itemType }),
  ref: <S extends SchemaShape>(refType: string) =>
    new FieldBuilder<Infer<S>>("ref", { refType }),
};
