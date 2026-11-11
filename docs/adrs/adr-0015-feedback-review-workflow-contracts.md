# ADR-0015: Actor-free feedback review workflow contracts

- Status: Accepted
- Date: 2026-11-11
- Work: schema Task #62; site Story #2193, Feature #1662, Epic #1659

## Context

Authorised owners/admins need an explicit feedback review queue shared by
HTTP and both MCP surfaces. Reviewing must neither expose a reporter nor
alter accepted feedback or satisfaction statistics. The existing packet and
acceptance contracts are already published and must remain unchanged. Extending
them with mutable reviewer state would couple independent retention and access
policies; untyped transport objects would duplicate validation across surfaces.

## Decision

Publish a separate workflow contract version with strict exact-identity,
unknown-field-rejecting schemas. Retain only packet identity, kind, closed
filter fields, state/outcome, revisions and server timestamps. Bug and review
filters are mutually exclusive. There are no free-text, identity, attachment,
external-reference, assignment, or reporter-control fields.

Initial revision 1 is unreviewed. `mark-reviewed` produces revision 2;
`process` produces odd revisions with one fixed outcome; `reopen` produces
even revisions with no current outcome. History retains the previous
processing outcome in the immutable earlier event. Commands cannot mark an
item merely because it was read. Revision overflow is rejected.

Per-operation random audit linkage and idempotency metadata belong in a
separate server-only receipt; they are never stable reviewer pseudonyms.
Change-feed continuations are internal fields, distinct from authenticated,
filter-bound public cursors. Neither token authenticity nor authorisation
can be established by schema validation alone.

State/history carry `expiresAt` anchored to original feedback acceptance,
with maximum 90-day bug/395-day review retention and valid UTC chronology.
The entity/service layer must preserve the exact original expiry across
updates and calculate remaining TTL. It must also validate matching durable
acceptance receipts, atomically commit transitions/history/receipts, and
durably audit administrator intent separately. These are not schema side
effects.

Queue pages are bounded to 100 items and history to 25 events. Queue filters
include an explicit bounded date range. Nested public projections inherit
their enclosing contract version. A detail response combines state and
a bounded history page for the same packet, accepting only history consistent
with the state's original expiry and no later than its current revision.
Freshness is incomplete until backfill
finishes and stale after ten minutes without successful projection. An
unavailable projection cannot masquerade as a complete empty queue.

## Consequences

- All transport surfaces can share exact validation and closed vocabulary.
- Existing feedback packet schemas, counts and suppression remain untouched.
- Contracts make no blanket anonymisation claim: packet IDs and precise
  server timestamps still require restricted reviewer access and no external
  identity joins. Administrative audit identity remains separately protected.
- No dependencies, services, throughput allocations or telemetry senders are
  added. Runtime access control, retention enforcement and cost gates remain
  site/entity responsibilities.

## Validation and dependency audit

Requirements-first tests fail on the unchanged baseline because these exports
do not exist. Malformed opaque values must fail without coercion or throwing. The tests cover closed contracts, synthetic identity
canaries, invalid transitions/retention, page bounds, history and freshness.
Existing `@plasius/schema` builders provide every required operation; no new
library or dependency update is necessary. Reuse the published schema release before downstream work.

The parent feature's `feedback.admin.enabled` and `feedback.mcp.enabled`
flags remain unchanged. The site must register and keep the new
`feedback.review-workflow.enabled` and `feedback.processing.enabled` controls
disabled until the separate deployment and acceptance work is ready. This
package neither evaluates flags nor grants access. Roll back adoption by
retaining the previous package version or keeping the consuming workflow off.

This pure contract package does not emit application events, make network
requests, or maintain runtime queues; host event NFR hooks are therefore not
applicable to this change. CI, packaging and changed-source coverage remain
mandatory release gates.
