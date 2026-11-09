# ADR-0014: Validate public release notes

Status: Accepted

## Context

The public schema repository records each npm release in its changelog. The
previous release workflow seeded empty categories with placeholders and manufactured a
note when Unreleased was empty. Readers could not tell which entries documented
a change. [Schema #35](https://github.com/Plasius-LTD/schema/issues/35) tracks
this work under [Feature #1022](https://github.com/Plasius-LTD/plasius-ltd-site/issues/1022).

## Decision

Use the same dependency-free Node changelog policy as the storage package.
Release preparation promotes real entries from Unreleased, omits empty
categories, retains old version headings and links, and starts a blank
Unreleased section. It fails before staging release metadata when the notes
are absent, synthetic, or contain placeholders. The package gate checks the
whole changelog so a normal CI check and the read-only release validation reject
the same invalid content. This is a local file transformation with no network,
credentials, or access to application data.

A lint-only rule would catch invalid committed notes but would leave the
generator free to recreate them. Keeping the transformation and the validator
together lets unit tests exercise promotion, link preservation, repeat
preparation, and failure without publishing.

## Release and rollback

The backend-evaluated `platform.public-artifact-integrity.enabled` flag
coordinates public artifact admission. It can be disabled to suspend admission
while a correction is prepared, then re-enabled once verification passes. Note
validation applies in both states. No product capability or schema runtime
behavior changes.

Publish only through the protected main/production flow in ADR-0008. If the
release path needs containment, pause `cd.yml` and repair the notes or
validator through a PR. Preserve existing immutable packages, release tags, and
the npm trusted-publisher configuration.
