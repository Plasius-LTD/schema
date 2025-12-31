# @plasius/schema

[![npm version](https://img.shields.io/npm/v/@plasius/schema.svg)](https://www.npmjs.com/package/@plasius/schema)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/schema/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/schema/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/schema)](https://codecov.io/gh/Plasius-LTD/schema)
[![License](https://img.shields.io/github/license/Plasius-LTD/schema)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

Entity definition & validation helpers for the Plasius ecosystem.

Apache-2.0. ESM + CJS builds. TypeScript types included.

---

## Installation

```bash
npm install @plasius/schema
```

---

## Node.js Version

This project uses Node.js **22** by default. The version is pinned in the [`.nvmrc`](./.nvmrc) file.

If you use [nvm](https://github.com/nvm-sh/nvm), simply run:

```bash
nvm use
```

This ensures your local development environment matches the version used in CI/CD.

---

## Usage Example

### Imports

```ts
import {
  // core
  createSchema,
  field,
  getSchemaForType,
  getAllSchemas,
  Infer
} from "@plasius/schema";
```

### 1) Define fields with the `field()` builder

> Below uses the fluent builder exported via `field`/`field.builder`.

```ts
const UserFields = {
  id: field.uuid().required().description("Unique user id"),
  email: field.email().required(),
  name: field.generalText().optional(),
  age: field.number().min(0).optional(),
  roles: field.array(field.string().enum(["admin", "user"]))
    .default(["user"])
    .description("RBAC roles"),
  createdAt: field.dateTimeISO().default(() => new Date().toISOString()),
};
```

Common methods (non‑exhaustive): `.required()`, `.optional()`, `.default(v|fn)`, `.description(text)`, and type‑specific helpers like `.email()`, `.uuid()`, `.min()`, `.max()`, `.enum([...])`.
Defaults are applied during validation when inputs are missing/`undefined`.
Fields are required by default; call `.optional()` (or provide `.default()`) to allow omission.

### 2) Create a **versioned** schema (enforces `type` + `version`)

```ts
export const UserSchema = createSchema(UserFields, "user", {
  version: "1.0.0",
  piiEnforcement: "strict",
});

// Strongly-typed entity from a schema definition
export type User = Infer<typeof UserSchema>;
```

Schemas are discoverable at runtime if you register them during module init:

```ts
// later in app code
const s = getSchemaForType("user"); // returns UserSchema
const all = getAllSchemas(); // Map<string, Map<string, Schema>> or similar
```

### 3) Validate data against the schema

```ts
const raw = {
  type: "user",
  version: "1.0.0",
  id: crypto.randomUUID(),
  email: "alice@example.com",
};

const result = UserSchema.validate(raw);
if (result.valid && result.errors.length == 0) {
  // result.value is typed as User
  const user: User = result.value;
} else {
  // result.errors: ValidationError[] (path/code/message)
  console.error(result.errors);
}
```

> If your validation layer also exposes a throwing variant (e.g. `validateOrThrow(UserSchema, raw)`), you can use that in places where exceptions are preferred.

- Validation highlights:
  - Array item validators (e.g. `.pattern()`, `.min()`, `.max()`) run per element for primitive arrays.
  - Arrays of refs validate nested ref shapes (defaults, required fields, and validators) when provided.
  - Ref fields enforce their declared `refType` during validation, catching mismatches early.
  - PII helpers recurse through nested objects/arrays/refs so encrypted/hashed/cleared fields are handled throughout the structure (including array items).
  - ISO lists stay current (`PS` country code, `SLE` currency code) and the validation package exports `validateLanguage` for BCP 47 tags.
  - Numeric enums are enforced like string enums instead of accepting out-of-range values.
  - Immutable flags are honored on nested object/array/ref children when an existing entity is provided.
  - PII strict/warn enforcement runs on nested fields, preventing empty high-PII subfields from slipping through.
  - Validation deep-clones inputs before applying defaults, so caller-provided objects/arrays aren’t mutated and non-JSON-safe values (e.g., `Date`) are preserved.

### 4) Version enforcement in action

If either `type` or `version` doesn’t match the schema, validation fails.

```ts
const wrong = { type: "User", version: "2.0.0", id: "123", email: "x@x" };
const bad = UserSchema.validate(wrong);
// bad.valid === false; errors will include mismatches for type/version
```

### 5) Evolving your schema

Keep new versions side‑by‑side and migrate at edges:

```ts
export const UserV2 = createSchema(
  {
    ...UserFields,
    displayName: field.string().min(1).max(100).optional(),
  },
  "user",
  { version: "2.0.0", piiEnforcement: "strict" }
);
```

> Write a small migration function in your app to transform `User (1.0.0)` → `User (2.0.0)` where needed.

### 6) Field-level upgrades

The schema supports a new `.upgrade()` method on fields to define field-level upgrade logic. This is useful when tightening restrictions on a field, such as reducing maximum length, strengthening format constraints, or normalizing values, without changing the field’s overall shape.

For example, suppose a `displayName` field previously allowed strings up to 60 characters, but you want to reduce the max length to 55 characters and normalize whitespace by trimming and collapsing spaces. You can define an upgrader function that attempts to fix old values to meet the new constraints:

```ts
const UserV3Fields = {
  ...UserFields,
  displayName: field.string().max(55).optional()
    .upgrade((oldValue) => {
      if (typeof oldValue !== "string") {
        return { ok: false, error: "Expected string" };
      }
      // Normalize whitespace: trim and collapse multiple spaces
      const normalized = oldValue.trim().replace(/\s+/g, " ");
      if (normalized.length > 55) {
        return { ok: false, error: "Display name too long after normalization" };
      }
      return { ok: true, value: normalized };
    }),
};

export const UserV3 = createSchema(UserV3Fields, "user", {
  version: "3.0.0",
  piiEnforcement: "strict",
});
```

Other typical upgrade strategies include:

- Clamping numeric values to new min/max bounds
- Remapping enum values to new sets or keys
- Normalizing whitespace or case in strings
- Converting deprecated flag values to new formats

During validation, if the entity version is less than the schema version and the field's value fails validation, the upgrader function will be invoked to attempt to transform the old value into a valid new value. If the upgrade succeeds and the transformed value passes validation, the upgraded value is used. If the upgrade fails or the transformed value still does not validate, validation errors will be returned.

**Note:** Field-level upgrades only run when the schema version is greater than the entity version and the field validation initially fails. This provides a convenient way to handle incremental field changes without requiring full schema migrations.

You can still write schema-level migration functions for larger or more complex changes that affect multiple fields or require more extensive transformation logic. Field-level upgrades complement these by handling simpler, localized upgrades directly within the schema definition.

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Contributor License Agreement](./legal/CLA.md)

---

## License

Licensed under the [Apache-2.0 License](./LICENSE).
