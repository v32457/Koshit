# 09_PRODUCTION_ACCEPTANCE_MATRIX.md — CIPPlatform Production Acceptance Matrix

**Audit Date:** 2026-10-31
**Repository:** CIPPlatform/Koshit
**Branch:** main
**Commit:** 08943b07d64355b04523700604243be34e040cbf

## Instructions

Use these statuses consistently across every module and critical workflow:

- **PASS** — Executed successfully with recorded evidence.
- **FAIL** — A defect was reproduced or a required behavior failed.
- **BLOCKED** — A required credential, external service, database, environment, permission, or human action is unavailable.
- **NOT TESTED** — No adequate verification was performed.
- **NOT APPLICABLE** — The requirement does not apply, with a brief explanation.

Never convert BLOCKED, NOT TESTED, or NOT APPLICABLE into PASS.

Do not declare the whole platform production-ready while any critical workflow has a FAIL or BLOCKED status.

---

## Production Acceptance Matrix

| # | Module / Critical Workflow | Status | Evidence / Notes |
|---|---------------------------|--------|-----------------|
| 1 | App shell and route navigation | PASS | `npm run build` succeeds; all routes render; `npm test` passes. |
| 2 | Dashboard — SAP sync actions (Force Sync, Retry DLQ) | FAIL (fixed) | Previously fabricated `SAP_CREATED`/`SYNCED` states via `setTimeout`; now shows `BLOCKED` message with no state mutation. (D01, D02) |
| 3 | Dashboard — SAP health banner and widget | FAIL (fixed) | Previously claimed `Service Layer Online` with pulsing animate-pulse and fabricated `42 ms` latency / `20/20 PASSED`; now shows `Service Layer Not Configured` with no fabricated metrics. (D02) |
| 4 | Dashboard — Activity feed | FAIL (fixed) | Previously hardcoded `SAP B1 HANA Synchronized` entry; now reflects actual governance actions only. (D03) |
| 5 | Business Partner Master — Document upload sizes | FAIL (fixed) | Previously `Math.floor(Math.random() * 1500000) + 200000`; now uses actual `doc.size` from File object. (D04) |
| 6 | Business Partner Master — VERIFIED without provider evidence | FAIL | 12 `business_partners` rows labelled `gst_status='VERIFIED'` but no `gst_verifications` provider metadata; downgrade migration recommended (D19). |
| 7 | Integration / SAP — All 20 test results | BLOCKED | All tests `NOT_RUN`: `'Not executed: the SAP Business One Service Layer connector, credentials, and scheduler are not implemented in the backend.'` (D10). |
| 8 | Integration / SAP — Activation gated checklist | BLOCKED | All 5 preconditions shown as NOT CONFIGURED/NOT EXECUTED/NOT VERIFIED; decision `NOT APPROVED` (D11, D12, D13). |
| 9 | Integration / SAP — Monitor & DLQ queue | BLOCKED | Shows `None recorded`, `0`, `No queue backend`, `Not available` (no fake `1 Item Created in HANA` / `100% Parity`). (D14) |
| 10 | Integration / SAP — Emergency stop / reactivate | BLOCKED | Emergency stop unavailable: `no SAP connector or server-side scheduler is implemented, so there is no live sync to suspend or resume.` Button shows `Sync Control Unavailable`. (D15) |
| 11 | Communication / Email — Connection test | BLOCKED | Shows `NOT_RUN: No SMTP server configuration present. Set SMTP host, port, auth mode, and TLS mode to enable testing.` (D05). |
| 12 | Communication / Email — Delivered metric | FAIL (fixed) | Previously `+ 42` synthetic addition; now uses actual `deliveryQueue.filter((q) => q.status === 'DELIVERED').length` only. (D08) |
| 13 | Communication / WhatsApp — Graph API test | BLOCKED | Shows `NOT_RUN: No WhatsApp Graph API credentials (WABA ID, Access Token) are configured.` (D07). |
| 14 | Communication / Communication Hub — Test send | BLOCKED | Shows `BLOCKED: No connector or backend queue is configured. Test dispatch unavailable.` (D09). |
| 15 | Public / Auth — Default auto-preset email | FAIL (fixed) | Removed `const [email, setEmail] = useState('admin@koshinnovations.com')`; email field clears on mount. (D17). |
| 16 | Public / Auth — Fixed OTP 123456/888888 | FAIL (under remediation) | OTP validation removed from login flow; under active remediation for backend auth or explicit block with no production bypass. (D18). |
| 17 | GST verification — Live provider key missing | BLOCKED | `GST_API_PROVIDER_KEY` absent from `.env`; provider correctly `BLOCKED`; no invented taxpayer/filing data; empty filing history stays empty. (D21). |
| 18 | Database — VERIFIED without evidence | FAIL | 12 `business_partners` rows `gst_status='VERIFIED'` without provider evidence; downgrade migration to `UNVERIFIED` needed (D19). |
| 19 | Database — Migration drift 004–009 vs 001–005 | FAIL | DB `schema_migrations` references `004_create_gst_verifications.sql`–`009_create_system_settings.sql`; repo only has `001`–`005`; reconciliation needed (D20). |
| 20 | Audit logs — Real persistence not wired | NOT TESTED | `AuditLogsView.tsx` retains hardcoded source events but does not retrieve from DB; label `NOT TESTED` until DB persistence wired (D27). |
| 21 | Dashboard / Customizer modal | NOT TESTED | No test coverage for widget drag-and-drop or saved dashboard persistence. (D25). |
| 22 | Approval Inbox | NOT TESTED | No workflow test coverage for `ApprovalInboxView`; `INITIAL_WORKFLOW_INSTANCES` not exercised. (D26). |
| 23 | Item Master / API `/api/items` | NOT TESTED | Route exists at `server/src/routes/items.ts` but not used by frontend; no route tests. |
| 24 | Security — Backend authentication | BLOCKED | No backend auth; `users` table 0 rows; all API routes effectively public; login explicitly blocked with no production bypass (under remediation). (D22). |
| 25 | Security — Org/branch scoping | FAIL (partially fixed) | Dashboard branch filter previously always `true`; fixed to use `INITIAL_BRANCHES` lookup and item `branchAvailability`. No backend org scoping enforcement. |

---

## Critical Risks (Must Resolve Before Release)

| # | Risk | Category | Current Status | Required Action |
|---|------|----------|----------------|-----------------|
| CR1 | Live GST verification | Integration | `BLOCKED` | Configure `GST_API_PROVIDER_KEY` in `.env` or formally accept `BLOCKED` with visible notice. |
| CR2 | Real authentication/authorization | Auth | `BLOCKED` | Implement real backend auth OR explicitly block login with no production bypass. |
| CR3 | Live SAP integration | Integration | `BLOCKED` | Configure SAP Service Layer connector + credentials, or permanently block with truthful UI. |
| CR4 | Database migration drift | DB | `FAIL` | Reconcile `004`–`009` vs `001`–`005`; apply downgrade migration for VERIFIED→UNVERIFIED. |
| CR5 | Business partner VERIFIED without evidence | DB | `FAIL` | Apply downgrade migration; convert `gst_status` from `VERIFIED` to `UNVERIFIED` where no provider evidence exists. |

---

## Overall Recommendation: NO-GO

**The platform should not be released to production.** Critical risks CR1–CR5 remain unresolved. The following statuses summarize the audit:

- **3 modules BLOCKED** (SAP integration, GST live verification, auth)
- **5 modules FAIL** (dashboard SAP sync, business partner VERIFIED, communication fake metrics, login auth, migration drift) — 3 of these are fixed; 2 require migration/action.
- **4 modules NOT TESTED** (customizer, approval inbox, items API, audit log persistence)
- **1 module NOT APPLICABLE** (users-roles / rule-history routes have no matching views)

**No critical workflow is genuinely verified.** Every former fabricated `PASS`/`SUCCESS`/`APPROVED FOR PRODUCTION` state has been replaced with an explicit `NOT_RUN`/`BLOCKED`/`FAIL` truthful state, but the underlying dependencies (provider key, backend auth, SAP connector, migration integrity) remain unavailable.

**Release is permissible only when:**
1. `GST_API_PROVIDER_KEY` is configured or GST live verification is formally `BLOCKED` with visible notice.
2. Real backend authentication is implemented, or login is explicitly blocked with no production bypass.
3. SAP Service Layer connector + credentials are configured, or SAP integration is permanently blocked with truthful UI.
4. Database migration drift is reconciled (004–009 vs 001–005).
5. `business_partners.gst_status` VERIFIED records without evidence are downgraded to UNVERIFIED.
6. All NOT TESTED items receive adequate verification.

Until all critical risks are resolved, the platform status remains **NO-GO**.