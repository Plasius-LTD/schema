# ADR-0007: Pinned Unicode Feedback Profile

- Status: Accepted
- Date: 2026-07-29
- Decision owners: Feedback and privacy platform maintainers
- Tracked work: `Plasius-LTD/schema#32`

## Context

The transient feedback scanner is pinned to Unicode 15.1, while JavaScript
runtimes and browsers can use newer Unicode tables. A runtime-relative
`\p{Cn}` check, or a small collection of later-assignment canaries, therefore
allows the browser and private scanner to disagree. A later runtime can accept
and normalize a code point that the scanner still classifies as unassigned.

The feedback boundary must fail closed before host normalization, must reject
malformed UTF-16, and must be implementable identically by browser,
server-side JavaScript, and the private non-JavaScript scanner.

## Decision

The canonical profile is `unicode-15.1.0-nfkc-v1`.

1. `@unicode/unicode-15.1.0` version `1.6.17` is an exact build-time
   dependency. Runtime code does not load the upstream package.
2. The generator reads only
   `General_Category/Unassigned`, validates the reviewed source identity, and
   emits a deterministic language-neutral JSON corpus at
   `unicode/feedback-unicode-15.1.0-unassigned.json`.
3. The corpus is 707 sorted, non-overlapping half-open ranges containing
   824,718 code points. Consecutive flattened endpoints are represented as
   positive deltas, shortest-form unsigned LEB128, then canonical unpadded
   base64url. The decoded endpoints, encoded as unsigned 32-bit big-endian
   integers for integrity verification, have SHA-256
   `591e457524d6b4b988aa7c7687e76c95a78370fea38bbd1b09085be7fd935ef3`.
4. `npm run unicode:check` regenerates the corpus in memory and requires
   byte-for-byte equality. Build and test entrypoints run this check.
5. `@plasius/schema/feedback-unicode-profile` strictly decodes the payload
   once into a bounded typed array. Metadata/digest drift, non-shortest ULEB128,
   overflow, trailing bytes, invalid range topology, or count mismatch leaves
   no usable table and fails closed. The subpath exposes the canonical profile
   ID, endpoint digest, a binary-search code-point helper, and a text helper.
   Invalid numeric values, surrogates supplied as code points, Unicode
   15.1-unassigned values, and lone UTF-16 surrogates fail closed.
6. Feedback rich-text validation applies the pinned assignment check to the
   original code units before invoking host NFKC normalization. Existing
   control, format, URL, syntax, and size restrictions still apply after that
   gate.
7. The JSON corpus is a package export so the private scanner can consume the
   same endpoints without reinterpreting JavaScript or relying on its host
   Unicode version.

Changing the Unicode source version, profile ID, endpoint encoding, or digest
requires a reviewed profile revision and cross-runtime corpus validation. It
must not occur through an unconstrained dependency update.

## Consequences

- Browser and scanner assignment decisions no longer drift with their host
  Unicode releases.
- The runtime helper performs allocation-free text scanning and at most
  `log2(707)` range comparisons per scalar value.
- The package ships an approximately 2.5 KB uncompressed JSON corpus and a
  small isolated helper entrypoint.
- Unicode normalization itself remains a host operation, but it is reached
  only after the original text is proven representable by the pinned profile.
- Private scanners must verify the profile ID and endpoint digest before
  enabling transient narrative analysis.

## Alternatives considered

- Runtime `\p{Cn}`: rejected because its meaning changes with the runtime.
- A short post-profile canary list: rejected because it cannot cover all later
  assignments.
- Shipping the upstream Unicode package at runtime: rejected because it is
  substantially larger than the required property and is JavaScript-specific.
- Generating separate browser and scanner tables: rejected because independent
  projections can drift.

## Related decisions

- [ADR-0006: Privacy-Safe Feedback Contract Boundaries](./adr-0006-privacy-safe-feedback-contract-boundaries.md)
- [Feedback contract design](../design/feedback-contracts.md)
