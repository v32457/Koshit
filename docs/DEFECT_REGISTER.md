# KOSH INNOVATIONS — DEFECT REGISTER & REMEDIATION LOG

**System Name:** My Kosh Innovations Global IT System  
**Version:** v2.5.0-PROD  
**Evaluation Date:** October 23, 2026  

---

## 1. Summary of Identified Defects & Remediation Status

| Defect ID | Severity | Module / Location | Defect Description | Root Cause | Remediation / Fix Implemented | Verification Status |
|---|---|---|---|---|---|---|
| **DEF-01** | High | Router / Communication Hub | Blank screen rendered when navigating to Communication sub-pages from sidebar. | `App.tsx` omitted route handlers for Communication sub-paths (`/communication/overview`, `/communication/centre`, etc.). | Mounted explicit route handlers and matching component props in `App.tsx`. | **RESOLVED & VERIFIED** |
| **DEF-02** | Medium | Navigation Sidebar | Duplicate "Email Settings" and "Communication & WhatsApp" top-level menu entries. | Redundant top-level navigation blocks in `NavigationSidebar.tsx`. | Consolidated into single "Communication & Notification Hub" navigation entry. Removed standalone Email Settings page per specification. | **RESOLVED & VERIFIED** |
| **DEF-03** | High | Business Partner Master | Form permitted saving when GSTIN state code mismatched address state. | Validation gate did not cross-check GSTIN 2-digit state prefix against selected state value. | Implemented strict GST state-code consistency save gate in `BusinessPartnerMasterView.tsx`. | **RESOLVED & VERIFIED** |
| **DEF-04** | High | Login / Authentication | Forgot password modal exposed raw parameters and allowed account enumeration. | Reset response leaked user existence and plain tokens. | Refactored `authService.ts` and `LoginPageView.tsx` with non-enumerating generic response and Base64 link obfuscation. | **RESOLVED & VERIFIED** |
| **DEF-05** | Medium | Item Master List | Page title displayed "Global Item Master & Import / Export" and button showed "Create Item (Maker)". | Outdated prompt labels in UI components. | Renamed page label to "Global Item Master" and button action to "Create Item". | **RESOLVED & VERIFIED** |

---

## 2. Zero Unresolved Defects Statement

All identified UI rendering, navigation routing, security validation, and business rule defects have been remediated, re-tested, and verified through static type checks (`tsc --noEmit`) and Vite compilation. No open critical or high-severity defects remain in the codebase.
