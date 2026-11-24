# ADR-0016: Shared first package registration

Status: Accepted for implementation; publication remains subject to all release gates.
Date: 2026-11-24
Parent Feature: Plasius-LTD/plasius-ltd-site#1597
Parent Story: Plasius-LTD/plasius-ltd-site#2547
Task: Plasius-LTD/schema#87

## Context

The owner requested publication of five packages that do not exist in npm and
required Glob to match Schema without arbitrary new secret names. npm requires
initial registration before an authenticated owner can configure a trusted
publisher. Package-specific bootstrap workflows had diverged from the template.

## Decision

Keep the exact-main, hosted, production, sealed-artifact workflow from ADR-0008.
Add one shared explicit default-off registration branch using the standard
`NPM_TOKEN`, limited to reviewed repository/package/initial-version enrollment
and one confirmed anonymous HTTP404. Schema is not enrolled. No missing binding
or OIDC failure activates registration. Network, auth, redirect, identity and
enrollment failures refuse publication. Credentials remain isolated to the final
step and its mode-0600 temporary config, with cleanup on every exit. No package
or dependency scripts run with the credential.

The [design](../design/first-package-registration.md) defines requirements and
tests. Each enrollment is removed after verified first publication, and an
ordinary OIDC release verifies handover. Existing immutable tags and all
integrity/coverage/CI/CD gates remain in force. Temporary credentials are removed
and revoked only when their intended registrations no longer require them.

## Consequences

Schema consumers share one implementation and one standard secret name.
Registration and OIDC verification remain distinct delivery obligations. A fresh
owner login and 2FA configure trust; CI cannot perform owner-account operations.
Published packages have no enrollment and cannot reuse this branch after later
registry removal. The stored `platform.public-artifact-integrity.enabled` flag
controls distribution rollout, never mandatory integrity checks. No product
capability or runtime setting is changed.
