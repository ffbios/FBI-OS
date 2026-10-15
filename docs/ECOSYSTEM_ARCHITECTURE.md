# FBI Digital Ecosystem Architecture

**Status:** Foundation proposal, not yet approved for production rollout  
**Reviewed:** 2026-10-15  
**Repository:** `ffbios/FBI-OS`  
**Working branch:** `ecosystem-foundation`

## 1. Objective

Build a dependable digital ecosystem for Film Beyond Imagination / FBI GH from the applications already in use. The goal is to connect the systems where doing so creates clear value, while keeping each application independently deployable and protecting existing production data.

This is an integration programme, not a rewrite. Existing applications remain the owners of their data until a reviewed API contract says otherwise.

## 2. Current design principles

1. **Inspect before changing.** Review the source, deployment, data ownership, current users, and recovery path before modifying any live system.
2. **Keep production isolated.** Work in feature branches and preview environments. No automatic merge to `main`, no production deployment, and no acceptance of staged Railway changes without an explicit review and approval.
3. **One owner per kind of data.** An application writes to its own database. Other systems use documented, authenticated APIs rather than connecting directly to its database.
4. **No assumed health.** A successful deployment only proves that Railway reported a successful deployment. Runtime health must come from a health endpoint or a real synthetic check.
5. **Fail independently.** A media-streaming incident must not take invoicing down. The public website should remain available if a back-office system is unavailable.
6. **Secure the server, not just the screen.** Browser local storage, a hidden URL, or a front-end password prompt is not administrator authentication.
7. **Preserve originals and history.** File Studio originals, invoices, payroll history, audit records, and installation records must not be overwritten or silently migrated during integration.
8. **Ghana-first operations.** Display money in GHS where appropriate, use Africa/Accra for user-facing timestamps, and keep timezone conversion explicit in APIs.

## 3. Target architecture

```text
                         FBI Digital HQ
                 (secure admin + service directory)
                              |
                 authenticated API / health checks
                              |
       +----------------------+-----------------------+
       |                      |                       |
 Business operations    Creative & broadcast     Technical operations
       |                      |                       |
 Invoice Studio         Client File Studio       IT Command Center
 staff portal           FBI Live / Playout       site monitoring agents
 quotes / invoices      object storage           installations / devices
       |                      |                       |
 own PostgreSQL         own PostgreSQL + bucket  own PostgreSQL
       |
 Payroll / salary tools remain separately owned until schema and workflow
 reviews confirm the correct integration path.
```

The diagram describes the intended direction, not a claim that the connections already exist.

## 4. System responsibilities

| System | Owns | Does not become |
|---|---|---|
| FBI GH website / FBI-OS | Public company information and the initial system directory | The shared database for every application |
| Invoice Studio | Quotes, invoices, client invoicing data, receipts and its existing staff/payroll capabilities | A direct SQL endpoint for other apps |
| Invoice Staff Portal | Existing staff access experience tied to Invoice Studio | A service to rebuild during ecosystem work |
| Client File Studio | Creative projects, delivery access, file metadata, subscriptions and object-storage workflows | The source of truth for invoices or device inventory |
| FBI Live / playout services | Stream ingest, playback, playout and recording functions | A dependency required for unrelated back-office work |
| IT Command Center | Clients/sites as represented there, installations, devices, incidents, maintenance, checks, audit and monitoring-agent records | A credential store for raw vendor passwords |
| Salary Sheet | Its current salary-sheet workflow | A replacement for Invoice Studio payroll before a reconciliation plan exists |
| Driver Daily Profit | Driver-specific daily earnings, fuel, service fees and expenses when restored | An unreviewed source for company-wide accounting |
| FBI TV | Public TV/episode identity and viewer experience, coordinated with its current playout implementation | A second competing streaming engine |

## 5. Identity and access strategy

### Current limitation

The current FBI Admin Hub sign-in state is stored in browser local storage/session storage. That can provide a local UI gate, but it is not a reliable identity system: users can create independent browser-side accounts, and it does not establish a server-verified administrator identity.

The main branch's server-to-server snapshot proxy routes for Invoice Studio and Client File Studio check for a configured shared token but do not establish an authenticated administrator session before relaying snapshots. The relevant variable names are present in Railway configuration (values were not read). The `ecosystem-foundation` working branch now enforces server-verified sessions and role checks on both proxy routes before returning HTTP 503 while the downstream API contracts are unfinished. This mitigation is branch-only; production remains unchanged until an approved release.

**Required before operational data is shown in the hub:**
- Server-verified sign-in with a protected deployment-configured user directory. A durable database-backed account directory and account-management UI remain future work.
- Random opaque HttpOnly/SameSite cookies, session revocation and an eight-hour expiry. Sessions currently live in process memory and require one replica until a shared session store is added.
- Same-origin validation for login/logout and a CSRF token requirement for logout.
- Server-enforced role/permission checks on every protected route.
- In-memory login throttling, session revocation, and sanitized audit events. A shared rate-limit store is required before scaling.
- No secrets in browser code, local storage, repository files, or API responses.
- Server-to-server integration credentials scoped to the minimum required routes.
- Temporary disablement of snapshot routes until authenticated access is enforced and tested.

A future single sign-on system can be considered after stable identity and authorization boundaries exist. Do not duplicate passwords between applications or silently merge existing accounts.

## 6. API and data-sharing rules

- Every integration has a named owning service, a versioned endpoint contract, and a documented purpose.
- Use HTTPS and server-to-server credentials. Never put integration secrets in front-end JavaScript.
- Set explicit request timeouts, validate response schemas, cap payload size, and return a neutral degraded/unknown state on failure.
- Do not expose raw database rows or credentials in dashboard summaries.
- Use stable external IDs and an explicit mapping table before linking records across separate databases.
- Prefer idempotent operations for retries and write actions.
- Log who requested or changed a record, which system performed it, and the correlation/request ID where appropriate.
- Avoid two-way synchronization until conflict ownership and reconciliation rules are written.
- Do not change public subscription quotas, price plans, or existing customer entitlements as part of ecosystem work.

## 7. Operational standards

### Health states

Use distinct states:
- **Healthy:** a current runtime health check succeeded.
- **Degraded:** the app responds, but one or more critical dependencies or checks fail.
- **Unavailable:** a current health check failed.
- **Unknown:** no reliable current check exists.
- **Attention required:** an observed deployment or configuration issue needs investigation.

Always display the check time. Do not calculate an all-systems-green summary if one or more checks are unknown.

### Release policy

1. Inspect current branch, latest deployment, environment variables by name only, dependencies, and pending staged changes.
2. Work in a feature branch.
3. Add tests for the touched behavior and run relevant existing tests on a disposable test database where required.
4. Review the diff and security implications.
5. Deploy a preview environment only when its data, storage, and secrets are isolated from production.
6. Verify rollback and database compatibility.
7. Ask before merging to `main` or applying a production deployment.
8. After release, check runtime health, logs, critical workflows, and backups.

## 8. Initial integration workflow

The first cross-system workflow to target is:

1. An authorised operator creates or confirms a client record.
2. An installation or production job is recorded in the appropriate owning system.
3. A quote/invoice is created in Invoice Studio.
4. Creative deliverables are published in Client File Studio, or technical installation records are maintained in the IT Command Center.
5. Only approved summary data is exposed to management reporting through APIs.
6. Reconciliation and audit history remain available in each source system.

This workflow is a future acceptance target. No end-to-end integration should be claimed until it is implemented and tested.

## 9. Immediate blockers

- Verify and secure the Admin Hub snapshot proxy routes before relying on them for private business data.
- Investigate the currently crashed Driver Daily Profit app and FBI Admin Postgres deployment.
- Inspect the 29 staged production changes in Client File Studio before accepting them.
- Inspect the staged service in the separate FBI TV Railway project before deciding whether that project is needed.
- Verify PostgreSQL and object-storage backups through a restore test, not just the presence of a backup service.
- Keep the Invoice Staff Portal untouched during the initial ecosystem foundation work.

## 10. Definition of done for the foundation phase

- The system inventory and data ownership are reviewed.
- No production deployment or staged change has been applied accidentally.
- The Admin Hub's server-side authentication model is decided and its snapshot routes are no longer anonymously accessible.
- Every registered app has a canonical URL, purpose, owner, current evidence, and recovery contact/process.
- Runtime health is reported as observed data, with timestamps and an explicit unknown state.
- The first client-to-job-to-invoice-to-delivery workflow has approved API contracts and test cases before implementation.
