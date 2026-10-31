# 01_MODULE_INVENTORY.md — CIPPlatform Module and Feature Inventory

**Audit Date:** 2026-10-31
**Repository:** CIPPlatform/Koshit

This inventory catalogs every discovered module, route, component, API, integration, and workflow in the CIPPlatform repository, with current verification status and identified defects.

---

## 1. Application Shell and Navigation

| Module | Location | Routes | UI Components | Status |
|--------|----------|--------|---------------|--------|
| App shell | `src/App.tsx` | `/`, `/dashboard`, `/items`, `/business-partners`, `/integration`, `/communication`, `/approvals`, `/settings` | `AppHeader`, `NavigationSidebar`, `PageAcceptanceBar`, modals | PASS (route shell intact) |
| Navigation sidebar | `src/components/NavigationSidebar.tsx` | N/A | Sidebar with all module nav items | PASS |
| App header | `src/components/AppHeader.tsx` | N/A | User branch/org selection, notification count | FAIL (notificationCount hardcoded to 3; no real user data) |

---

## 2. Dashboard Module

| Module | Location | Routes | UI Components | Status |
|--------|----------|--------|---------------|--------|
| Dashboard view | `src/modules/dashboard/DashboardView.tsx` | `/dashboard` | Customizer modal, KPI cards, category donut, branch bar, SAP sync table, activity feed, quick actions | FAIL (previously hardcoded SAP sync states; fixed in this audit) |
| Dashboard customizer | `src/modules/dashboard/DashboardCustomizerModal.tsx` | N/A | Widget drag-and-drop, reset defaults | NOT TESTED |
| Dashboard catalogue | `src/data/dashboardCatalogue.ts` | N/a | Default widget definitions | PASS |

**Defects:**
- SAP sync cards previously used `setTimeout`/`Math.random` to fabricate `SYNCED`/`PASS` states (fixed: sync actions now show `BLOCKED` message)
- Branch filter previously always returned `true` regardless of selection (fixed: now uses `INITIAL_BRANCHES` lookup)
- SAP health banner claimed `Service Layer Online` with pulsing animate-pulse (fixed: shows `Service Layer Not Configured`)

---

## 3. Business Partner Master

| Module | Location | Routes | UI Components | Status |
|--------|----------|--------|---------------|--------|
| Business Partner Master | `src/modules/businessPartners/BusinessPartnerMasterView.tsx` | `/business-partners` | GST verify, contact/address/property tabs, document upload, partner persistence via localStorage | FAIL (gst_status='VERIFIED' labels without provider evidence; `Math.random` document sizes; localStorage persistence only) |
| GST service | `src/services/gstService.ts` | `/api/gst/verify` | Server-side `fetch` to `https://www.gstinapi.in` with AbortController timeout | PASS (logic verified; BLOCKED without provider key) |
| GST routes | `server/src/routes/gst.ts` | `/api/gst/verify`, `/api/gst/filings` | Provider adapter, validation, persistence, error mapping | PASS (63/63 tests pass; persistence BLOCKED when MySQL unavailable) |
| GST provider | `server/src/services/gstProvider.ts` | N/A | Provider API client, checksum validation, error codes, retry logic | PASS |
| GST shared schemas | `shared/gst.ts`, `shared/gstin.ts`, `shared/financialYear.ts` | N/A | GSTIN format, checksum, financial year boundary | PASS |
| Seed data | `src/data/seedData.ts` | N/a | `INITIAL_BUSINESS_PARTNERS`, `INITIAL_USERS`, branches, global items | PASS (source of truth for seeds) |

**Defects:**
- 12 `business_partners` rows in DB labelled `gst_status='VERIFIED'` but no GST verification tables/provider metadata (FAIL — requires downgrade migration)
- `localStorage` persistence limited to `kosh_business_partners`; other modules reset on reload
- Document upload uses `Math.random` for file size (fixed: removed in this audit)
- GSTIN verified only server-side; browser code does not embed API key

---

## 4. Item Master

| Module | Location | Routes | UI Components | Status |
|--------|----------|--------|---------------|--------|
| Item master list | `src/modules/items/ItemMasterListView.tsx` | `/items` | Item creation, search, status badges, approval workflow | NOT TESTED |
| Item creation | `src/modules/items/ItemCreationView.tsx` | `/items/new` | Form with category, description, attributes | NOT TESTED |
| Item code engine | `src/test/itemCodeEngine.test.ts` | N/A | Code generation validation | PASS |
| Item description engine | `src/test/itemDescriptionEngine.test.ts` | N/A | Description generation validation | PASS |

**Defects:**
- `/api/items` route exists at `server/src/routes/items.ts` but is not used by frontend
- Route lacks tests; `/api/items` not used by any frontend component

---

## 5. Integration / SAP Module

| Module | Location | Routes | UI Components | Status |
|--------|----------|--------|---------------|--------|
| SAP Integration view | `src/modules/integration/SapIntegrationView.tsx` | `/integration/testing`, `/integration/activate`, `/integration/monitor` | Profile config, 20 safe tests, gated activation, monitor & DLQ | BLOCKED (no SAP connector or credentials; all tests `NOT_RUN`; emergency stop unavailable) |
| SAP test definitions | Same file | N/A | 20 test definitions (Config, Network, Security, Endpoint, Auth, Schema, Permissions, Metadata, Mapping, Validation, Rules, Idempotency, UDF, Read-Test, Simulation, Scheduler, Resilience, Audit, Security, End-to-End) | BLOCKED (no connector exists) |
| SAP profile state | Same file | N/A | `status: 'DRAFT'` (was `ACTIVE`; fixed in this audit) | BLOCKED |
| SAP schedule config | Same file | N/A | `isEnabled: false` (was `true` with `nextRunAt`; fixed in this audit) | BLOCKED |

**Defects:**
- Previously hardcoded "APPROVED FOR PRODUCTION" / all-green checklist (fixed: now shows `NOT APPROVED` with all X marks)
- Monitor tab showed fake sync history `1 Item Created in HANA` (fixed: shows `None recorded`)
- Emergency stop/reactivate allowed local status toggle with no backend (fixed: shows unavailable notice)
- Test run previously used `setTimeout` to fabricate `PASS` results with random durations (fixed: all `NOT_RUN`)

---

## 6. Communication Module

| Module | Location | Routes | UI Components | Status |
|--------|----------|--------|---------------|--------|
| Email config | `src/modules/communication/EmailConfigView.tsx` | `/communication/email` | SMTP config, connection test, template management, version history | FAIL (previously faked `250 OK` test result; fixed in this audit) |
| WhatsApp config | `src/modules/communication/WhatsAppConfigView.tsx` | `/communication/whatsapp` | Graph API test, test message, template sync, HMAC verification | FAIL (previously faked `PASS`; fixed in this audit) |
| Communication hub | `src/modules/communication/CommunicationHubView.tsx` | `/communication` | Templates, broadcasts, delivery queue, in-portal notifications | FAIL (previously `+42` delivered metric; fixed in this audit) |
| Email seed data | `src/data/communicationSeed.ts` | N/a | Initial email config, templates, queue | PASS |
| Communication extended seed | `src/data/communicationExtendedSeed.ts` | N/a | Auth mode, provider settings, last test status | PASS |

**Defects:**
- Email connection test previously faked `PASS` with `250 OK` and handshake diagnostics (fixed: shows `NOT_RUN` when no SMTP configured)
- WhatsApp Graph API test previously faked `PASS` with status and WABA details (fixed: shows `NOT_RUN`)
- Template sync previously faked success (fixed: shows `NOT_RUN`)
- HMAC verification not implemented (BLOCKED)
- Communication hub delivered count added `+42` synthetic metric (fixed: uses actual queue data)
- Send test modal previously used `setTimeout` to simulate dispatch (fixed: shows `BLOCKED` notice)

---

## 7. Approvals Module

| Module | Location | Routes | UI Components | Status |
|--------|----------|--------|---------------|--------|
| Approval inbox | `src/modules/approvals/ApprovalInboxView.tsx` | `/approvals` | Workflow instances, approval/rejection actions | NOT TESTED |
| Initial workflow instances | Same file | N/a | `INITIAL_WORKFLOW_INSTANCES` from seed data | NOT TESTED |

---

## 8. Settings Module

| Module | Location | Routes | UI Components | Status |
|--------|----------|--------|---------------|--------|
| Audit logs | `src/modules/settings/AuditLogsView.tsx` | `/settings/audit-logs` | Four hardcoded audit events presented as real logs | FAIL (previously hardcoded; source present but not persisted) |
| System settings | `src/modules/settings/` | N/a | `system_settings` table has 1 row in DB | NOT TESTED |
| Users/roles | `/settings/users-roles` | N/a | No matching App route; renders empty authenticated workspace | NOT APPLICABLE |
| Rule history | `/settings/rule-history` | N/a | No matching App route; renders empty authenticated workspace | NOT APPLICABLE |

**Defects:**
- `AuditLogsView.tsx` previously presented 4 hardcoded audit entries as real logs (fixed in this audit: source still present; requires real DB persistence or `NOT TESTED`)

---

## 9. Public / Auth Module

| Module | Location | Routes | UI Components | Status |
|--------|----------|--------|---------------|--------|
| Login page | `src/modules/public/LoginPageView.tsx` | `/login` | Email input, password toggle, Google-like login, password reset, fixed OTP | FAIL (default auto-preset `admin@koshinnovations.com`/`Kosh@2026!`; fixed OTP `123456`/`888888`; no password validation) |
| Auth service | `src/services/authService.ts` | N/a | In-memory password-reset registry; no password persistence or email delivery | BLOCKED (no backend; users table 0 rows) |

**Defects:**
- Login page any email logs in without password validation (under active remediation)
- Fixed OTP `123456`/`888888` (under active remediation)
- No real authentication possible without backend user-provisioning process

---

## 10. GST Workflow (Client + Server)

| Module | Location | API Endpoint | Status |
|--------|----------|--------------|--------|
| GST service (browser) | `src/services/gstService.ts` | `POST /api/gst/verify` | PASS (logic); BLOCKED without `GST_API_PROVIDER_KEY` |
| GST routes (server) | `server/src/routes/gst.ts` | `/api/gst/verify`, `/api/gst/filings` | PASS (63/63 tests); persistence BLOCKED when MySQL unavailable |
| GST provider (server service) | `server/src/services/gstProvider.ts` | `https://www.gstinapi.in` | PASS (error mapping, retry, timeout, 401/403/402) |
| GST verification state | `src/modules/dashboard/` | N/A | Verification state persisted; empty filing history stays empty |
| GST print | `src/test/gstPrint.test.ts` | N/A | Correctly labels missing fields as `Unavailable`, reports third-party non-official |
| GST verification state test | `src/test/gstVerificationState.test.ts` | N/A | All state-transition tests pass |
| GST routes test | `server/test/gstRoutes.test.ts` | N/A | 63 tests pass; persistence failure handled honestly |

---

## 11. Database Schema Snapshot

| Table | Rows | Key Fields | Status |
|-------|------|------------|--------|
| `global_items` | 12 | `item_code`, `item_description`, `status`, `is_active`, `created_at` | PASS |
| `business_partners` | 12 | `bp_code`, `company_name`, `bp_type`, `gstin`, `gst_status`, `governance_status`, `sap_card_code`, `is_active`, `created_at` | FAIL (12 rows labelled `gst_status='VERIFIED'` without provider metadata) |
| `audit_logs` | 54 | `log_id`, `correlation_id`, `actor`, `actor_role`, `action`, `entity`, `entity_id`, `outcome`, `details`, `created_at` | PASS |
| `item_approval_history` | 22 | `history_id`, `item_code`, `action`, `actor_name`, `previous_status`, `new_status`, `created_at` | PASS |
| `users` | 0 | `username`, `email`, `role`, `is_active`, `two_factor_enabled` | BLOCKED (0 rows; no backend auth) |
| `branch_item_availability` | 0 | — | EMPTY (no data) |
| `custom_specifications` | 0 | — | EMPTY (no data) |
| `schema_migrations` | Varies | `version`, `applied_at` | DRIFT (DB references 004–009; repo has 001–005 only) |
| `system_settings` | 1 | `setting_key`, `updated_at` | PASS |

**Migration drift:** DB history references `004_create_gst_verifications.sql`–`009_create_system_settings.sql`; repository only has `001`–`005`. GST tables (`gst_verifications`, `gst_filing_history`) exist as migration scripts but are absent from `schema_migrations` history and not yet applied to live DB.

---

## 12. Summary Table

| Module | Status | Critical Defects |
|--------|--------|------------------|
| App shell | PASS | — |
| Dashboard | FAIL | Hardcoded SAP sync states, fake branch filter |
| Business Partner Master | FAIL | VERIFIED without evidence, Math.random document sizes |
| Item Master | NOT TESTED | — |
| Integration / SAP | BLOCKED | No connector/credentials, all tests NOT_RUN |
| Communication | FAIL | Fake SMTP/Graph API PASS, +42 metric |
| Approvals | NOT TESTED | — |
| Settings / Audit logs | FAIL | Hardcoded events (fixed source) |
| Public / Auth | BLOCKED | No backend auth, empty users table |
| GST workflow | PASS (logic) / BLOCKED (no key) | Provider key missing |
| Database | FAIL | Migration drift, VERIFIED without evidence |

**Overall: NO-GO** — 3 BLOCKED, 5 FAIL, 3 NOT TESTED, 1 NOT APPLICABLE. Critical workflows must be resolved before release.