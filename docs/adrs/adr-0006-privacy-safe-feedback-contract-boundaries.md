# ADR-0006: Privacy-Safe Feedback Contract Boundaries

- Status: Accepted
- Date: 2026-07-18
- Updated: 2026-07-29
- Version: 1.1

## Context

Feedback intake crosses several trust boundaries: a browser may briefly hold
free-form narrative, a private scanner derives classifications, immutable blob
packets retain structured facts, timer processors produce reports, and a
thresholded subset becomes public. A permissive JSON contract could silently
carry narrative, identity, client metadata, pixels, or classifier traces from
one boundary into another.

The package historically strips fields outside a schema shape during
validation. That behaviour is useful for backwards compatibility, but it
cannot prove that a storage-bound payload was free of prohibited fields before
serialization.

## Decision

Add opt-in `unknownFields: "reject"` and `identity: "exact"` schema policies.
Rejection is recursive for declared objects and arrays of declared objects.
Before cloning, rejection mode applies an iterative whole-input node/depth
budget, including malformed containers supplied where a scalar was expected.
Exact identity rejects mismatched schema type/version after any configured
upgrade. Unknown-field and enum errors identify only contract-owned facts;
they never reflect an attacker-controlled key or value. The defaults remain
`"strip"` and
`"compatible"` so existing consumers are not broken.

All feedback contracts use rejection mode and are divided into three explicit
boundaries:

1. Transient contracts may express an allowlisted rich-text AST or encrypted
   narrative envelope. Narrative text is marked high-PII, clear-on-storage,
   omit-from-logs, and is limited to 4,000 Unicode code points including block
   separators, with an 8,000 UTF-16-unit safety bound. The v1 boundary pins
   `unicode-15.1.0-nfkc-v1`, rejects the complete Unicode 15.1 unassigned
   corpus and lone surrogates before host NFKC, and closes protocol-relative
   plus executable/local URL schemes.
   Encrypted key material, IVs, ciphertext, and one-use receipt IDs are also
   clear-on-storage and omit-from-logs. Analysis requests are closed and
   purpose-discriminated: a bug request requires a closed surface, while a
   review request forbids one. The service must verify the bug surface against
   the caller's capability-projected catalog before decrypting its envelope.
2. Scanner receipts contain closed classifications plus an opaque one-use
   receipt identifier and server timestamp. Persistable derived analysis drops
   both joinable receipt fields.
3. Drafts, accepted packets, game diagnostics, materialized reports,
   checkpoints, reconstruction manifests, and public summaries contain only
   closed structured fields.

Renderer/browser consumers use the focused
`@plasius/schema/feedback-diagnostics-vocabulary` entrypoint for the canonical
surface/provenance pairs, bounds, bucket/code vocabularies, and discriminated
type without loading the schema builder. Server validators use
`@plasius/schema/feedback-diagnostics`, which adds the canonical runtime schema.
Both are sourced from one contract rather than allowing a second package-local
diagnostics dialect. A domain-specific typed validation wrapper preserves the
surface/provenance discriminant after generic schema validation.

Packet UUIDs are workflow identifiers, not reporter identifiers. Server-owned
packet/report UUIDs use random UUIDv4 validation. Client-provided draft UUIDs
are omit-from-logs and remain available only for short-lived draft lookup.
Final bug/review JSON bodies contain no submission identifier. Their consuming
HTTP endpoints require `Idempotency-Key` as the sole final-submission
correlation value; it remains in the isolated control plane and is never
copied into feedback JSON, packets, reports, logs, Admin, MCP, or public
projections.
Reusable child contracts retain exact schema identity inside parent contracts,
so schema-validated values compose without stripping metadata or creating a
second wire shape. No feedback
schema can express account identifiers, reporter pseudonyms, network/client
metadata, arbitrary URLs, narrative, pixels, quotes, summaries, embeddings,
content hashes, or model traces.

The schema library does not claim to detect all PII. It constrains structure
and annotates the one transient text field. Consumers must still use the
private, no-retention privacy scanner before accepting derived analysis.

## Alternatives considered

- Continue stripping unknown fields: preserves compatibility but cannot fail
  a storage write when privacy-forbidden input was over-posted.
- Reject unknown fields for every schema: stronger globally, but would be a
  breaking change for existing consumers.
- Store redacted narrative: automatic detection can have false negatives, so
  retained text cannot satisfy the feature's strict no-narrative promise.
- Put cryptographic operations in this package: that would duplicate audited
  platform cryptography and mix data-shape validation with key handling.

## Consequences

- Storage and report boundaries fail closed on unknown properties.
- Existing schemas retain their historical behaviour unless they opt in to
  closed fields or exact identity.
- Exported schema-policy vocabularies are runtime frozen, matching the closed
  feedback vocabularies and preventing process-local mutation of defaults.
- Transient and persisted analysis are deliberately distinct, preventing
  scanner-receipt joins from leaking into blob packets.
- Encrypted bug analysis is bound to a closed surface that must be authorised
  against the caller's projected catalog before decryption; review analysis
  cannot carry a surface, including an explicit `null`.
- Schema-level validators receive only frozen field-presence metadata, not raw
  input values, when exact omission is part of a closed discriminator.
- Duplicate body-level submission correlation is rejected. Transport
  idempotency remains outside content schemas and immutable packet shapes are
  unchanged.
- Diagnostic surface, provenance, feature, counter, and error identifiers are
  closed enums; arbitrary safe-looking strings cannot disguise personal data.
- Closed feedback vocabularies and their definition objects are runtime
  frozen before schemas capture them, so a consumer cannot widen a live
  validation boundary by mutating an exported array.
- Surface IDs are bound to canonical labels, visibility kinds, and diagnostics
  eligibility. Pinned scanner policy/model versions are closed; deployment
  release/build IDs remain trusted server-registry inputs only.
- Public history is a fixed 13-week UTC series with thresholded gaps and no
  sub-threshold counts. Public trend data independently thresholds the
  preceding window and derives its direction from an exact comparison delta.
- Context projections cannot extend the 24-hour bug or 30-day review maximum;
  acceptance receipts enforce the exact bug ladder or review period.
- Report advisories bind their trigger counts and ordered recommendations to
  the same deterministic facts that require each advisory.
- Timer checkpoints bind their processor, calendar-valid UTC window, revision,
  and optional report reference. Manifest late-arrival counts cannot exceed
  their bounded input and reconciliation cannot manufacture report output.
- Blob ETags remain conditional-transport metadata rather than persisted
  checkpoint content.
- Consumers must validate before storage and must not treat schema validation
  as a replacement for the privacy scanner, request-size limits, or
  authorization.
- The new recursive PII audit exposes nested field paths, making transient text
  annotations reviewable.
- Recursive strict unknown-field scanning treats unshaped references as
  exactly `{ type, id }`, applies declared shapes to shaped references and
  arrays of references, and keeps those objects inside the validation
  complexity budget.
- Optional encrypted and hashed PII fields preserve their transformed storage
  keys during read preparation while genuinely absent optionals remain absent.
- The browser and private scanner must match the complete, digest-bound
  Unicode 15.1 unassigned corpus and mirror the closed URL-syntax pattern
  before transient analysis is enabled. Host-runtime Unicode categories are
  not an acceptable substitute.

## Related decisions

- [ADR-0004: Field Exposure Metadata and Public Serialization](./adr-0004-field-exposure-and-public-serialization.md)
- [ADR-0007: Pinned Unicode Feedback Profile](./adr-0007-pinned-unicode-feedback-profile.md)
- [Feedback contract design](../design/feedback-contracts.md)
