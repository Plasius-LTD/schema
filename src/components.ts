import { Infer } from "./infer.js";
import { createSchema } from "./schema.js";
import { Schema, SchemaShape } from "./types.js";
// This module provides a registry for component schemas, allowing components to be registered and retrieved by type.
const componentSchemaRegistry = new Map<string, Schema<SchemaShape>>();

export function createComponentSchema<T extends SchemaShape>(
  shape: SchemaShape,
  name: string,
  version: string,
  tableName: string = "",
  schemaValidator: (entity: Infer<T>) => boolean = () => true
): Schema<SchemaShape> {
  const schema = createSchema<T>(shape as T, name, {
    version: version,
    piiEnforcement: "strict",
    table: tableName,
    schemaValidator,
  });
  registerComponentSchema(name, schema as Schema<SchemaShape>);
  return schema as Schema<SchemaShape>;
}

export function registerComponentSchema(
  type: string,
  schema: Schema<SchemaShape>
) {
  componentSchemaRegistry.set(type, schema);
}

export function getComponentSchema(
  type: string
): Schema<SchemaShape> | undefined {
  return componentSchemaRegistry.get(type);
}

export function getAllComponentSchemas(): [string, Schema<SchemaShape>][] {
  return Array.from(componentSchemaRegistry.entries());
}
