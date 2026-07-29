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

## Packaging policy (template baseline)

`@plasius/schema` is the baseline template for new `@plasius/*` packages.
Dual-module packages should prefer `.cjs` outputs for CommonJS. If a package
uses `dist-cjs/*.js` with `type: module`, it must generate
`dist-cjs/package.json` with `{ "type": "commonjs" }` and validate this in
`pack:check` before publish.

---

## Player-system event contracts

The package exports versioned contracts for a blob-backed, privacy-safe player
event pipeline:

```ts
import {
  PlayerSystemCuratedSnapshotSchema,
  PlayerSystemNormalizedEventBatchSchema,
  PlayerSystemObservedEventBatchSchema,
} from "@plasius/schema";
```

The contracts cover raw observed-event ingress, normalized batches with
deterministic keys, and curated per-player Event Log/Achievement snapshots.
Only the stable `playerId` is treated as a personal identifier. It is retained
for storage partitioning and pseudonymized by `sanitizeForLog`; unknown fields
and hidden server truth are excluded by schema serialization.

## Privacy-safe feedback contracts

The package exports closed, versioned contracts for feedback intake and
reporting:

```ts
import {
  FeedbackBugPacketSchema,
  FeedbackPublicSummarySchema,
  FeedbackRichTextAstSchema,
  FeedbackReviewPacketSchema,
} from "@plasius/schema";
```

Free-form feedback exists only in `FeedbackRichTextAstSchema`, which is
intended for a transient no-retention scanner. Its text nodes are marked
high-PII, clear-on-storage, and omit-from-logs. The interoperable document is
rooted at
`{ type: "doc", version: "1.0.0", schemaVersion: "1", children }`; it permits
only paragraph and bullet-list-item blocks with bounded indentation and text
nodes with bold, italic, and underline marks. Narrative must already be NFKC
normalised against the exported `unicode-15.1.0-nfkc-v1` profile before
validation. Its 4,000-character ceiling counts Unicode code points and
inter-block newlines consistently with the private scanner, with a separate
8,000 UTF-16-unit safety ceiling. HTML, Markdown links, protocol-relative
links, and `http`, `https`, `ftp`, `mailto`, `javascript`, `data`, `blob`, and
`file` schemes are rejected. Scanner implementations must reject code points
unassigned by the pinned profile rather than accepting newer-runtime
assignment or normalization canaries unchanged.

Validated reusable fragments retain exact `type` and `version` metadata when
embedded in parent contracts. This makes the output of the encrypted-envelope,
derived-analysis, and game-diagnostics schemas directly composable into their
request or packet schemas without a metadata-stripping step.

Accepted packet, diagnostics, report, checkpoint, and public-summary schemas
cannot express narrative, reporter identity or pseudonyms, network/client
metadata, arbitrary URLs, pixels, quotes, summaries, embeddings, content
hashes, or model traces. Game surfaces, provenance contracts, features,
counters, and error codes are closed enums rather than attacker-controlled
safe-looking strings. The public summary omits counts, averages, and trends
entirely when the ten-review privacy threshold is not met and always carries
13 canonical UTC week slots, using suppressed gaps where a week is below the
same threshold. A trend is emitted only with a preceding 90-day comparison
that independently meets the ten-review threshold; the schema derives its
delta and enforces `up`/`down` only at a change of at least 0.1 stars.

Hourly reports bind targets to the closed surface registry and include
renderer/backend/viewport/frame-rate/frame-time plus closed diagnostic
feature/counter/error distributions. Release IDs and build IDs are
server-registry values: intake clients never submit them, and consumers must
resolve them from trusted deployment metadata before packet construction.
Advisory trigger counts and ordered recommendation IDs are derived exactly
from the report distributions and processor lag rather than accepted as
free-standing claims. Feedback context caps remaining bug cooldown at 24
hours and review suppression at 30 days; acceptance receipts distinguish bugs
from reviews and accept only the five-step bug ladder or exact 30-day review
period.

All feedback contracts opt in to recursive unknown-field rejection, including
direct references and arrays of references. Unshaped references admit only
`type` and `id`; shaped references admit only those keys plus their declared
fields. Closed feedback vocabularies and definition objects are runtime frozen
before schemas capture them. Before recursive cloning, strict validation also
performs an iterative whole-value node/depth budget so malformed containers
hidden under scalar fields cannot exhaust the call stack. The
general schema default remains backwards-compatible stripping:

```ts
const ClosedPacket = createSchema(fields, "closed-packet", {
  version: "1.0.0",
  piiEnforcement: "strict",
  unknownFields: "reject",
  identity: "exact",
});
```

Unknown-field errors name only the schema-owned container and never echo an
untrusted key or value. Exact identity rejects a mismatched contract type or
version. The schemas constrain data shape; consumers must still
perform the documented private PII scan, discard narrative immediately, and
validate again before every storage write. See the
[feedback contract design](./docs/design/feedback-contracts.md) and
[ADR-0006](./docs/adrs/adr-0006-privacy-safe-feedback-contract-boundaries.md).

## Demo

```bash
npm run build
node demo/example.mjs
```

See `demo/README.md` for the local sanity-check scaffold.

---

## Node.js Version

This project uses Node.js **24** by default. The version is pinned in the [`.nvmrc`](./.nvmrc) file.

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

Validation standards notes:

- `languageCode()` checks a documented RFC 5646/BCP 47 subset
  case-insensitively, including grandfathered and private-use tags;
  two-letter primaries are checked against the package's ISO 639-1 registry.
  Registered 4-8 letter primaries remain outside this dependency-free subset.
- `uuid()` accepts the RFC 9562 versions 1-8, Nil, and Max text forms. Legacy
  RFC 4122-named module paths remain compatibility aliases.
- `email()` is a pragmatic dot-domain mailbox subset, not a claim of complete
  RFC 5322 grammar support.

Runtime rollout inherits `governance.rfc-compliance-remediation.enabled`;
disabled consumers may retain the prior validators only during a documented
migration window.
Defaults are applied during validation when inputs are missing/`undefined`.
Fields are required by default; call `.optional()` (or provide `.default()`) to allow omission.
Use `.internal()` or `.exposure("internal")` on fields that the server may validate/store but must not include in client-facing payloads.

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

### 3b) Serialize only client-safe fields

Schema serialization is separate from validation. `serialize()` keeps only schema-known fields and drops fields marked `.internal()` unless explicitly requested.

```ts
const PersistedUserSchema = createSchema(
  {
    id: field.string(),
    partitionKey: field.string().internal(),
    email: field.email(),
    audit: field.object({
      createdBy: field.string().internal(),
      createdAt: field.dateTimeISO(),
    }),
  },
  "persisted-user",
  { version: "1.0.0", piiEnforcement: "strict" }
);

const publicPayload = PersistedUserSchema.serialize({
  type: "persisted-user",
  version: "1.0.0",
  id: "123",
  partitionKey: "tenant-a",
  email: "alice@example.com",
  audit: {
    createdBy: "admin-1",
    createdAt: "2026-03-09T00:00:00.000Z",
  },
  _rid: "cosmos-only",
});

// => {
//   type: "persisted-user",
//   version: "1.0.0",
//   id: "123",
//   email: "alice@example.com",
//   audit: { createdAt: "2026-03-09T00:00:00.000Z" }
// }
```

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

<!-- BEGIN PLASIUS RELEASE INTEGRITY -->
## Release integrity

CI keeps the administrative contributor registry outside Git and npm package
artifacts using exact, case-normalised path checks. CI runs on approved
self-hosted runners. Release preparation and npm publication use GitHub-hosted
runners with Node.js 24.18.0 LTS. CD remains disabled until the npm trusted
publisher binding is verified and the legacy token fallback is removed.
<!-- END PLASIUS RELEASE INTEGRITY -->
