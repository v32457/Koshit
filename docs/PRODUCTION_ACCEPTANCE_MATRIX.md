# KOSH INNOVATIONS — PRODUCTION ACCEPTANCE MATRIX

**System Name:** My Kosh Innovations Global IT System  
**Version:** v2.5.0-PROD  
**Target Environments:**
- Production Target: `https://my.koshinnovations.com/`
- Local / UAT Target: `http://localhost/mykoshinnovations`  
**Evaluation Date:** October 23, 2026  

---

## 1. Executive Summary & Verification Method

This Production Acceptance Matrix tracks every user-facing route, component, permission boundary, API integration, and background governance process within the **My Kosh Innovations Global IT System**.

All acceptance criteria have been verified against:
- Static Type Validation (`tsc --noEmit` via `npm run lint`)
- Production Bundle Compilation (`vite build` via `npm run build`)
- Interactive View Rendering & State Resilience Verification

---

## 2. Page & Component Acceptance Inventory

| ID | Route / View | Scope / Description | Acceptance Criteria | Tested Roles | Status |
|---|---|---|---|---|---|
| **P-01** | `/` (`LandingPageView`) | Public Landing Page | Public brand header, hero section, feature breakdown cards, workflow explanation, security highlights, support info, footer links. | Anonymous, All Users | **PASS** |
| **P-02** | `/login` (`LoginPageView`) | Corporate Login & Authentication | Email/password validation, show/hide toggle, quick-select role presets, 2FA OTP verification step (`123456`), non-enumerating token reset request, Base64 link obfuscation. | Anonymous, All Users | **PASS** |
| **P-03** | `/privacy`, `/terms` (`PublicLegalViews`) | Public Governance Policies | Corporate data privacy disclosure, terms of service, system security compliance notices. | Anonymous, All Users | **PASS** |
| **P-04** | `/dashboard` (`DashboardView`) | Corporate Operational Dashboard | Item request metrics, draft counts, pending approval counts, SAP sync status, plant availability trends, quick creation shortcuts. | All Signed-In Roles | **PASS** |
| **P-05** | `/items` (`ItemMasterListView`) | Global Item Master List | Server-backed search, sorting across columns, multi-category filtering, branch availability filters, pagination controls, bulk import wizard, export center. | Maker, Checker, Admin, Auditor | **PASS** |
| **P-06** | `/items/new` (`ItemCreationView`) | Create Item | Rule-driven Global Item Code and Description generation previews, 13 classification categories, material/type/colour/form selectors, live validation. | Item Maker, Admin | **PASS** |
| **P-07** | `/items/custom-specifications` | Custom Specifications | Customer/Manufacturer/Brand Master and Customer/Part/Model Number reference management. | Item Maker, Admin | **PASS** |
| **P-08** | `/items/branch-availability` | Branch Availability | Multi-plant item availability tracking across Pondicherry, Chennai, Hosur, Pune, Dehradun. | All Branch Roles | **PASS** |
| **P-09** | `/business-partners` | Business Partner Master | Customer, Supplier/Vendor, Lead partner management. Contact persons grid, multi-address bill/ship structures, payment terms, accounting mappings, GSTIN checksum validation, **GST state-code save gate**, real gstinapi.in verification, filing-history lookup, and third-party print. | BP Specialist, Admin | **PASS (code) / BLOCKED (live GST key)** |
| **P-10** | `/requests` (`MyRequestsView`) | My Requests & Draft Tracker | Tracking submitted item and partner requests, revision history, return-for-correction resubmissions. | Item Maker, BP Maker | **PASS** |
| **P-11** | `/approvals` (`ApprovalInboxView`) | Approval Inbox | Checker review queue, sequential/parallel approval stages, maker-checker enforcement, rejection comments, approval history. | Item Checker, Org Admin | **PASS** |
| **P-12** | `/settings/module-management` | Module Registry | Enable/Disable controls for Item Master & Business Partner Master, feature flags, route & API access gating. | Platform Admin | **PASS** |
| **P-13** | `/settings/approval-workflows` | Workflow Management | Multi-level approval engine rule configuration, quorum policy (ALL/ANY/N-of-M), conditional routing, SLA timers. | Platform Admin | **PASS** |
| **P-14** | `/settings/item-code-rules` | Item Code & Description Rules | Visual rule builder, component reordering, conditional fields, sequence width, live rule simulator. | Global Item Admin | **PASS** |
| **P-15** | `/communication/*` | Communication & Notification Hub | Single consolidated navigation entry (`/communication/overview`, `/communication/hub`, `/communication/whatsapp-config`, `/communication/email-templates`, `/communication/queue`, `/communication/reports`). WhatsApp central sender (+91 98401 22320), recipient E.164 verification, webhooks, consent governance. | All Authorized Roles | **PASS** |
| **P-16** | `/integration/*` | SAP B1 HANA Integration | Service Layer profiles, field mapping builder, automated scheduler, 20-test harness, activation controls, idempotency locks, dead-letter queue. | SAP Admin, Platform Admin | **PASS** |
| **P-17** | Unknown Routes (`NotFoundView`) | 404 Route Recovery | Graceful error screen with direct recovery links to Public Home or Dashboard. | All Users | **PASS** |

---

## 3. Workflow & Business Rule Matrix

1. **Maker-Checker Isolation**:
   - Requesters (Makers) cannot approve their own item or business partner requests. Enforced in UI and backend state logic. (**PASS**)
2. **Deterministic Code & Description Synthesis**:
   - Category-specific rule evaluation generates collision-free provisional and permanent item codes. (**PASS**)
3. **Business Partner GST Save Gate**:
   - Saving a Business Partner record is strictly blocked if the GSTIN state code (e.g., `33` Tamil Nadu) conflicts with the selected address state (e.g., `Maharashtra`). (**PASS**)
4. **Central WhatsApp Business Sender**:
   - Outbound WhatsApp communications route via centrally verified company sender `+91 98401 22320` to normalized E.164 recipient phone numbers. (**PASS**)
5. **Non-Enumerating Password Reset**:
   - Password reset requests return uniform responses regardless of account existence. Single-use 15-minute Base64 obfuscated links prevent user harvesting. (**PASS**)
6. **GST Verification & Filing History**:
   - GSTIN checksum and state-code validation runs before any provider call. The server calls gstinapi.in with the API key held only in server configuration, rejects responses whose GSTIN or financial year does not match the request, and persists only validated responses. Empty filing history remains empty; provider and database failures remain visible failures. (**PASS in automated tests / live provider check BLOCKED until `GST_API_PROVIDER_KEY` is supplied**)

---

## 4. GST Verification Evidence (October 31, 2026)

| Check | Evidence | Status |
|---|---|---|
| GSTIN validation | `src/test/gstin.test.ts` plus save-gate UI | **PASS** |
| Financial-year selector | Current and previous two Indian FYs from `shared/financialYear.ts`; `src/test/financialYear.test.ts` | **PASS** |
| Provider adapter | `server/test/gstProvider.test.ts` covers invalid GSTIN, mismatch, malformed payload, 401/402/403/404/429, 502 retry, timeout, network failure, missing key, and optional null fields | **PASS** |
| API routes and persistence | `server/test/gstRoutes.test.ts` covers success, DB failure, missing config, provider error mapping, FY limit, and filing-history failure | **PASS** |
| Print output | `src/test/gstPrint.test.ts` covers actual values, `Unavailable` fallbacks, HTML escaping, empty history, third-party/non-official wording, and blocked print windows | **PASS** |
| Fabricated fallback removal | `src/test/gstVerificationState.test.ts` verifies legacy `VERIFIED` records without provider evidence are downgraded and fabricated government-portal logs are removed | **PASS** |
| Live provider lookup | No `GST_API_PROVIDER_KEY` is configured in this environment | **BLOCKED** |
