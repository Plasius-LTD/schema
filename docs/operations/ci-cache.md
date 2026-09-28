# CI dependency caches

GitHub-hosted CI jobs use the npm cache service. Persistent self-hosted jobs retain their local npm cache and do not export it through setup-node after validation. This prevents a growing shared cache or cache-service outage from holding a completed validation job and its downstream release.

Every job still performs npm ci from the committed lockfile and runs all existing validation. No success status is synthesized, and publication still requires successful CI for the exact prepared main commit. This setting does not alter runner selection, fork admission, permissions, or production approvals.

If hosted caching needs rollback, omit the cache input and use clean dependency installation; never disable a validation gate to recover cache performance.
