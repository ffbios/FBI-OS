# FBI Digital Ecosystem Inventory

**Snapshot date:** 2026-10-15  
**Purpose:** A working inventory from GitHub repository metadata and Railway deployment metadata. This is not a full runtime or security audit.

> A Railway `SUCCESS` deployment is not proof of current runtime health. A crashed deployment is a strong investigation signal, but its root cause has not yet been diagnosed.

## 1. Application and repository inventory

| System | GitHub repository / branch | Canonical or current URL | Last observed deployment evidence | Notes |
|---|---|---|---|---|
| FBI GH public website / FBI-OS | `ffbios/FBI-OS` / `main` | https://fbigh.com/ | Railway deployment reported `SUCCESS` on 2026-10-12 | Also serves the Admin Hub at `/admin`. The Admin Hub's account gate is browser-side, not server-verified authentication. |
| Invoice Studio | `ffbios/fbi-invoice-studio-cloud` / `main` | https://invoice.fbigh.com/ | Main service reported `SUCCESS` on 2026-10-12 | `https://fbighinvoice.net` is also mapped to the service. PostgreSQL is a separate service in the same Railway project. |
| Invoice Staff Portal | `ffbios/fbi-invoice-studio-cloud` / `main` | https://fbi-staff-invoice-portal-production.up.railway.app/ | Service reported `SUCCESS` on 2026-10-12 | Preserve this service and its user experience. Do not modify it as part of the first ecosystem phase. |
| Client File Studio | `ffbios/ffbios-fbi-client-file-studio` / `main` | https://files.fbigh.com/portal | Main service reported `SUCCESS` on 2026-10-13 | Owns creative delivery data and object storage. A separate Railway production patch has 29 staged changes; it has not been applied in this inventory. |
| FBI Live standalone | Same Client File Studio repository / `main` | https://live.fbigh.com/ | Service reported `SUCCESS` on 2026-10-13 | Streaming services share a Railway project with Client File Studio, but should remain operationally isolated by responsibility. |
| FBI TV viewer route / playout | Same Client File Studio repository / `main` | https://live.fbigh.com/tv | Playout service reported `SUCCESS` on 2026-10-13 | The separate Railway project named FBI TV has a staged-only service creation; the relationship should be clarified before that staged change is applied. |
| IT Command Center | `ffbios/fbi-it-command-center` / `main` | https://it-command-center-production-7f71.up.railway.app/ | Service and PostgreSQL reported `SUCCESS` on 2026-10-14 | No custom `it.fbigh.com` domain was present in the checked domain list. The repository documents role enforcement, audit logs, integrations framework and site-agent monitoring. |
| Salary Sheet | `ffbios/salary-sheet` / `main` | https://salary-sheet-production.up.railway.app/ | Service reported `SUCCESS` on 2026-10-10 | Keep separate until its data model and intended relationship with Invoice Studio payroll have been reconciled. |
| Driver Daily Profit | Repository/service wiring needs confirmation from its Railway service configuration | https://driver-daily-profit-app-production.up.railway.app/ | App service last reported `CRASHED` on 2026-10-07; its PostgreSQL deployment reported `SUCCESS` | Investigation required before it is treated as an available system. No root cause established yet. |
| FBI Live control-room redesign preview | `ffbios/ffbios-fbi-client-file-studio` / `control-room-redesign` | Railway preview environment | Preview service reported `SUCCESS` on 2026-10-10 | Keep isolated. Do not merge to `main` without an explicit review and approval. |
| FBI Admin Postgres | Infrastructure in the FBI Digital Platform Railway project | No end-user URL | Last deployment reported `CRASHED` on 2026-10-02 | Confirm whether anything depends on it before attempting recovery, replacement, or removal. Do not delete it as cleanup. |

## 2. Data ownership boundaries

| Data domain | Current owner to treat as authoritative | Integration approach |
|---|---|---|
| Quotes, invoices, receipts and invoicing clients | Invoice Studio PostgreSQL and APIs | Read approved summaries via protected server-side API; do not connect other apps directly to its database. |
| Existing Invoice Studio staff/payroll functions | Invoice Studio's existing schema and payroll routes | Keep current staff portal untouched; reconcile before introducing another payroll source. |
| Creative projects, files, client delivery and subscription entitlements | Client File Studio PostgreSQL plus its S3-compatible object storage | Integrate through APIs; preserve source media and existing storage entitlements. |
| Live ingest/playout/stream state | Relevant live/MediaMTX/ingest services | Separate health checks from client-file health. Avoid coupling business applications to a stream process. |
| Installation sites, devices, incidents, maintenance and monitoring audit | IT Command Center PostgreSQL | Use documented endpoints and explicit cross-system IDs. Vendor credentials stay encrypted and write-only. |
| Salary-sheet calculations | Salary Sheet's own current implementation | No automatic mirroring until calculation rules and authority are agreed. |
| Driver daily earnings and expenses | Driver Daily Profit database once restored and verified | Reconcile with the accounting/reporting design before treating it as official company revenue. |
| Public company/talent/media information | FBI GH public website and appropriate content system | Public publishing workflow, separate from administrative records. |

## 3. Important deployment observations

### Driver Daily Profit
The application service is reported as crashed in the production environment. First inspect deployment logs, start command, function configuration, and database connection references. Do not recreate the service or database blindly, and do not delete the PostgreSQL volume.

### FBI Admin Postgres
A PostgreSQL deployment in the FBI Digital Platform project is reported as crashed. The current public website repository uses a static front end and a Node server; usage of this separate database must be established before recovery decisions are made.

### Client File Studio staged changes
The production environment has a staged patch with 29 changes, including a staged-create service named `FBI Live Recorder`. This inventory deliberately does not accept the patch. Review the full staged diff and storage/volume implications first.

### Separate FBI TV project
The separate project has one staged-only service creation and no deployed service in the observed environment inventory. The deployed `FBI TV Playout` service is in the Client File Studio project. Decide whether the separate project is needed before applying its staged service creation.

### Admin Hub snapshot routes
The current FBI-OS server has `/api/admin/invoice-snapshot` and `/api/admin/files-snapshot` proxy routes. They check whether `FBI_ADMIN_SHARED_TOKEN` is configured and pass it to their upstreams, but do not enforce a server-verified administrator session before serving the proxy request. The variable names are present in Railway's configuration listing, but their values were not inspected. Treat this as a potential data-exposure issue until it is validated and mitigated.

The Admin Hub login uses `localStorage` / `sessionStorage` for its account and session marker. This is not sufficient for protecting sensitive operational data. It must not be treated as the ecosystem's identity provider.

## 4. Observations still to collect

- Latest application logs and runtime health checks for every user-facing service.
- Exact database schemas and migration status for Invoice Studio, Client File Studio, Salary Sheet and Driver Daily Profit.
- Backup schedules, retention, and successful restore-test evidence for each PostgreSQL database.
- Object-storage backup/replication and restore evidence for Client File Studio originals.
- Authentication/authorization contract for every management API.
- Confirmed business owners and support/recovery process per service.
- Actual custom-domain decision for the IT Command Center.
- Whether the separate FBI TV Railway project still has a purpose after the current playout service was deployed.
