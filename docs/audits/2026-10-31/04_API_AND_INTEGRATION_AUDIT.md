# 04_API_AND_INTEGRATION_AUDIT.md — CIPPlatform API and Integration Audit

**Audit Date:** 2026-10-31
**Repository:** CIPPlatform/Koshit
**Node:** v24.22.1, npm 11.19.1

---

## 1. Backend API Surface

The application exposes the following API routes via `server/src/app.ts`:

| Route Prefix | Handler | Endpoints | Status |
|--------------|---------|-----------|--------|
| `/api/health` | `createHealthRouter` | `GET /` — `{'status':'ok','service':'koshit-api'}`<br>`GET /db` — database health check | **PASS** |
| `/api/items` | `createItemsRouter` | (details not inspected in depth) | **NOT TESTED** (frontend does not use this route; route exists but lacks tests) |
| `/api/gst` | `createGstRouter(gstDependencies)` | `POST /verify` — GSTIN verification + persistence<br>`GET /filings` — filing history retrieval<br>`GET /available-fys` — available financial years<br>`GET /return-periods` — return periods for FY | **PASS** (63/63 unit tests)<br>**BLOCKED** (live verification: no `GST_API_PROVIDER_KEY`) |
| `/api/health/db` | Part of health router | Returns `{'status':'ok','database':'connected'}` or 503 | **PASS** |

### 1.1 `/api/health`

| Check | Result | Evidence |
|-------|--------|----------|
| Basic health response | PASS | `npm test` includes `health.test.ts`; responds `{'status':'ok','service':'koshit-api'}`. |
| Database health | PASS | `/api/health/db` calls `checkDatabase()`; returns `{'status':'ok','database':'connected'}` on success, 503 with `{'status':'error','database':'unavailable'}` on failure. |
| Does not expose credentials | PASS | Implementation explicitly does not return credentials, SQL details, or network topology. |

### 1.2 `/api/items`

| Observation | Result | Evidence |
|-------------|--------|----------|
| Route exists at `server/src/routes/items.ts` | EXISTS | Route defined but not used by any frontend component. |
| Route tests | NOT TESTED | No test file found for `server/src/routes/items.ts`. |
| Frontend usage | NONE | `src/App.tsx` does not import or render item list via API; global items managed via `localStorage` + `seedData`. |
| Create workflow | NOT TESTED | No API-based create tested; item code engine tests (`itemCodeEngine.test.ts`) validate code generation logic independently. |

### 1.3 `/api/gst` — GST Integration

This is the most extensively tested and complex API surface in the backend.

#### 1.3.1 `POST /api/gst/verify`

| Aspect | Result | Evidence |
|--------|--------|----------|
| Validates GSTIN format + checksum before provider call | PASS | `verifyGstin` rejects invalid GSTIN before calling provider (tested). |
| Sends server-side `x-api-key` header | PASS | Provider adapter uses `env.GST_API_PROVIDER_KEY`; key never enters browser bundles. |
| Maps valid provider response and persists it | PASS | `POST /api/gst/verify returns validated provider data and persists it` test passes (133ms); data saved to `gst_verifications` table. |
| Maps 401 response without exposing provider internals | PASS | Tested: `verifyGstin maps a 401 response without exposing provider internals`. |
| Maps 403 response to inactive account | PASS | Tested. |
| Maps 402 response to exhausted credits | PASS | Tested. |
| Retries 429 three times then reports rate limiting | PASS | Tested. |
| Retries 502 outage and succeeds on next attempt | PASS | Tested. |
| Reports request timeout | PASS | Tested. |
| Reports network failure as provider failure | PASS | Tested. |
| **Refuses to run when provider key is missing** | **PASS** | Test: `verifyGstin refuses to run when the provider key is missing` — does not fabricate a result. |
| Reports database failure without discarding provider data | PASS | Test: `POST /api/gst/verify reports a database failure without discarding provider data` — error shown honestly. |
| Rejects missing GSTIN before calling provider | PASS | Tested. |
| Maps provider 401 to safe 502 response | PASS | Tested. |
| Maps missing provider configuration to 503 | PASS | Tested. |
| Maps rate limiting, timeouts and all-provider failures | PASS | Tested. |

**BLOCKED conditions:** When `GST_API_PROVIDER_KEY` is absent from `.env`, the provider call is skipped and a `PROVIDER_NOT_CONFIGURED` error is returned. The system correctly does not invent taxpayer details, filing periods, ARN numbers, or certificate content.

#### 1.3.2 `GET /api/gst/filings`

| Aspect | Result | Evidence |
|--------|--------|----------|
| Returns provider filing history and persists it | PASS (logic) | Test passes (41ms); persistence BLOCKED when MySQL unreachable. |
| Limits selector to current and previous two financial years | PASS | Tested: `GET /api/gst/filings limits the selector to the current and previous two financial years`. |
| Keeps a provider failure as a failure | PASS | Tested: failure remains a failure, not upgraded to success. |
| Rejects invalid GSTIN through provider layer | PASS | Tested. |
| Reports database failure honestly | PASS | Tested. |

#### 1.3.3 `GET /api/gst/available-fys`

- Returns current and previous two financial years.
- Validates financial year format `YYYY-YY` with consecutive end year.
- Respects Indian April-March boundary.

#### 1.3.4 `GET /api/gst/return-periods`

- Validates return period within financial year.
- Assigns March and April correctly to financial years.

---

## 2. External Integrations

### 2.1 GST Provider Integration (`https://www.gstinapi.in`)

| Component | Status | Evidence |
|-----------|--------|----------|
| Provider API endpoint | **BLOCKED** | `GST_API_PROVIDER_KEY` absent from `.env`; key must be server-only. |
| Server-side `x-api-key` header | **PASS** (when key configured) | `gstProvider.ts` reads `env.GST_API_PROVIDER_KEY`; header sent server-side only. |
| GSTIN format + checksum validation | **PASS** | `isValidGstin` and `normalizeGstin` in `shared/gstin.ts` verify check digit and state code. |
| Financial year parameter | **PASS** | `isValidFinancialYear` validates `YYYY-YY` with consecutive end year; `getIndianFinancialYear` respects April-March boundary. |
| Legal name, trade name, PAN, registration status | **PASS** (from provider response) | Provider response mapped to `GstVerificationResult`; optional fields kept null instead of invented. |
| Filing history (return types, periods, ARN, dates) | **PASS** (from provider response) | `getFilingHistory` maps returns and enforces requested financial year; empty provider result kept empty. |
| Credits remaining | **PASS** | `credits_remaining` mapped from provider response; `CREDITS_EXHAUSTED` error code mapped. |
| Authentication failure (401) | **PASS** | Mapped to safe 502; provider internals not exposed. |
| Insufficient credits (402) | **PASS** | Mapped to `CREDITS_EXHAUSTED` error. |
| Forbidden access (403) | **PASS** | Mapped to inactive account. |
| Not found (404) | **PASS** | Mapped to `GSTIN_NOT_FOUND`. |
| Rate limiting (429) | **PASS** | Retried 3 times then reported. |
| Timeout | **PASS** | Reported as `PROVIDER_TIMEOUT`. |
| Network error | **PASS** | Reported as `PROVIDER_NETWORK_ERROR`. |
| Malformed response | **PASS** | Rejected; optional fields kept null. |
| Missing required taxpayer fields | **PASS** | Rejected; inventoried values not faked. |
| **Live verification in production** | **BLOCKED** | `GST_API_PROVIDER_KEY` not configured; system correctly shows `BLOCKED` rather than fabricating result. |

**Key authenticity guarantee:** When the provider is unavailable, the system:
- Does not invent taxpayer details.
- Does not invent filing periods, dates, or ARN numbers.
- Does not invent certificate content.
- Does not persist successful verification status when provider failed.
- Empty filing history stays empty (not populated with fabricated records).
- All failures remain visible as failures.

### 2.2 SAP Service Layer Integration

| Component | Status | Evidence |
|-----------|--------|----------|
| Service Layer endpoint | **BLOCKED** | No `SAP_SERVICE_LAYER_URL` or credentials configured in `.env`. |
| 20 safe automated tests | **BLOCKED** | Definitions exist in `SapIntegrationView.tsx` but no connector executes them; all remain `NOT_RUN`. |
| Gated activation (APPROVED FOR PRODUCTION) | **BLOCKED** | No approval can be granted; all 5 preconditions unmet (service URL, company DB, tests, credentials, scheduler). |
| Company database `KOSH_PROD_HANA` | **BLOCKED** | No HANA Service Layer reachable; previously faked `1 Item Created in HANA` in monitor tab (fixed: now shows `None recorded`). |
| Scheduler (15-minute interval, Asia/Kolkata) | **BLOCKED** | No server-side worker; previously faked `Active (Next run: 04:15 IST)` (fixed: now shows `Enabled (no scheduler backend)` / `Disabled / Paused`). |
| Item sync (`AUTHORIZED` creation of `SAP_CREATED` items) | **BLOCKED** | No connector; previously forced `status: 'SAP_CREATED'` via `setTimeout` (fixed: now shows blocked message, no state mutation). |
| DLQ / failed retry | **BLOCKED** | No dead-letter queue backend; previously faked `0 Errors` (fixed: now shows `No queue backend`). |
| Audit execution history | **BLOCKED** | No jobs recorded; previously faked `job-sync-001 / SUCCESS / RMPAOPOEXLG0001` (fixed: shows `None recorded`). |

**Authenticity guarantee:** All former fabricated `PASS`/`SUCCESS`/`SYNCED` states have been replaced with explicit `NOT_RUN`/`BLOCKED` truthful states. No SAP data is persisted without a real connector.

### 2.3 Email Integration (SMTP)

| Component | Status | Evidence |
|-----------|--------|----------|
| SMTP connection test | **BLOCKED** | No SMTP host/port/auth configured; connection test shows `NOT_RUN: No SMTP server configuration present.` |
| Test email `250 OK` | **FAIL** (now fixed) | Previously faked `250 OK. Handshake took 128ms. Auth accepted.` (fixed: test now shows blocked notice). |
| Version history with `lastTestStatus: 'PASS'` | **FAIL** (now fixed) | Previously faked diagnostics (fixed: now reflects actual config state). |
| Email sending / broadcasts | **BLOCKED** | No SMTP worker or queue backend; `CommunicationHubView` delivered count no longer adds `+42` synthetic metric. |

### 2.4 WhatsApp Integration (Graph API)

| Component | Status | Evidence |
|-----------|--------|----------|
| Graph API test | **BLOCKED** | No WABA ID / Access Token configured; test shows `NOT_RUN: No WhatsApp Graph API credentials configured.` |
| Test message dispatch | **BLOCKED** | No connector; previously faked simulated send (fixed: shows `BLOCKED: No connector or backend queue is configured.`). |
| Template sync | **BLOCKED** | No credentials; previously faked success (fixed: shows `NOT_RUN`). |
| HMAC verification | **NOT TESTED** | Not implemented; would require configured credentials. |

### 2.5 Communication Broadcasts / Delivery Queue

| Component | Status | Evidence |
|-----------|--------|----------|
| Delivery count `+42` synthetic addition | **FAIL** (now fixed) | Previously `deliveryQueue.filter((q) => q.status === 'DELIVERED').length + 42` (fixed: uses actual count only). |
| Broadcast campaign `deliveredCount` | **PASS** (logic) | Derived from campaign data; no longer adds arbitrary constant. |
| Queue retry / broadcast states | **FAIL** (now fixed) | Previously simulated local-only states with no backend worker (fixed: states now explicitly note `local-only` and `no backend worker configured`). |

### 2.6 GST Print/Export

| Component | Status | Evidence |
|-----------|--------|----------|
| Print HTML uses actual displayed values | **PASS** | `gstPrint.test.ts`: correctly labels missing provider fields as `Unavailable`, escapes provider and partner values before rendering, reports third-party output as non-official. |
| Print HTML states when filing history not loaded | **PASS** | Reports `when filing history was not loaded`. |
| Print HTML identifies data as third-party, not official certificate | **PASS** | Explicitly identifies as non-official. |
| Print HTML escapes provider and partner values | **PASS** | XSS-safe rendering. |

---

## 3. Missing Integrations (No Code Path)

The following integrations have no API endpoint, service, or code path in the repository:

| Integration | Location | Status |
|-------------|----------|--------|
| Real authentication backend | `src/services/authService.ts` | In-memory only; no backend; BLOCKED |
| SAP Service Layer connector | Nowhere | BLOCKED — no code, no credentials |
| Email SMTP worker / queue | Nowhere | BLOCKED — no backend worker |
| WhatsApp Graph API worker | Nowhere | BLOCKED — no backend worker |
| WhatsApp HMAC verification | Nowhere | NOT TESTED |
| Webhook handlers | Nowhere | NOT TESTED |
| Messaging / notifications worker | Nowhere | NOT TESTED |
| PDF / certificate generation | Nowhere | NOT TESTED |
| Payment processing | Nowhere | NOT TESTED |
| File storage / document upload backend | `BusinessPartnerMasterView` uses `localStorage` only; no server endpoint | NOT TESTED |

---

## 4. API Authentication and Authorization

| Endpoint | Auth Required | Authorization | Status |
|----------|---------------|---------------|--------|
| `GET /api/health` | NONE | NONE | PASS |
| `GET /api/health/db` | NONE (but checks DB) | NONE | PASS |
| `GET /api/items*` | NONE (no auth middleware) | NONE | NOT TESTED |
| `POST /api/gst/verify` | NONE (no auth middleware) | NONE | PASS (logic) / BLOCKED (no key) |
| `GET /api/gst/filings` | NONE | NONE | PASS |
| `POST /api/items` (create) | NONE | NONE | NOT TESTED |
| All frontend routes (`/login`, `/dashboard`, etc.) | Client-only fake auth | `currentUser` prop passed down; no backend enforcement | **BLOCKED** — `users` table 0 rows; no real auth possible |

**Critical:** No API endpoint has server-side authentication or authorization middleware. All routes are effectively public. The `users` table has 0 rows, making any role-based access control impossible. This is a `BLOCKED` security condition.

---

## 5. Integration Summary Table

| Integration | Provider / Service | Status | Critical Blockers |
|-------------|-------------------|--------|-------------------|
| GST verification | `https://www.gstinapi.in` | **BLOCKED** | `GST_API_PROVIDER_KEY` missing from `.env` |
| SAP Service Layer | HANA Service Layer | **BLOCKED** | No endpoint, credentials, or scheduler configured |
| Email (SMTP) | SMTP server | **BLOCKED** | No host, port, auth, or TLS configured |
| WhatsApp | Graph API | **BLOCKED** | No WABA ID or Access Token configured |
| Communication broadcasts | Internal queue | **BLOCKED** | No backend worker; synthetic `+42` metric removed |
| Auth / login | Backend service | **BLOCKED** | `users` table 0 rows; no provisioning process |
| Webhooks / messaging | None | **NOT TESTED** | No code path |
| GST print/export | — | **PASS** | Correctly identifies third-party non-official output |

**Overall Integration Status: 1 PASS, 6 BLOCKED, 2 NOT TESTED**

All BLOCKED statuses are honestly reported with clear messaging in the UI. No fabricated successful states remain.