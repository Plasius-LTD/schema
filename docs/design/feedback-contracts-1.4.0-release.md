# Feedback contracts 1.4.0 release readiness

## Tracked work

- Task: `Plasius-LTD/schema#32`
- Parent story: `Plasius-LTD/plasius-ltd-site#1666`
- Inherited rollout controls: the site feedback feature flags and capabilities
  documented by the parent story; package publication itself is not flaggable.

## SemVer intent

The approved stable target is `@plasius/schema@1.4.0`. The current source and
public registry version is `1.3.1`; `1.4.0` is therefore a minor release for the
new feedback contract surface. Release metadata must not be edited manually.
From protected `main`, an operator dispatches `.github/workflows/cd.yml` with:

- `phase`: `prepare`
- `bump`: `minor`
- `preid`: empty

The exact-main release workflow owns the resulting `package.json`, lockfile,
changelog release section, tag, provenance, and publication.

## Required public contract surface

The release must preserve these public exports:

- `@plasius/schema`
- `@plasius/schema/feedback-diagnostics`
- `@plasius/schema/feedback-diagnostics-vocabulary`
- `@plasius/schema/feedback-unicode-profile`
- `@plasius/schema/unicode/feedback-unicode-15.1.0-unassigned.json`
- `@plasius/schema/package.json`

The root export must continue to expose the closed feedback intake, structured
packet, diagnostics, hourly/daily report, checkpoint, and public-summary
schemas required by Task #32.

## Release admission

Before dispatch, all of the following must be true:

- dependency install, lint, typecheck, build, unit tests, privacy-policy tests,
  coverage, full dependency audit, and collision-free exact `pack:check` pass;
- the proposed Git index and package manifest pass the path-only privacy gate;
- the digest-verified sealed tarball passes the same raw-member identity,
  cardinality, normalization-collision, and exact-inventory policy immediately
  before publication;
- installed-package probes resolve every typed feedback subpath with ESM,
  CommonJS, NodeNext TypeScript, and classic CommonJS TypeScript resolution;
- CI succeeds for the exact protected `main` commit;
- the previously exposed inherited npm credential is revoked or rotated;
- npm organization owners satisfy enforced 2FA;
- the npm trusted publisher is bound exactly to organization `Plasius-LTD`,
  repository `schema`, workflow `cd.yml`, and environment `production`;
- GitHub `main` and `production` environment protections are active.

There is no local-publish or token fallback. If any admission check is
unverified, the release remains blocked while code can continue to be prepared.

## Post-release evidence

Verify the publish-phase `cd.yml` run succeeded, the npm registry exposes
exactly version `1.4.0`, package integrity matches the immutable workflow
tarball, provenance identifies the exact `main` commit, and every required
feedback subpath imports successfully in ESM and CommonJS consumers.
