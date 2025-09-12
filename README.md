# @plasius/schema

[![npm version](https://img.shields.io/npm/v/@plasius/schema.svg)](https://www.npmjs.com/package/@plasius/schema)
[![Build Status](https://github.com/plasius/plasius-schema/actions/workflows/ci.yml/badge.svg)](https://github.com/plasius/plasius-schema/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/plasius/plasius-schema.svg)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

Entity definition & validation helpers for the Plasius ecosystem.

This package is part of the **Plasius LTD** selective open-source strategy. For more on our approach, see [ADR-0013: Selective Open Source](https://github.com/plasius/plasius/blob/main/docs/architecture/adr/ADR-0013-selective-open-source.md). This package is maintained as open source to foster community trust and enable integration, while the core Plasius platform remains proprietary.

Apache-2.0. ESM + CJS builds. TypeScript types included.

---

## Installation

```bash
npm install @plasius/schema
```

---

## Usage Example

```js
import {
  defineEntity,
  validateEntity,
  bumpEntityVersion,
} from "@plasius/schema";

// Define an entity schema
const userSchema = defineEntity({
  name: "User",
  version: 1,
  fields: {
    id: { type: "string", required: true },
    email: { type: "string", required: true },
    name: { type: "string", required: false },
  },
});

// Validate an entity instance
const user = { id: "abc123", email: "user@example.com", name: "Alice" };
const { valid, errors } = validateEntity(userSchema, user);
console.log(valid); // true
console.log(errors); // []

// Bump entity version
const userV2 = bumpEntityVersion(userSchema, 2, {
  fields: {
    ...userSchema.fields,
    isActive: { type: "boolean", required: false },
  },
});
console.log(userV2.version); // 2
```

---

## Key Documentation

- [Plasius Pillars](https://github.com/plasius/plasius/blob/main/docs/pillars.md)
- [Investor Brief](https://github.com/plasius/plasius/blob/main/docs/investor-brief.md)
- [Competition](https://github.com/plasius/plasius/blob/main/docs/competition.md)
- [Architecture Decision Records (ADRs)](https://github.com/plasius/plasius/tree/main/docs/architecture/adr)

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Contributor License Agreement](./CLA.md)

---

## License

Licensed under the [Apache-2.0 License](./LICENSE).
