# FBI Ecosystem Delivery Roadmap

**State:** Proposed execution plan  
**Last reviewed:** 2026-10-15

## Guiding rule

Stabilize and secure first, then connect workflows. Do not replace working applications just to make the architecture look uniform. No production change is included in this roadmap commit.

## Phase 0: Protect and baseline

**Goal:** Know what is live, what is broken, and what must not be touched.

- [x] Enumerate the current GitHub repositories and relevant Railway projects.
- [x] Record observed domains and the latest deployment states.
- [x] Identify production staged changes and keep them unapplied.
- [x] Identify the separate Invoice Staff Portal as a protected existing service.
- [x] Disable both unauthenticated snapshot proxy routes in `ecosystem-foundation` with HTTP 503 pending server-side authorization.
- [ ] Review the branch and deploy the mitigation through an approved release; production is unchanged until then.
- [ ] Inspect the full pending Client File Studio production patch before any acceptance.
- [ ] Diagnose Driver Daily Profit's crashed application service.
- [ ] Investigate the crashed FBI Admin Postgres deployment and determine dependencies.
- [ ] Confirm database and object-storage backup/restore procedures.

**Exit criteria:** no unresolved anonymous access to private operational data; deployment and data recovery paths documented; known broken services have root causes or approved recovery plans.

## Phase 1: Secure Digital HQ

**Goal:** Convert the current Admin Hub into a trustworthy ecosystem entry point.

- Replace browser-only account setup and session markers with server-verified authentication.
- Add server-side roles and permissions, starting with Super Administrator, Administrator, Manager and Read-Only Viewer. Map actions explicitly rather than relying on visual hiding.
- Add secure cookie sessions, CSRF protection, login throttling, audit events, session revocation and safe account recovery.
- Disable operational snapshot proxy routes until authorization checks are enforced.
- Use a registry for canonical links, owners, service purpose, environment, deployment evidence and health-check URL.
- Add a system status panel with **Healthy / Degraded / Unavailable / Unknown / Attention required** states, each timestamped.
- Keep the portal read-only at first. It should not edit invoices, payments, staff, file entitlements, installations or deployment settings.

**Exit criteria:** unauthenticated users cannot read administrative summaries; route-level authorization tests pass; a failed upstream becomes Unknown/Unavailable instead of a false green status; direct links open the intended existing applications.

## Phase 2: Reliable operational visibility

**Goal:** Report what is true now, not what was true at the last deploy.

- Verify health endpoints and dependency checks for each app.
- Use server-side polling with short timeouts, bounded concurrency, and no secret leakage.
- Record check time, latency, status and sanitized error category.
- Add a deployment history panel sourced from trusted deployment metadata; distinguish deployment success from runtime health.
- Alert on sustained failure, not on a single transient timeout.
- Add backup freshness and last successful restore evidence as separate indicators from application health.

**Exit criteria:** the dashboard correctly shows current health and unknowns, and can explain why a system is marked degraded.

## Phase 3: Common organization and client references

**Goal:** Link client/work records without sharing or merging databases.

- Choose a stable ecosystem client ID format.
- Build an explicit mapping between that ID and each existing system's client/site/project ID.
- Define ownership for legal name, contact details, billing address and site/location.
- Add API contracts and schema validation before reading or writing external records.
- Avoid bulk data migration until duplicate resolution, rollback and reconciliation are tested on copies.

**Exit criteria:** one client can be unambiguously linked across systems while each source remains authoritative for its own data.

## Phase 4: First cross-system business workflow

**Goal:** Connect a real workflow with auditability and no duplicate manual entry where safe.

Proposed first workflow:
1. Confirm a client in the appropriate owning system.
2. Create a job, production booking or installation record in its owner system.
3. Generate a quote/invoice through Invoice Studio.
4. Link the relevant invoice reference to the job without copying the full financial record.
5. Link the delivered files or installation report through the owning system.
6. Show authorised management a summary using read-only APIs.
7. Reconcile failures and preserve per-system audit history.

Start with a test client and synthetic/test records. Production customer records and payments must not be used for integration tests unless explicitly approved.

**Exit criteria:** repeat requests are idempotent, permissions are tested, partial failures can be retried safely, and an end-to-end trace can be followed.

## Phase 5: Shared sign-on and controlled automation

**Goal:** Reduce friction without creating a single point of failure.

- Evaluate an established OpenID Connect identity provider for SSO; do not invent a home-grown cross-application password protocol.
- Map central identities to application roles. Existing accounts should be linked intentionally, never silently merged.
- Add event-based notifications only after ownership, retries, deduplication and audit rules are defined.
- Keep write-capable automation off until dry-run, approval, and rollback behavior are tested.

**Exit criteria:** disabling a user revokes ecosystem access, applications continue to protect their own APIs, and a central identity outage does not corrupt business records.

## Phase 6: Commercial and scale readiness

- Measure real active users, upload volume, storage growth, streaming bandwidth, cost per customer and support burden.
- Validate subscription activation against server-verified payments and webhooks.
- Test upload resumption, file integrity, object-storage recovery and resource limits.
- Establish incident response, release notes, change approvals and a recurring access review.
- Expand only when uptime, data recovery and unit economics meet an agreed threshold.

## Release gates for every phase

A feature is not complete just because it renders in the browser. It must have relevant tests, authorization checks, migration/rollback notes, log evidence, a preview review, and a post-release verification plan. Production deployment or merge to `main` requires explicit approval.
