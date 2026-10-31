# 05_SECURITY_AUDIT.md — CIPPlatform Security Audit

**Audit Date:** 2026-10-31
**Repository:** CIPPlatform/Koshit
**Node:** v24.22.1, npm 11.19.1

---

## 1. Authentication and Session Management

### 1.1 Backend Authentication

| Check | Result | Evidence |
|-------|--------|----------|
| Backend auth middleware on API routes | **FAIL** | No API route has auth middleware. All endpoints are effectively public. |
| `users` table row count | **BLOCKED** | 0 rows in MySQL `koshit` schema. |
| User provisioning process | **BLOCKED** | No backend endpoint, script, or seed process to create user records. |
| Session management | **BLOCKED** | No session cookie, no JWT, no server-side session store. |
| Password hashing | **NOT APPLICABLE** | No user records exist; no password store. |
| Password reset | **BLOCKED** | `authService.ts` has in-memory `passwordResetTokens` map that vanishes on restart; no email delivery. |

**Findings:**
- The application has **no backend authentication**. All API routes are unprotected.
- The `users` table is empty (`0 rows`), confirmed via direct DB inspection.
- Client-side `LoginPageView` allows any email to be entered; there is no password validation against a backend.
- `authService.ts` provides an in-memory password-reset registry but:
  - Tokens exist only in process memory.
  - They vanish on application restart.
  - No email delivery is implemented or configured.
  - Cannot be used for real password reset in production.

**Risk:** CRITICAL — Without backend auth, any user can access any route; no session isolation; data access not scoped by user/org.

### 1.2 Frontend Authentication

| Check | Result | Evidence |
|-------|--------|----------|
| `LoginPageView` password validation | **FAIL** | Form does not validate password against any server; client-side only. |
| Default auto-preset email | **FAIL** | Previously `const [email, setEmail] = useState('admin@koshinnovations.com')`; under active remediation: removed default auto-preset; field clears on mount. |
| Fixed OTP `123456`/`888888` | **FAIL** (under remediation) | Fixed OTP accepted as valid; under active remediation: OTP validation removed or redirected to backend. |
| `currentUser` propagation | **PASS** | `AppHeader` and other components receive `currentUser` prop; structure consistent. |
| Role-based UI branching | **NOT TESTED** | No real users; role checks always evaluate against empty/default data. |

**Findings:**
- Login page previously allowed any email to log in without password check (FAIL).
- Default preset `admin@koshinnovations.com` + `Kosh@2026!` removed during this audit; field now clears on mount.
- Fixed OTP `123456`/`888888` under active remediation; no longer hardcoded acceptance path.
- No role-based UI branching possible without real users.

---

## 2. Authorization and Data Access Control

### 2.1 Cross-User Data Access

| Check | Result | Evidence |
|-------|--------|----------|
| Backend enforces org/branch scoping | **FAIL** | No API route has org/branch scoping logic. |
| Frontend branch filter previously always returned `true` | **FAIL** (fixed) | `DashboardView.tsx` previously: `const filteredItems = itemsList.filter((item) => { if (selectedBranchFilter === 'ALL') return true; return true; })` — always true. Fixed: now uses `INITIAL_BRANCHES` lookup and item `branchAvailability` scoping. |
| `global_items` org scoping | **NOT TESTED** | No org-level API or frontend logic. |
| `business_partners` org scoping | **NOT TESTED** | No org-level API or frontend logic; all 12 partners share same `orgId: 'org-kosh-01'` in seed data. |

**Findings:**
- Dashboard branch filter was hardcoded to always return true (FAIL); fixed during this audit to use actual branch availability from `INITIAL_BRANCHES` and item-level `branchAvailability` data.
- No backend enforcement of organization or branch scoping. The frontend must not rely on server-side authorization.

### 2.2 Role-Based UI Access

| Role | Accessible Routes | Evidence |
|------|-------------------|----------|
| (no real users) | All routes render but with empty data | `users` table 0 rows; no role enforcement. |
| Platform admin (theoretical) | Would have access to `/settings/*` | No backend; `/settings/users-roles` and `/settings/rule-history` have no matching App routes — render empty authenticated workspace. |
| Item maker/checker | Would see approval workflow | Not testable without real users/roles. |

---

## 3. Input Validation and Injection Prevention

### 3.1 Server-Side Input Validation

| Check | Result | Evidence |
|-------|--------|----------|
| GSTIN validation before provider call | **PASS** | `verifyGstin` in `gstProvider.ts` calls `isValidGstin` / `normalizeGstin` from `shared/gstin.ts` before making any external request. |
| Financial year validation | **PASS** | `isValidFinancialYear` and `getIndianFinancialYear` in `shared/financialYear.ts` validate format `YYYY-YY` with consecutive end year and April-March boundary. |
| Return period validation | **PASS** | `isReturnPeriodInFinancialYear` assigns March and April correctly. |
| API body validation (express `strict: true`) | **PASS** | `app.use(express.json({ limit: '1mb', strict: true }))` — strict JSON parsing enabled; malformed JSON rejected. |
| GST route malformed JSON handling | **PASS** | Test: `verifyGstin rejects malformed JSON` — does not fabricate a result. |

**Findings:**
- Server-side GSTIN format and checksum validation works correctly before any provider API call.
- Financial year and return period validation respects Indian fiscal boundary.
- Express `strict: true` prevents some malformed payloads, but not all (e.g., valid JSON with unexpected fields may still be accepted).

### 3.2 XSS and unsafe HTML rendering

| Check | Result | Evidence |
|-------|--------|----------|
| Provider values escaped before rendering | **PASS** | `gstPrint.test.ts`: `print HTML escapes provider and partner values before rendering`. |
| Audit log actor names rendered without sanitization | **NOT TESTED** | `AuditLogsView.tsx` presents hardcoded actor strings; not a dynamic render risk but not verified. |
| User-supplied description in items rendered | **NOT TESTED** | Item descriptions from DB rendered in `ItemMasterListView`; not inspected for XSS escaping. |
| Email/WhatsApp template HTML | **NOT TESTED** | No dynamic user-supplied HTML in current observed flows. |

**Findings:**
- GST print HTML correctly escapes values — confirmed pass.
- Other rendering paths not inspected for XSS. Recommend adding `DOMPurify` or equivalent for any user-supplied content rendered as HTML.

### 3.3 SQL Injection and Unsafe Queries

| Check | Result | Evidence |
|-------|--------|----------|
| MySQL queries use parameterized statements | **PASS** (observed) | `pool.ts` uses `mysql2/promise` connection pool; GST repository `saveGstVerification` uses `?` placeholders with `ON DUPLICATE KEY UPDATE`. |
| Migration SQL uses `IF NOT EXISTS` | **PASS** | `001_create_schema_migration.sql` and others use `CREATE TABLE IF NOT EXISTS`. |
| Repository-level parameterization | **PASS** | `saveGstVerification` and `saveFilingHistory` use `[]` params array with `execute()`. |
| No raw SQL string interpolation in routes | **PASS** | Inspected `server/src/routes/gst.ts`; all queries use `pool().execute('SQL', params)`. |

**Findings:** No SQL injection vectors observed; MySQL queries use parameterized statements via `mysql2/promise`.

---

## 4. Secret Handling and Exposure

### 4.1 API Key Exposure

| Check | Result | Evidence |
|-------|--------|----------|
| `GST_API_PROVIDER_KEY` in browser bundles | **BLOCKED** | Never entered client code; server-only via `env` in `server/src/config/env.ts`. |
| Vite `__dirname` alias `@` pointing to source | **PARTIAL** | `vite.config.ts` uses `path.resolve(__dirname, '.')` as alias; warning: `__dirname` unsupported by `configLoader: 'native'`; suppressed by `VITE_CONFIG_NATIVE_IGNORE_WARNING` if needed. |
| API key in URLs, logs, error responses | **BLOCKED** | GST routes test reports `PROVIDER_NOT_CONFIGURED` without exposing key; error mapping never emits the key value. |

**Findings:**
- `GST_API_PROVIDER_KEY` is read from `.env` in `server/src/config/env.ts` using `requiredInProduction`; it is **not** passed to the frontend.
- The Vite config `__dirname` warning is a build notice, not a security exposure; the alias `@` resolves to source path for imports only.
- No other provider API keys or secrets discovered in source code.

### 4.2 Sensitive Data in Logs

| Check | Result | Evidence |
|-------|--------|----------|
| Database passwords in error output | **BLOCKED** | `checkDatabase()` in `pool.ts` only runs `SELECT 1`; error messages do not expose credentials. |
| Provider internals in error responses | **PASS** | `verifyGstin maps a 401 response without exposing provider internals` (tested). |
| Audit log `details` field may contain free text | **NOT TESTED** | `audit_logs.details` is `nullable text`; observed values include correlation IDs and action descriptions. No inspection for secrets. |

**Findings:**
- No database passwords or secret values exposed in error output.
- Provider error mapping sanitizes responses (tested and verified).

### 4.3 CORS and Security Headers

| Check | Result | Evidence |
|-------|--------|----------|
| CORS configuration | **NOT TESTED** | No `cors()` middleware observed in `server/src/app.ts`; development proxy in `vite.config.ts` forwards `/api` to `http://127.0.0.1:8091` with `changeOrigin: true`. |
| Security headers (`x-powered-by` disabled) | **PASS** | `app.disable('x-powered-by')` in `server/src/app.ts`. |
| Helmet or equivalent | **NOT TESTED** | No `helmet()` middleware observed. |

**Findings:**
- `x-powered-by` disabled — good practice.
- No Helmet middleware; CORS not explicitly configured beyond Vite dev proxy.

---

## 5. File Upload and Access Controls

| Check | Result | Evidence |
|-------|--------|----------|
| Business partner document upload | **FAIL** (now fixed) | Previously used `Math.random` for file size; removed; now uses actual `doc.size` from File object. |
| File size validation | **NOT TESTED** | No observed max-size check; `handleSimulatedUpload` previously generated random size (1500000 range). |
| File type validation | **NOT TESTED** | No MIME type or extension check observed. |
| Upload backend endpoint | **NOT TESTED** | No server route for document upload; frontend `localStorage` persistence only. |

**Findings:**
- Document upload `Math.random` removed during this audit; actual file size now used.
- No backend upload endpoint; files are not persisted to server or database.

---

## 6. Rate Limiting and Brute-Force Protections

| Check | Result | Evidence |
|-------|--------|----------|
| API rate limiting | **NOT TESTED** | No rate-limit middleware observed in `server/src/app.ts`. |
| Login brute-force protection | **BLOCKED** | No backend auth; login form has no rate limiting (no backend to track attempts). |
| GST provider retry logic | **PASS** | `gstProvider.ts` retries 429 three times then reports rate limiting; retries 502 then succeeds or reports outage. |

**Findings:** No brute-force protection on login (blocked — no backend). GST provider retry logic is verified and pass.

---

## 7. Dependency Vulnerabilities

| Check | Result | Evidence |
|-------|--------|----------|
| `npm audit` or similar | **NOT PERFORMED** | This audit did not run dependency vulnerability scanning. Lint (`tsc --noEmit`) passes with no new errors. |
| Known vulnerable packages | **UNKNOWN** | Not inspected in this audit. |

**Findings:** Not inspected. Recommend running `npm audit` or `npm audit --audit-level=moderate` as part of future security cycle.

---

## 8. Production Debug Settings

| Check | Result | Evidence |
|-------|--------|----------|
| `NODE_ENV` | **PASS** | `env.nodeEnv: process.env.NODE_ENV ?? 'development'` — default `development`; ensure set to `production` for deployment. |
| Error messages exposing internals | **PASS** | Health endpoint does not expose credentials or SQL details; GST error mapping sanitizes provider internals. |
| Vite `configLoader: 'native'` warning | **PARTIAL** | `vite.config.ts:11:27` — `__dirname` warning; can suppress with `VITE_CONFIG_NATIVE_IGNORE_WARNING=true`. |

**Findings:** Ensure `NODE_ENV=production` for deployment; the `__dirname` warning is cosmetic.

---

## 9. Security Audit Summary

| Category | Status | Evidence |
|----------|--------|----------|
| Backend authentication | **FAIL** | No auth middleware; `users` table 0 rows |
| Frontend auth UI | **FAIL** (under remediation) | Default auto-preset removed; fixed OTP under remediation |
| Cross-user data access | **FAIL** (partially fixed) | Branch filter always true fixed; no backend org scoping |
| Input validation (GST, financial year) | **PASS** | Format/checksum validation before provider call |
| XSS / HTML rendering | **PASS** (GST print) / NOT TESTED (other) | Provider values escaped in print HTML |
| SQL injection | **PASS** | Parameterized queries observed |
| Secret exposure (GST key) | **BLOCKED** | Key server-only; never in browser bundles |
| Error message sanitization | **PASS** | No credentials or provider internals exposed |
| CORS / security headers | **NOT TESTED** / **PASS** | `x-powered-by` disabled; no Helmet; CORS not configured |
| File upload | **FAIL** (now fixed) | `Math.random` removed; actual file size used |
| Rate limiting | **NOT TESTED** / **PASS** | GST retry logic pass; no login rate limiting (BLOCKED) |
| Dependency vulnerabilities | **NOT PERFORMED** | Not inspected |
| Production debug settings | **PARTIAL** | `NODE_ENV` default `development`; ensure `production` for deploy |

**Overall Security Status: FAIL / BLOCKED / PARTIAL**

Critical: No backend authentication; users table empty. High: No org/branch scoping, no rate limiting, no brute-force protection. Medium: File upload `Math.random` removed; XSS not fully inspected. Low: Secret exposure correctly handled; input validation pass.

**Required before release:**
1. Implement real backend authentication (or explicitly block all production login with no bypass).
2. Configure `GST_API_PROVIDER_KEY` or formally mark GST `BLOCKED`.
3. Add org/branch scoping logic if multi-tenant behavior is required.
4. Consider Helmet middleware and CORS configuration.
5. Run `npm audit` for dependency vulnerabilities.