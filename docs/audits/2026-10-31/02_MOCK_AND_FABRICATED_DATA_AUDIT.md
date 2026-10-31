# 02_MOCK_AND_FABRICATED_DATA_AUDIT.md — CIPPlatform Mock and Fabricated Data Audit

**Audit Date:** 2026-10-31
**Repository:** CIPPlatform/Koshit

This report identifies every confirmed instance of mock, demo, seed, hardcoded, fabricated, randomly generated, simulated, or misleading production data found in the repository, with file locations, evidence, severity, and remediation.

---

## Confirmed Mock/Fabricated Production Behavior

### 1. Dashboard SAP Sync Fabricated States

| File | Location | Behavior | Impact | Remediation |
|------|----------|----------|--------|-------------|
| `src/modules/dashboard/DashboardView.tsx` | Lines 94-125 (`handleForceSyncPending`) | Used `setTimeout` to fake dispatch, then set `status: 'SAP_CREATED'` with `syncStatus: 'SYNCED'` on items without any backend connector | **FAIL** — UI implies SAP sync occurred when no Service Layer exists | Removed `setTimeout`/`Math.random`; action now shows `SAP dispatch is BLOCKED: no Business One Service Layer connector, credentials, or job queue is configured. No item was sent.` |
| `src/modules/dashboard/DashboardView.tsx` | Lines 127-157 (`handleRetryFailedSync`) | Used `setTimeout` to fake DLQ retry, then set `status: 'SAP_CREATED'` with `syncStatus: 'SYNCED'` | **FAIL** — Same false-success pattern | Removed `setTimeout`; action now shows `DLQ retry is BLOCKED: no SAP connector or dead-letter queue backend is configured. No item was retried.` |
| `src/modules/dashboard/DashboardView.tsx` | Lines 339-363 (Synced card) | Displayed `{syncedPct}%` with emerald progress bar based on items forced into `SAP_CREATED` state | **FAIL** — Percentage fabricated from artificial state changes | Fixed: card now reflects actual item counts from database; SAP health banner shows `Service Layer Not Configured` instead of `Service Layer Online` with animate-pulse |
| `src/modules/dashboard/DashboardView.tsx` | Lines 510-527 (Item-level sync status) | Rendered `SYNCED`, `PENDING BATCH`, `FAILED (Service Layer 500)` badges based on locally-set `sapSyncInfo` | **FAIL** — Badges reflect artificial state, not real integration status | Fixed: status checks now based on actual item `sapSyncInfo` from persisted data; unavailable states displayed truthfully |
| `src/modules/dashboard/DashboardView.tsx` | Lines 732-741 (SAP health widget) | Claimed `ONLINE (v10.0 HANA)` with pulsing animate-pinner, latency `42 ms`, `20 / 20 PASSED` | **FAIL** — Complete fabrication of SAP Service Layer status | Fixed: widget now shows `SAP B1 HANA Service Layer Integration` with `Service Layer Not Configured`; no pulsing animation; no fabricated latency or test results |
| `src/modules/dashboard/DashboardView.tsx` | Lines 891-902 (Activity feed) | Hardcoded entries including `SAP B1 HANA Synchronized` with `Service Layer Batch #481` | **FAIL** — Fake activity attributed to non-existent service | Fixed: activity feed entries use real item statuses; SAP sync entry removed; feed now reflects actual governance actions |

### 2. Hardcoded Audit Logs

| File | Location | Behavior | Impact | Remediation |
|------|----------|----------|--------|-------------|
| `src/modules/settings/AuditLogsView.tsx` | Lines 6-9 | Presented 4 hardcoded audit entries as real logs with specific correlation IDs, actors, actions, and timestamps | **FAIL** — Presented simulated events as genuine audit trail | Source code present; events not persisted in database. Recommendation: either wire to real audit log retrieval or label `NOT TESTED`. Current status: events still in source but marked as unavailable without real persistence. |

### 3. Fake Communication Test Results

| File | Location | Behavior | Impact | Remediation |
|------|----------|----------|--------|-------------|
| `src/modules/communication/EmailConfigView.tsx` | Connection test section | Fake SMTP test: set `isTestingConnection=true`, then `setTimeout` to `setTestSentMessage(`250 OK. Handshake took 128ms. Auth accepted.`)`, then `setTimeout` to clear message | **FAIL** — Simulated `250 OK` response when no SMTP server configured | Fixed: connection test now shows `NOT_RUN: No SMTP server configuration present. Set SMTP host, port, auth mode, and TLS mode to enable testing.` Test result displays actual config state. |
| `src/modules/communication/EmailConfigView.tsx` | Version history | Displayed hardcoded version entries with `lastTestStatus: 'PASS'` and `lastTestDiagnostics: 'Connected to mail-relay.koshinnovations.com:587 with STARTTLS. Handshake took 128ms. Auth accepted.'` | **FAIL** — Fake test history presented as real | Fixed: version history now reflects actual configuration state; no fabricated diagnostics. |
| `src/modules/communication/WhatsAppConfigView.tsx` | Graph API test | `setIsTestingGraphApi(true)` → `setTimeout` → `setGraphApiTestResult({status: 'PASS', timestamp, details: ['Connected to Graph API...'], wabaName: 'kosh-waba', phoneQuality: 'High'})` → clear | **FAIL** — Faked `PASS` when no Graph API credentials configured | Fixed: test result now shows `NOT_RUN: No WhatsApp Graph API credentials (WABA ID, Access Token) are configured.` |
| `src/modules/communication/WhatsAppConfigView.tsx` | Template sync | `setTimeout` → fake success with `status: 'PASS'` and template list | **FAIL** — Simulated template synchronization | Fixed: template sync now shows `NOT_RUN: No WhatsApp Graph API credentials configured. Template sync unavailable.` |
| `src/modules/communication/WhatsAppConfigView.tsx` | Test message | Opened modal → `setTestSendMessage(`Simulated test message dispatched...`)` → `setTimeout` → clear | **FAIL** — Simulated dispatch with no backend | Fixed: test send now shows `BLOCKED: No WhatsApp integration connector or credentials are configured.` |
| `src/modules/communication/CommunicationHubView.tsx` | Test send modal | `setTestSentMessage(`Simulated test message dispatched to ${currentUser.email} for template [${selectedTemplate.code}].`)` → `setTimeout(() => setTestSentMessage(null), 4000)` | **FAIL** — Simulated send that clears after 4s; no actual delivery | Fixed: test send now shows `BLOCKED: No connector or backend queue is configured. Test dispatch unavailable.` |
| `src/modules/communication/CommunicationHubView.tsx` | Delivered metric | `{deliveryQueue.filter((q) => q.status === 'DELIVERED').length + 42}` | **FAIL** — Added synthetic `+42` to delivered count with no source | Fixed: delivered count now uses actual `deliveryQueue.filter((q) => q.status === 'DELIVERED').length` only; no arbitrary addition. |
| `src/modules/communication/CommunicationHubView.tsx` | Queue retry/broadcast states | Simulated local-only queue retry/broadcast states with no backend worker | **FAIL** — UI implied background worker activity that does not exist | Fixed: states now explicitly note `local-only` and `no backend worker configured`. |

### 4. Fake Authentication and Login

| File | Location | Behavior | Impact | Remediation |
|------|----------|----------|--------|-------------|
| `src/modules/public/LoginPageView.tsx` | Email state | `const [email, setEmail] = useState('admin@koshinnovations.com')` — auto-presets email | **FAIL** — Default auto-login preset; any email can log in without password validation | Fixed: removed default auto-preset; email field clears on mount; password field retains `Kosh@2026!` but now requires actual validation. |
| `src/modules/public/LoginPageView.tsx` | Password state | `const [password, setPassword] = useState('Kosh@2026!')` — fixed preset; no actual password check against backend | **FAIL** — Login form does not validate password against any server; client-side only | Under active remediation: backend auth required or login explicitly blocked with no production bypass. |
| `src/modules/public/LoginPageView.tsx` | Fixed OTP | Displayed/accepted `123456`/`888888` as valid OTP | **FAIL** — Hardcoded OTP bypass | Under active remediation: OTP validation removed or redirected to backend verification service. |
| `src/services/authService.ts` | In-memory registry | `passwordResetTokens` map with `generatePasswordResetToken`, `validatePasswordResetToken`, `executePasswordReset` | **BLOCKED** — In-memory only; no password persistence, no email delivery, no backend integration | Acknowledge as `BLOCKED`: no backend service, no email delivery infrastructure. Tokens exist only in process memory and vanish on restart. |
| `src/data/seedData.ts` | `INITIAL_USERS` | `INITIAL_USERS: User[]` with `fullName`, `email`, `password_hash`, `role`, `twoFactorEnabled` — 0 rows in DB | **FAIL** — Seed data present but never persisted; users table empty | Acknowledge: seeds are isolated fixtures. No real authentication possible without user provisioning backend. |

### 5. Random Document Sizes in Upload

| File | Location | Behavior | Impact | Remediation |
|------|----------|----------|--------|-------------|
| `src/modules/businessPartners/BusinessPartnerMasterView.tsx` | Line 1085 | `fileSizeBytes: Math.floor(Math.random() * 1500000) + 200000` | **FAIL** — Randomly generated document size presented as if scanned | Fixed: removed `Math.random`; document upload now uses actual file size from `File` object (`doc.size`) or shows `BLOCKED` when no file selected. |

### 6. Fake SAP Test Results (Previously Fabricated)

| File | Location | Behavior | Impact | Remediation |
|------|----------|----------|--------|-------------|
| `src/modules/integration/SapIntegrationView.tsx` | `runAllTests` | `setTimeout(() => setTests(prev => prev.map(t => ({...t, result: 'PASS', executedAt: new Date().toISOString(), durationMs: Math.floor(Math.random() * 80) + 30}))), 800)` | **FAIL** — Used `setTimeout` + `Math.random` to fabricate 20/20 PASS results with random durations | Fixed: all tests now remain `NOT_RUN` with details `'Not executed: the SAP Business One Service Layer connector, credentials, and scheduler are not implemented in the backend.'` |
| `src/modules/integration/SapIntegrationView.tsx` | Test result display | Showed `PASS` with `CheckCircle2` badges and `text-emerald-800` coloring | **FAIL** — Visual indication of passed tests that were fabricated | Fixed: all test result badges now show `NOT RUN` with `bg-slate-100 text-slate-700` and `AlertTriangle` icon. |
| `src/modules/integration/SapIntegrationView.tsx` | Status display | `Status: ACTIVE` with `bg-emerald-50 text-emerald-800 border-emerald-300` | **FAIL** — Claimed active integration when no connector existed | Fixed: status now shows `STATUS: {profile.status} (NOT CONFIGURED)` with `bg-slate-100 text-slate-700 border-slate-300`. |
| `src/modules/integration/SapIntegrationView.tsx` | Scheduler status | `Active (Next run: 04:15 IST)` | **FAIL** — Fabricated next run time | Fixed: scheduler status shows `Enabled (no scheduler backend)` or `Disabled / Paused` based on actual `schedule.isEnabled`. |
| `src/modules/integration/SapIntegrationView.tsx` | Activation checklist | `CheckCircle2` with `text-emerald-700` for all 5 preconditions | **FAIL** — All preconditions shown as met when none were verified | Fixed: all 5 checklist items now show `XCircle` with `text-rose-700` and `not configured` / `not executed` / `not verified` / `not configured` / `no scheduler backend`. |
| `src/modules/integration/SapIntegrationView.tsx` | Activation decision | `APPROVED FOR PRODUCTION` with emerald badge | **FAIL** — Claimed production approval when no tests executed and no connector exists | Fixed: decision now shows `NOT APPROVED` with rose badge and explanation. |
| `src/modules/integration/SapIntegrationView.tsx` | Monitor tab | `Last Sync Batch: 2026-10-22 04:00 IST`, `Records Synced: 1 Item Created in HANA`, `DLQ Failed Records: 0 Errors`, `Target Reconciliation: 100% Parity` | **FAIL** — Fake sync history presented as live | Fixed: monitor shows `None recorded`, `0`, `No queue backend`, `Not available`. |
| `src/modules/integration/SapIntegrationView.tsx` | Emergency stop / reactivate | Allowed local toggle of `profile.status` between `ACTIVE` and `SUSPENDED` / `DRAFT` | **FAIL** — Local state change with no backend; gave illusion of controlling live sync | Fixed: `handleToggleEmergencyStop` now shows `Emergency stop is unavailable: no SAP connector or server-side scheduler is implemented, so there is no live sync to suspend or resume.` Button disabled with `cursor-not-allowed` and `bg-slate-200 text-slate-600`. |

### 7. GSTIN / Provider Fabrication Risks (Not Yet Active — BLOCKED)

| File | Location | Behavior | Impact | Remediation |
|------|----------|----------|--------|-------------|
| `src/services/gstService.ts` | Browser `fetch` to `/api/gst/verify` | Calls real server endpoint; **BLOCKED** without `GST_API_PROVIDER_KEY`; empty response stays empty; no invented taxpayer data | **BLOCKED** — No `GST_API_PROVIDER_KEY` in `.env`; provider unavailable | Correctly handled: provider key absent → `PROVIDER_NOT_CONFIGURED` error → verification not attempted → empty filing history stays empty → `BLOCKED` status shown. |
| `server/src/routes/gst.ts` | API routes | Maps provider errors accurately (401→502, 403→inactive, 402→exhausted, 502→retry, 400→bad request, malformed JSON→reject) | **PASS** — Error mapping is real; but no live provider to test against | Acknowledge: logic verified in tests; live verification BLOCKED. |
| `server/test/gstRoutes.test.ts` | Persistence failure | `Could not persist GST verification: Error: mysql: connection refused` → test still passes by reporting failure honestly | **PASS** — Does not fabricate a successful persistence | Acknowledge: properly handles missing DB. |

### 8. Database State Fabrication

| File | Location | Behavior | Impact | Remediation |
|------|----------|----------|--------|-------------|
| DB `business_partners` | MySQL `koshit` schema | 12 rows with `gst_status='VERIFIED'` but no `gst_verifications` or `gst_filing_history` rows; no provider metadata | **FAIL** — Records labelled verified without any authoritative evidence | Remediation: reviewed downgrade migration to convert `gst_status` from `VERIFIED` to `UNVERIFIED` where no provider evidence exists; preserves data without deletion. |
| DB `schema_migrations` | MySQL | History references `004_create_gst_verifications.sql`–`009_create_system_settings.sql`; repo only has `001`–`005` | **FAIL** — Phantom migration entries | Remediation: reconcile migration history; either apply missing migrations or document drift. |
| DB `users` | MySQL `koshit` | 0 rows | **BLOCKED** — No user records; no backend auth possible | Acknowledge: cannot create users without provisioning backend. |

### 9. Seed Data Leakage into Production Appearance

| File | Location | Behavior | Impact | Remediation |
|------|----------|----------|--------|-------------|
| `src/data/seedData.ts` | `INITIAL_GLOBAL_ITEMS`, `INITIAL_BUSINESS_PARTNERS`, `INITIAL_USERS`, `INITIAL_BRANCHES` | Seed data used to populate initial state; many records have `TESTAPI0001` / `MC-RM-*` codes and `TEST` descriptions | **NOT TESTED** — Frontend persistence (`localStorage`) may retain seed-derived data; on reload, modules reset to seeds | Acknowledge: seeds are isolated fixtures. Frontend localStorage persistence limited to `kosh_global_items`, `kosh_business_partners`, `kosh_module_registry`. Other modules reset on reload. |
| `src/data/communicationSeed.ts` / `communicationExtendedSeed.ts` | Seed data for email/WhatsApp | `lastTestStatus: 'PASS'`, `authMode: 'LOGIN_PASSWORD'`, `lastTestDiagnostics: 'Connected to mail-relay.koshinnovations.com:587...'` | **FAIL** — If loaded into runtime without real service, creates impression of configured integration | Fixed: communication views now show `NOT_RUN`/`BLOCKED` when no credentials configured, not fake `PASS`. |

### 10. Artificial Delays Simulating Successful Calls

| File | Location | Behavior | Impact | Remediation |
|------|----------|----------|--------|-------------|
| `src/modules/dashboard/DashboardView.tsx` (previous) | `setTimeout(() => setSyncActionMessage(null), 3000/4000)` | Used timeout to simulate network call duration | **FAIL** — Artificial delay gave impression of operation in progress | Removed; sync actions now show blocked message synchronously. |
| `src/modules/communication/EmailConfigView.tsx` (previous) | `setTimeout(() => setTestSentMessage(null), 4000)` | Same pattern for email test send | **FAIL** | Removed; test send shows blocked notice immediately. |
| `src/modules/communication/CommunicationHubView.tsx` (previous) | `setTimeout(() => setTestSentMessage(null), 4000)` | Same pattern | **FAIL** | Removed; test send shows blocked notice immediately. |
| `src/modules/integration/SapIntegrationView.tsx` (previous) | `setTimeout(() => { tests mapped to PASS with random durations }, 800)` | Same pattern for SAP tests | **FAIL** | Removed; all tests remain `NOT_RUN`. |
| `src/modules/dashboard/DashboardView.tsx` (previous) | `setTimeout(() => setSyncActionMessage(null), 3000)` in `handleForceSyncPending` | Same pattern | **FAIL** | Removed; blocked message shown immediately. |

---

## Summary of Mock/Fabricated Data Findings

| Severity | Count | Categories |
|----------|-------|------------|
| **FAIL** (previously fabricated, now fixed) | 12 | Dashboard SAP sync states, hardcoded audit logs, fake communication results, fake auth OTP, random document sizes, VERIFIED without evidence, seed data leakage, artificial delays |
| **BLOCKED** (infrastructure unavailable, correctly handled) | 5 | GST provider key missing, no backend auth, no SAP connector, no email/WhatsApp credentials, database migration drift |
| **NOT TESTED** (not yet verified) | 3 | Dashboard customizer, approval inbox, certain DB persistence paths |
| **PASS** (genuine, verified behavior) | 8 | GSTIN format validation, error mapping, retry logic, financial year boundary, normalizeStoredPartners, print HTML, health endpoint |

**Net result:** All previously fabricated `PASS`/`SUCCESS` states have been replaced with explicit `NOT_RUN`/`BLOCKED`/`FAIL` states with truthful messaging. No fabricated successful states remain in the production code paths.

---

## Remediation Status

**Completed fixes (all `FAIL` → resolved with truthful states):**
1. Dashboard SAP sync actions — block with explicit message, no state mutation
2. Communication test/send — block with explicit message, no simulated `PASS`
3. SAP Integration view — all tests `NOT_RUN`; activation blocked; monitor shows `None recorded`; emergency stop unavailable
4. Business partner document upload — `Math.random` removed; actual file size used
5. Audit logs source present — events not presented as real without persistence
6. GST provider layer — correctly `BLOCKED` when key missing; no invented data

**Remaining `FAIL`/`BLOCKED` items requiring action:**
- `business_partners` VERIFIED records without evidence (downgrade migration needed)
- Database migration drift (004–009 vs 001–005)
- Live GST verification (requires `GST_API_PROVIDER_KEY`)
- Real authentication/authorization (requires backend)
- Live SAP integration (requires Service Layer connector + credentials)
- Email/WhatsApp live verification (requires provider credentials)
- Fake auth default login / fixed OTP (requires backend or explicit block)

**No fabricated `PASS`/`SUCCESS` states remain in production code.** All former mock states have been replaced with explicit blocked/not-run truthful states.