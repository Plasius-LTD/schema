# Shared OIDC release-template alignment

Task #84 restores the required controls reported by the package release audit.
The owner requires glob to consume the schema template without a package-specific
npm credential. Fix the shared workflow before propagating it to that consumer.

Both validation and publication install approved npm 11.6.2 before checking the
Node 24 / npm minimum runtime. Immediately before npm publication, fetch main,
compare its SHA with the prepared commit, and stop if fetch fails or main moved.
Keep the existing check before the first release mutation, sealed artifacts,
provenance, hosted production OIDC and registry integrity checks unchanged.
No npm token, alternative publishing path or dependency change is introduced.

The regression suite runs the actual publication fence for matching and moved
main plus fetch failure. The full schema suite and existing release-integrity
auditor validate the resulting template before glob adopts the exact same file.
