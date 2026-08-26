# Privacy-Safe Feedback Contract Design

## Purpose

This package defines the versioned JSON boundaries for feedback intake,
privacy-safe classifier output, immutable packets, game diagnostics, scheduled
reports, and the public honesty snapshot. It intentionally does not implement
authentication, capability evaluation, encryption, storage, cooldowns, timer
execution, or classification.

Tracked delivery: `Plasius-LTD/schema#32` and
`Plasius-LTD/schema#52`, under the privacy-safe feedback Epic. Consuming
features remain default-off behind their named remote flags,
including `feedback.bug-report.enabled`, `feedback.review.enabled`,
`feedback.transient-analysis.enabled`, `feedback.reporting.enabled`,
`feedback.public-honesty.enabled`, and
`feedback.game-diagnostics.enabled`.

## Boundary model

| Boundary | Contracts | Retained content |
| --- | --- | --- |
| Browser to scanner | rich-text AST, encrypted envelope, transient request | Never retained |
| Scanner response | analysis receipt | Ephemeral one-use receipt |
| Draft storage | structured draft packet | Structured selections and derived projection only |
| Accepted storage | bug/review packet, optional game diagnostics | Identifier-free structured facts |
| Committed-acceptance evidence | packet UUID, kind, server acceptance time | Identifier-free proof that control commit completed |
| Scheduled processing | hourly/daily reports, checkpoints, manifests | Identifier-free aggregates and safe operational state |
| Public read model | public summary | Thresholded 90-day and weekly satisfaction facts |
| Admin reconstruction | reconstruction manifest | Safe diagnostics and curated asset identifiers, never user pixels |

The transient scanner receipt and the persistable derived-analysis projection
are separate schemas. The persisted projection omits the receipt identifier
and scanner timestamp so stored packets cannot be joined back to transient
scanner activity.

## Contract inventory

- `FeedbackRichTextAstSchema` uses
  `{ type: "doc", version: "1.0.0", schemaVersion: "1", children }`. Children
  are paragraph or bullet-list-item blocks with depth 0-4; their children are
  text nodes with optional unique bold, italic, and underline marks. Extracted
  text—including the newline inserted between blocks—is bounded to 4,000
  Unicode code points and 8,000 UTF-16 code units and rejects non-NFKC input,
  Unicode format controls, HTML, embedded metadata, unknown nodes,
  protocol-relative links, and the closed `http`, `https`, `ftp`, `mailto`,
  `javascript`, `data`, `blob`, and `file` scheme set. Version 1 pins
  `unicode-15.1.0-nfkc-v1` and validates the original UTF-16 against the
  complete Unicode 15.1 unassigned corpus before invoking host NFKC. The
  language-neutral package artifact compactly encodes 707 half-open ranges as
  canonical delta ULEB128/base64url, covers 824,718 unassigned code points,
  and is bound to decoded-endpoint SHA-256
  `591e457524d6b4b988aa7c7687e76c95a78370fea38bbd1b09085be7fd935ef3`.
  The browser and scanner must use this artifact or prove exhaustive parity
  with it; runtime-relative Unicode property escapes are not conformant.
- `FeedbackEncryptedNarrativeEnvelopeSchema` validates only a bounded
  `RSA-OAEP-256+A256GCM` outer envelope with a 96-bit IV and separate 128-bit
  authentication tag. It does not decrypt or inspect ciphertext. Wrapped keys,
  IVs, tags, ciphertext, and one-use correlation IDs are annotated
  clear-on-storage and omit-from-logs. RSA wrapped-key lengths are restricted
  to canonical 2,048/3,072/4,096-bit encodings, malformed base64url lengths are
  rejected, ciphertext is bounded to keep the complete scanner request below
  its body limit, and the AST is limited to 256 formatting nodes.
- `FeedbackTransientAnalysisRequestSchema`,
  `FeedbackAnalysisReceiptSchema`, and `FeedbackDerivedAnalysisSchema`
  separate encrypted intake, ephemeral receipts, and persistable closed
  classifications. The transient request is purpose-discriminated: `bug`
  requires a closed `surfaceId`, while `review` forbids one. The service must
  verify that ID against the caller's projected catalog before ciphertext
  enters the private scanner. The exported
  `FeedbackBugTransientAnalysisRequest` and
  `FeedbackReviewTransientAnalysisRequest` types and
  `validateFeedbackTransientAnalysisRequest()` preserve that discriminator
  after runtime validation.
- `FeedbackSurfaceCatalogSchema` and `FeedbackContextSchema` carry only the
  server-projected closed surface catalog, selected surface, effective flags,
  eligibility, and an at-most-ten-minute RSA wrapping key. They contain no
  hidden capability list. Every ID is bound to its canonical label, kind, and
  diagnostics eligibility; an admin surface cannot be relabelled as public,
  and player-system is never diagnostics-eligible. Effective bug eligibility
  requires a projected surface. Diagnostics eligibility also requires bug
  eligibility and a projected diagnostics-enabled game surface. A cooldown
  carries both a strictly-future availability time and its exact rounded-up
  retry interval, or neither value for a non-cooldown entitlement denial.
  Remaining bug cooldown is capped at 24 hours and remaining review
  suppression at 30 days. Acceptance receipts identify their bug/review kind:
  bugs accept exactly 5m, 15m, 1h, 6h, or 24h from acceptance, while reviews
  accept exactly 30 days.
- `FeedbackDraftUpsertRequestSchema` supports partial dirty-field autosave.
  Empty requests are rejected; `FeedbackDraftPacketSchema` enforces a maximum
  24-hour server-owned lifetime. Draft and acceptance receipts keep Blob ETags
  in HTTP metadata, and scanner failure uses a separate closed structured-only
  result rather than creating a joinable receipt.
- Bug and review submission request schemas are distinct. Privacy/security
  issue selection cannot pass final bug submission because it must route to
  the confidential security process. Neither body declares `submissionId`:
  the consuming HTTP contract requires `Idempotency-Key` as the sole
  final-submission correlation value, held only in the isolated control plane
  and never projected into content JSON.
- `FeedbackBugPacketSchema` and `FeedbackReviewPacketSchema` are immutable
  storage projections with no reporter correlation.
- `FeedbackCommittedAcceptanceEvidenceSchema` is the only durable selector
  input that proves a packet completed its isolated control-plane commit. It
  contains a canonical lowercase UUIDv4 packet ID, `bug`/`review` kind, and
  millisecond-precision UTC `acceptedAt` copied from the already-validated
  immutable packet by a trusted delivery worker. Impossible calendar and clock
  values produce a closed invalid result without a native date exception or
  rejected-value reflection. The evidence is never
  accepted from an intake caller and cannot express the pseudonymous control
  key, reservation, idempotency data, packet locator/hash, or request/content
  metadata. A packet present in Blob storage without this evidence is an
  orphan and must not enter reports.
- `FeedbackGameDiagnosticsSchema` contains coarse renderer, backend, viewport,
  frame-rate, and frame-time buckets plus closed renderer-owned provenance,
  feature, counter, and error identifiers. It requires explicit consent,
  accepts only generator/GPU-demo contracts, and rejects player-system
  surfaces. A parent submission must use the same surface as its diagnostics.
- Hourly and daily report schemas require exact UTC hour/day windows, bounded
  distributions, deterministic rate facts, traffic denominators, closed
  renderer diagnostic distributions, statistics derived from star
  distributions, processor lag, and deterministic advisory/recommendation IDs.
  Per-ID multiplicity is bounded by contributing packets (or the closed
  per-packet diagnostic limit). Each advisory trigger count and ordered
  recommendation list is derived exactly from its severity, review-count, or
  processor-lag trigger; reports cannot express prose summaries.
- `FeedbackPublicSummarySchema` uses an explicit published/suppressed
  discriminator. A suppressed window omits its count, average, and trend and
  contains only suppressed weekly gaps; a published week must have at least
  ten reviews. Exactly 13 ordered Monday-UTC slots are tied to the snapshot
  `asOf` boundary, and report age is derived from materialization time. A
  public trend is optional until the preceding 90-day comparison also reaches
  ten reviews. When present, the comparison carries its derived delta and the
  schema enforces `up`/`down` only at a rounded change of at least 0.1 stars.
- Checkpoint and materialization-manifest schemas provide revisioned,
  conditional-write values without raw packet content or hashes. Window keys
  are processor-bound (`YYYY-MM-DDTHH` for hourly bugs, `YYYY-MM-DD` for daily
  reviews, and five-minute `YYYY-MM-DDTHH:mm` buckets for reconciliation);
  checkpoint IDs are exactly `checkpoint:<processor>:<windowKey>`. Report IDs
  are required only for report-producing processors, late arrivals cannot
  exceed source packets, and reconciliation cannot publish an output report.
  Blob ETags remain transport/storage metadata and are not embedded in
  checkpoint JSON.

Standalone child schemas and their nested parent fragments use the same exact
`type` and `version` metadata. A validated envelope, derived-analysis
projection, or game-diagnostics value can therefore be embedded directly in
its request, draft, packet, or reconstruction parent without being rejected
or silently rewritten.

## Structural privacy invariants

Every feedback contract uses recursive unknown-field rejection and exact
type/version enforcement. Persisted contracts do not declare fields for:

- narrative, ciphertext, quotes, or summaries;
- reporter, account, session, or pseudonymous control identifiers;
- IP addresses, user agents, locale, referrer, URL, or client timestamp;
- screenshots, pixels, DOM content, filenames, exact coordinates, adapter
  fingerprints, or raw warnings;
- embeddings, content hashes, model traces, or arbitrary classifier output.

Final request bodies also reject `submissionId`. Draft IDs remain scoped to
the short-lived structured-draft contract, and transient request/receipt IDs
remain scoped to the no-retention scanner exchange. The HTTP
`Idempotency-Key` is deliberately outside every schema in this package.
The review analysis branch rejects any supplied `surfaceId`, including
explicit `null`. Its schema-level validator uses only the frozen
presence-check context; raw input values are not exposed to the hook.

Validation errors identify only a schema-owned container path. They do not
echo the unknown key or value. This prevents adversarial property names from
entering error logs.

Committed-acceptance evidence has an empty PII audit. Its closed shape also
rejects control state/reservation IDs, reporter and account values,
idempotency/attempt identifiers, request/network/session metadata, narrative,
ciphertext, pixels, Blob locators, and content hashes. The schema proves only
the shape of evidence; the consuming system must create it through an atomic
post-commit delivery protocol and use separate least-privilege identities for
control delivery and report reads.

Strict validation first applies a non-recursive whole-input node and depth
budget before cloning. The budget covers malformed objects or arrays even when
they are supplied under a scalar field, so a type-invalid request cannot evade
the object-aware unknown-field walk and overflow the recursive clone.

Schema validation is necessary but not sufficient for privacy. The consuming
service must maintain no-body/no-ciphertext logging, use audited platform
cryptography, run the pinned local privacy scanner, discard narrative
immediately, and offer structured-only submission when scanning fails.

Open release/build identifiers exist only on server-constructed packet and
report schemas. Their values must come from the deployment/release registry,
not request bodies, diagnostics, narrative, routes, or analytics identities.
Pinned privacy policy and local model versions are closed enums. Report target
IDs use the closed surface enum rather than generic strings.

## Compatibility and rollout

`unknownFields` defaults to `"strip"` and `identity` defaults to
`"compatible"` for existing schemas. Explicit `"reject"` and `"exact"`
activate the feedback boundary. These options are additive and do not change
existing serialization behaviour.

This pre-release request alignment changes only ingress schemas and exported
transient request types. The immutable bug/review packet schemas and their
identifier-free storage wire shapes are unchanged.

The committed-acceptance evidence contract is additive. Existing packets and
reports remain wire-compatible, but report processors must fail closed until
their deployment can prove every selected packet through the new evidence
boundary. There is no legacy fallback that scans all packet Blobs.

The package evaluates no capability or feature flag. Consumer services must
compose the relevant feature flag with projected capability decisions and
must validate with these schemas at every ingress and storage boundary.

## Dependency audit

The Epic-start audit was run on 2026-07-18 with the required Node.js 24
runtime:

- the package has no runtime dependencies;
- compatible minor/patch releases were applied for Node types, ESLint,
  TypeScript ESLint, Vitest/coverage, globals, and TSX;
- a tested `esbuild` 0.28.1 override removes the remaining low-severity
  development-tool advisory inherited through the build/test graph;
- production and full dependency audits now report zero vulnerabilities;
- TypeScript 7 is the only newer direct release and is intentionally deferred
  because it is a separate major-version migration.

The package deliberately uses its existing field/schema primitives and adds no
runtime, cryptography, rich-text, PII-model, or storage dependency.

## Verification

The requirement-derived suite covers:

- default strip compatibility and recursive strict rejection;
- bounded malformed scalar containers before cloning;
- non-reflective unknown-field errors;
- malformed/oversized encrypted envelopes and narrative ASTs;
- all privacy-forbidden packet key classes;
- canonical committed-acceptance evidence, empty PII audit, both packet kinds,
  storage round trips, exact identity, and privacy-forbidden evidence keys;
- scanner structured-only invariants and receipt/projection separation;
- purpose-discriminated bug/review analysis and pre-decryption surface
  binding, including explicit-null rejection;
- partial drafts, explicit final submission, and security-report routing;
- header-only final-submission idempotency with duplicate body IDs rejected;
- exact bug/review acceptance cooldowns and bounded context projections;
- bounded draft/acceptance receipts and a closed structured-only result;
- bounded consented game diagnostics with no pixel/fingerprint surface;
- exact report windows, derived rates/statistics, diagnostic distributions,
  advisory counts/recommendations, checkpoints, and manifests;
- child-schema/parent-schema composition without metadata drift;
- v4-only opaque workflow identifiers, closed renderer diagnostics, and
  server-projected surface matching;
- public whole-window and per-week ten-review thresholds;
- thresholded preceding-window comparison and exact public trend derivation;
- present and absent optional encrypted/hashed PII round trips.
