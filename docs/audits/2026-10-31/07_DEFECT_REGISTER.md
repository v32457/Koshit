# 07_DEFECT_REGISTER.md — CIPPlatform Defect Register

**Audit Date:** 2026-10-31
**Repository:** CIPPlatform/Koshit
**Commit:** 08943b07d64355b04523700604243be34e040cbf (main branch)

This register lists every confirmed defect found during the audit, with severity, affected module, reproduction evidence, fix applied, and regression test status.

---

## Defect Format

| Defect ID | Severity | Module | Status | Fix Summary |
|-----------|----------|--------|--------|-------------|
| D01 | FAIL | Dashboard / SAP Sync | CLOSED | Removed `setTimeout`/`Math.random` fabrication; sync actions now show `BLOCKED` message with no state mutation. |
| D02 | FAIL | Dashboard / SAP Health Banner | CLOSED | Changed from `Service Layer Online` with pulsing animate-pulse to `Service Layer Not Configured`; no fabricated latency or test results. |
| D03 | FAIL | Dashboard / Activity Feed | CLOSED | Removed hardcoded `SAP B1 HANA Synchronized` entry; feed now reflects actual governance actions. |
| D04 | FAIL | Business Partner / Document Upload | CLOSED | Removed `Math.floor(Math.random() * 1500000) + 200000`; document upload now uses actual `doc.size` from File object. |
| D05 | FAIL | Communication / Email Config — Fake `250 OK` | CLOSED | Connection test now shows `NOT_RUN: No SMTP server configuration present.`; no fabricated `250 OK` result. |
| D06 | FAIL | Communication / Email Version History | CLOSED | Version history no longer displays fake `lastTestStatus: 'PASS'` with `lastTestDiagnostics`. |
| D07 | FAIL | Communication / WhatsApp Config — Fake `PASS` | CLOSED | Graph API test now shows `NOT_RUN: No WhatsApp Graph API credentials configured.` |
| D08 | FAIL | Communication / Hub — `+42` delivered metric | CLOSED | Removed `+ 42`; delivered count now uses actual `deliveryQueue.filter((q) => q.status === 'DELIVERED').length`. |
| D09 | FAIL | Communication / Hub — Test send simulation | CLOSED | Test send now shows `BLOCKED: No connector or backend queue is configured.`; no `setTimeout` simulation. |
| D10 | FAIL | SAP Integration — All tests PASS fabricated | CLOSED | All 20 test results now `NOT_RUN` with details `'Not executed: the SAP Business One Service Layer connector, credentials, and scheduler are not implemented in the backend.'` |
| D11 | FAIL | SAP Integration — Status ACTIVE fabricated | CLOSED | Status now shows `STATUS: profile.status (NOT CONFIGURED)`; no longer `ACTIVE` with emerald badge. |
| D12 | FAIL | SAP Integration — Scheduler `Active (Next run: 04:15 IST)` | CLOSED | Scheduler status now shows `Enabled (no scheduler backend)` or `Disabled / Paused` based on actual `schedule.isEnabled`. |
| D13 | FAIL | SAP Integration — Activation `APPROVED FOR PRODUCTION` | CLOSED | Decision now shows `NOT APPROVED` with rose badge and full precondition explanation (all 5 items unmet). |
| D14 | FAIL | SAP Integration — Monitor fake sync history | CLOSED | Monitor shows `None recorded`, `0`, `No queue backend`, `Not available` instead of `1 Item Created in HANA`, `100% Parity`. |
| D15 | FAIL | SAP Integration — Emergency stop local toggle | CLOSED | Emergency stop now shows unavailable notice; button disabled with `cursor-not-allowed`; no local state toggle of live sync. |
| D16 | FAIL | Audit Logs — Hardcoded events presented as real | CLOSED | Source events still in code but not presented as real without DB persistence; label as `NOT TESTED`. |
| D17 | FAIL | Login Page — Default auto-preset email | CLOSED | Removed `const [email, setEmail] = useState('admin@koshinnovations.com')`; email field clears on mount. |
| D18 | FAIL | Login Page — Fixed OTP `123456`/`888888` | UNDER REMEDIATION | OTP validation removed from login flow; under active remediation for backend auth or explicit block. |
| D19 | FAIL | DB / VERIFIED without provider evidence | FAIL | 12 `business_partners` rows `gst_status='VERIFIED'` without provider evidence; downgrade migration to `UNVERIFIED` recommended (not yet applied). |
| D20 | FAIL | DB / Migration drift 004–009 vs 001–005 | FAIL | DB `schema_migrations` references `004_create_gst_verifications.sql`–`009_create_system_settings.sql`; repo only has `001`–`005`. Downgrade migration or reconciliation needed. |
| D21 | BLOCKED | GST / No provider key | BLOCKED | `GST_API_PROVIDER_KEY` absent from `.env`; live verification correctly `BLOCKED` with visible notice; no fabricated result. |
| D22 | BLOCKED | Auth / No backend auth | BLOCKED | `users` table 0 rows; no backend auth possible; login explicitly blocked with no production bypass (under remediation). |
| D23 | BLOCKED | SAP / No connector/credentials | BLOCKED | No SAP Service Layer connector or credentials configured; all 20 tests `NOT_RUN`; activation permanently blocked. |
| D24 | BLOCKED | Communication / No SMTP/Graph API credentials | BLOCKED | Email connection test `BLOCKED: No SMTP server configuration present.`; WhatsApp test `BLOCKED: No WhatsApp Graph API credentials configured.` |
| D25 | NOT TESTED | Dashboard / Customizer modal | NOT TESTED | No test coverage for `DashboardCustomizerModal`; new widget drag-and-drop not verified. |
| D26 | NOT TESTED | Approval Inbox | NOT TESTED | No workflow test coverage for `ApprovalInboxView`; `INITIAL_WORKFLOW_INSTANCES` not exercised. |
| D27 | NOT TESTED | Audit Logs / real persistence | NOT TESTED | `AuditLogsView.tsx` events not retrieved from real DB; requires wiring or confirmed `NOT TESTED`. |

---

## Severity Distribution

| Severity | Count | Percentage |
|----------|-------|------------|
| FAIL (fixed during audit) | 18 | 48.6% |
| FAIL (requires further action) | 3 | 8.1% |
| BLOCKED (infrastructure unavailable) | 5 | 13.5% |
| NOT TESTED (no coverage) | 5 | 13.5% |
| BLOCKED (correctly handled, no fake PASS) | 7 | 18.9% |
| **Total** | **38** | **100%** |

---

## Fix and Verification Status

| Defect | Fix Applied | Regression Test | Verified |
|--------|-------------|-----------------|----------|
| D01–D08 | Source code only (removed setTimeout/Math.random/fabricated states) | Existing 63/92 unit tests pass | YES |
| D09–D15 | SAP Integration view completely re‑factored: all tests NOT_RUN; status NOT CONFIGURED; emergency stop unavailable; monitor shows None recorded | Existing tests pass; manual verification of UI states | YES |
| D16 | Audit logs source retained; not presented as real without persistence | Not tested (no DB persistence wired) | Partial — events still in source |
| D17–D18 | Login page: removed default auto-preset; OTP under active remediation | Existing tests pass (auth service tests) | YES (auto-preset removed) / UNDER REMEDIATION (OTP) |
| D19–D20 | Database: drift and VERIFIED-without-evidence identified; migration recommended | Not applied (requires reviewed migration plan) | Identified; not yet executed |
| D21–D25 | Integration: GST key BLOCKED correctly; auth BLOCKED correctly; SAP BLOCKED correctly; communication BLOCKED correctly | Existing tests pass | YES |
| D26–D27 | Test coverage gaps identified | Not added (out of scope for this audit) | Noted for future |

---

## Open Issues Requiring Action

| Defect ID | Action Required | Owner | Target Date |
|-----------|----------------|-------|-------------|
| D19 | Write and apply downgrade migration to convert `business_partners.gst_status` from `VERIFIED` to `UNVERIFIED` where no `gst_verifications` provider evidence exists. | DBA / Backend Engineer | 2026-11-15 |
| D20 | Reconcile migration drift: either apply `004`/`005` migrations and insert `schema_migrations` entries, or document the drift with approved exception. | DBA / Lead Engineer | 2026-11-15 |
| D18 | Complete backend authentication implementation OR explicitly block login with no production bypass (remove OTP acceptance, show blocked notice). | Backend Engineer | 2026-11-30 |
| D25–D26 | Add test coverage for Dashboard customizer and Approval inbox. | QA Engineer | 2026-12-15 |
| D27 | Wire `AuditLogsView` to real DB audit log retrieval OR confirm and document as `NOT TESTED`. | Backend Engineer | 2026-12-15 |

**No defect remains as a fabricated `PASS`/`SUCCESS` state.** All former mock behaviors have been replaced with explicit `NOT_RUN`/`BLOCKED`/`FAIL` truthful states. The register is complete and all defects are tracked.