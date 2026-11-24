# First package registration through the shared release template

The owner requested publication of the five unregistered packages on 24 November
2026: glob, game-runtime, game-multiplayer, arcade-games and learning-runtime.
npm requires a package to exist before an owner can configure its trusted
publisher. Registration must remain in main `cd.yml`, on the GitHub-hosted
publisher using the `production` environment, after successful exact-commit CI.

## Shared mechanism

Extend the Schema template with an explicit, default-off `first_publication`
input propagated unchanged from release preparation to the exact-commit publish
run. Ordinary publication remains OIDC-only. There is no automatic token
fallback after an OIDC error.

First registration uses the existing standard secret name `NPM_TOKEN`, only in
the isolated final publication step. A fresh, narrowly scoped, one-day credential
is used for the initial registrations and removed/revoked after registry
verification and trusted-publisher setup. No package-specific secret is created.

Each enrolled repository has a reviewed `.github/npm-first-publication.json`
descriptor containing only its exact repository, package name and initial
version. The shared verifier rejects missing, malformed or extra descriptor
fields; all identity/version/commit mismatches; non-main or non-dispatch runs;
absent credentials; existing packages; redirects; authentication failures; and
network failures. Anonymous registry absence must be one confirmed HTTP404 with
a ten-second deadline. Only the five owner-requested repository/package pairs
are enrolled by this delivery. Schema has no descriptor and cannot use the
registration branch.

The step rechecks current main immediately before mutation, writes a mode-0600
temporary npm configuration under the runner temporary directory, uses the
already sealed tarball with scripts disabled and provenance enabled, and removes
the temporary configuration on every exit. It retains all existing artifact,
version, immutable-tag, integrity and provenance checks. No local publication,
placeholder package or alternate workflow is introduced.

## Delivery and retirement

Use unused initial versions allocated by the existing release pipeline; retain
all earlier immutable tags. Glob publishes first so the existing arcade owner
can finish the approved matcher/tooling removal before arcade package delivery.
The existing owners retain source changes and qualification gates. Package
publication enables no site feature or game.

After each registration, verify registry bytes, provenance and packed consumers,
configure the exact repository / `cd.yml` / `production` npm trusted publisher
with direct publishing allowed, remove the repository's descriptor through a
reviewed PR, and verify an ordinary OIDC release within the new binding's
two-day first-use window. Descriptor removal disables first registration even
if a later registry request returns 404. Ordinary published-package use never
needs `NPM_TOKEN`.

## Requirements-derived tests

- Missing/malformed/extra descriptors and identity, version, opt-in, credential,
  workflow, ref, event, checkout or expected-commit mismatch fail before network
  access and without credential-bearing output.
- Exactly HTTP404 succeeds; existing, redirect, auth, server, timeout and network
  failures refuse registration.
- Real publication-shell tests prove main-move refusal, immutable tarball use,
  restricted temporary config, credential cleanup on success/failure, no secret
  output, scripts disabled and no token in the normal OIDC step.
- Workflow forwarding preserves false/true exactly; the default is false.
- The site release auditor accepts only the reviewed template, helper and exact
  enrolled descriptors, preserves the prior arcade route during migration, and
  rejects altered or unapproved routes. Schema's absent descriptor is explicitly
  covered as an unavailable registration path.
- All affected source/helper files appear in LCOV, coverage remains at least
  80%, and existing package tests, types, lint, build, audit, privacy and pack
  checks remain required. README, Unreleased and ADRs explain the shared route.

## Governance

Parent Feature: Plasius-LTD/plasius-ltd-site#1597. Inherited stored control:
`platform.public-artifact-integrity.enabled`; integrity checks remain
unconditional. No product capability or runtime rollout setting changes.

Parent Story: Plasius-LTD/plasius-ltd-site#2547. Shared-template Task:
Plasius-LTD/schema#87. Each affected package and the site auditor have separate
linked Tasks; existing source-delivery owners retain their implementation work.
