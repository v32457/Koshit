# KOSH Innovations — Enterprise Zero-Trust Visual Data Protection & Leakage Prevention Engine

## 1. Architecture Summary & Integration Design
The Zero-Trust Visual Data Protection & Leakage Prevention Engine is embedded natively within the KOSH Innovations Enterprise Governance & ERP platform (Express + React/TypeScript + Vite), preserving all existing Procurement, Item Master, GST/MSME, Financial Year, Charge Master, User & Role Administration, and PDF Immutability workflows.

### Authoritative Backend & Frontend Modules
- **Express Full-Stack Entrypoint**: `server.ts` (Port 3000, mounts `/api/security/*` alongside `/api/health`, `/api/items`, `/api/gst`, `/api/charges`).
- **Backend Authoritative Policy & Runtime Engine**: `server/src/services/zeroTrustSecurityBackend.ts` and `server/src/routes/security.ts`.
- **Deterministic Policy Evaluation Engine**: `src/services/zeroTrustPolicyEvaluator.ts` (shared deterministic hierarchy resolver).
- **Protection Runtimes**:
  - `src/services/browserGovernanceService.ts` (Approved Edge/Chrome evaluation, Secure Context & Web API capability probes).
  - `src/services/webcamAiDetectionEngine.ts` (Privacy-preserving local TensorFlow.js + COCO-SSD SSDLite MobileNet v2 inference).
  - `src/components/security/ForensicWatermarkOverlay.tsx` (Identity-bound dynamic canvas watermark).
  - `src/components/security/SecurityBlackoutOverlay.tsx` (Coordinated blackout/suspension lock, 2FA re-auth recovery, and audited Admin Override).
  - `src/components/security/WebcamSecurityMonitorWidget.tsx` (Opt-in/policy-driven webcam guard indicator & live telemetry).
  - `src/components/security/ZeroTrustWorkspaceRuntime.tsx` (Workspace-level runtime guard wrapping authenticated ERP routes in `src/App.tsx`).
- **Governance Control Center UI (`General Settings → Security Governance` / `/settings/general/security`)**:
  - `src/modules/settings/security/SecurityGovernanceCenter.tsx`
  - `src/modules/settings/security/SecurityPolicyScopeEditor.tsx`
  - `src/modules/settings/security/SecurityOperationsPanels.tsx`
  - Integrated into `src/modules/settings/GeneralSettingsView.tsx` and `src/components/NavigationSidebar.tsx`.

---

## 2. Hierarchical Policy Governance & Optional Scopes Matrix
Every security control evaluates deterministically in precedence order:
1. **Level 1 — Global Enterprise Baseline** (`GLOBAL`)
2. **Level 2 — Company** (`COMPANY`)
3. **Level 3 — Branch** (`BRANCH`)
4. **Level 4 — Module** (`MODULE`)
5. **Optional Level 5 — Page / Screen** (`PAGE`, independently toggled via `optionalScopes.pageLevelEnabled`, default `false`)
6. **Optional Level 6 — Individual User** (`USER`, independently toggled via `optionalScopes.userLevelEnabled`, default `false`)
7. **Approved Time-Bound Exceptions** (`AUTHORIZED_EXCEPTION`, maker-checker enforced with automatic expiry reversion)

### Governance Rules Enforced Server-Side
- **Explicit Control States**: `INHERIT`, `ENABLED`, `DISABLED`, `MANDATORY`, `OPTIONAL`, `NOT_APPLICABLE`, `AUTHORIZED_EXCEPTION`.
- **Parent Mandatory Lock**: Once any parent level marks a control `MANDATORY`, child levels (`COMPANY`, `BRANCH`, `MODULE`, `PAGE`, `USER`) cannot weaken or disable that control—only an approved, time-bounded Maker-Checker Exception can temporarily relax it.
- **Anti-Self-Tampering**: Users cannot modify their own `USER` security policy or approve/reject their own policy exception requests (HTTP `403`).
- **Cross-Tenant Isolation**: Company and branch scoped administrators cannot read or mutate other companies' or branches' security policies (HTTP `403`).
- **Versioned Cache Invalidation**: Every policy mutation increments `policyVersion` and `cacheVersion` (`v{N} / c{M}`), forcing immediate runtime revalidation across active protected sessions.

---

## 3. Security Controls & Threat Model Coverage
1. `APPROVED_BROWSER_ONLY`: Chrome / Microsoft Edge family check, minimum major version check, Secure Context verification, and non-compliant session warning/block/blackout modes.
2. `DYNAMIC_WATERMARK`: Dynamic identity-bound diagonal forensic watermark (`User | EmpCode | Company | Branch | Route | SessionRef`). Never renders session secrets or auth tokens.
3. `BLUR_ON_FOCUS_LOSS`: Immediate visibility/focus loss protection via `visibilitychange`, `blur`, `focus`, and `pagehide` events.
4. `SCREEN_LOCK_DETECTION`: Local & server-synchronized screen blackout lock when focus-loss or tamper rules cross threshold.
5. `WEBCAM_PRESENCE_AI`: Local TensorFlow.js + COCO-SSD person presence verification (privacy-first in-memory inference; 0 frames persisted or uploaded).
6. `MULTI_FACE_GUARD`: Multi-person ("shoulder surfing") local detection via COCO-SSD `person` bounding-box count > 1.
7. `PHONE_CAMERA_DETECT_AI`: Local COCO-SSD handheld device (`cell phone`) detection with confidence threshold & multi-frame debounce before triggering escalation.
8. `IDLE_SCREEN_LOCK`: Automated workstation inactivity shield and session protection escalation.
9. `CLIPBOARD_COPY_RESTRICTION`: Copy/cut interception deterrence and audit event logging on sensitive views.
10. `PRINT_SAVE_BLOCK`: `Ctrl+P` / `Ctrl+S` / `beforeprint` deterrence outside approved PDF workflows.
11. `EXPORT_DOWNLOAD_CONTROL`: Governed data export telemetry and restriction gates.
12. `DEVTOOLS_CONTEXT_DETERRENCE`: Right-click context menu & DevTools inspection key chord deterrence with incident telemetry.

---

## 4. Verified Local AI Model & WASM Runtime Inventory
All AI inference dependencies are bundled and verified locally in `public/models/coco-ssd/` and `public/tfjs-wasm/` with zero runtime dependency on external CDNs:

| Artifact | Size | SHA-256 Digest / Status |
|---|---|---|
| `public/models/coco-ssd/model.json` | 527,315 B | `3770b2528339b1e3340cb74360e1e40401816b009779aeb8d0cce3a4353ea3a9` |
| `public/models/coco-ssd/group1-shard1of5` | 4,194,304 B | `0e7af0f713e98521252321f7f84892c31cefccccec3ac64c84e5065b75ed5646` |
| `public/models/coco-ssd/group1-shard2of5` | 4,194,304 B | `74cc6cfc2c4510c9cd81b8ad4cebf6f6a8f305119bb365ce0eb96276da38519a` |
| `public/models/coco-ssd/group1-shard3of5` | 4,194,304 B | `50383033f893eae136392a403e8f70ade5efd90867df5695c4ca5ac640e14f38` |
| `public/models/coco-ssd/group1-shard4of5` | 4,194,304 B | `d856dc534c780068bbf6c666ce1516df2c8433d87578aa31fcdf197de7058cc2` |
| `public/models/coco-ssd/group1-shard5of5` | 1,257,312 B | `3d356f1fb6dfca6af78c56db34d9326706d0196e303f9de6b04f236ca79ed309` |
| `public/tfjs-wasm/tfjs-backend-wasm.wasm` | 311,123 B | `70a5d516060464e5269f01c74bac1772d6b8ab6cb612acf16b5cdaf61f78d892` |
| `public/tfjs-wasm/tfjs-backend-wasm-simd.wasm` | 424,594 B | `77ebb28a6d34f371dbbf2086b7f2de8994acd8ea5a3cf1fa24d2c26c840cac7b` |
| `public/tfjs-wasm/tfjs-backend-wasm-threaded-simd.wasm` | 435,643 B | `c052228d4bef185c27bbe59a9e029570c78bbb9f08b3cb46b597851650373de2` |

NPM Libraries: `@tensorflow/tfjs` (`^4.22.0`), `@tensorflow/tfjs-backend-wasm` (`^4.22.0`), `@tensorflow-models/coco-ssd` (`^2.2.3`), `mysql2` (`^3.24.6`).

---

## 5. Honest Security Scope & Technical Boundaries
1. **Operating System Screenshots & External Cameras**: Web browser JavaScript cannot block OS-level screenshot shortcuts (e.g., Windows `Win+Shift+S`, macOS `Cmd+Shift+4`, kernel display capture) or physical smartphones positioned outside webcam field of view. Visual watermarking, focus-loss blackout, and local webcam phone detection act as deterrence + forensic attribution + risk mitigation layers.
2. **Managed Browser Attestation**: Client-side UA / Client Hints / Web API probing detects browser family (`Edge`, `Chrome`, `Firefox`, `Safari`), versions, and insecure origins (`HTTP` vs `HTTPS`). Cryptographic device/browser enterprise attestation requires customer MDM / Conditional Access + Managed Chrome/Edge policies.
3. **Database Execution**: Migration `server/src/migrations/008_create_zero_trust_security_engine.sql` defines 19 normalized `zt_*` tables for MySQL 8+. In this development/preview sandbox without an active external MySQL server, runtime state executes in `ZeroTrustSecurityBackendStore` inside the Express server on port 3000.

---

## 6. Database Schema, Production Deployment, Backup & Rollback Guide

### Schema (`server/src/migrations/008_create_zero_trust_security_engine.sql` — 19 Tables)
- `zt_security_policy_definitions`, `zt_company_policy_configs`, `zt_branch_policy_configs`, `zt_module_policy_configs`
- `zt_optional_scope_settings`, `zt_optional_page_policy_configs`, `zt_optional_user_policy_configs`
- `zt_security_policy_versions`, `zt_policy_exceptions`, `zt_exception_approvals`, `zt_effective_policy_evaluations`
- `zt_security_events`, `zt_security_incidents`, `zt_session_protection_states`, `zt_browser_compliance_logs`
- `zt_software_registry`, `zt_ai_model_registry`, `zt_deployment_health_checks`, `zt_security_admin_audit_history`

### Production Deployment Sequence
1. **Backup Current Production Database**:
   ```bash
   mysqldump --single-transaction --routines --triggers -h "$MYSQL_HOST" -u "$MYSQL_USER" -p "$MYSQL_DATABASE" > "backup_pre_zt_$(date +%Y%m%d_%H%M%S).sql"
   ```
2. **Apply Migration 008**:
   ```bash
   mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p "$MYSQL_DATABASE" < server/src/migrations/008_create_zero_trust_security_engine.sql
   ```
3. **Verify SHA-256 Model & WASM Checksums**:
   Verify `public/models/coco-ssd/manifest.json` against deployed static bundle before enabling `WEBCAM_PRESENCE_AI` / `PHONE_CAMERA_DETECT_AI` in Global policy.
4. **Build & Start Full-Stack Service**:
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```
5. **Health Check**:
   Confirm `GET /api/security/health` returns `status: "HEALTHY"`, `localAiModelReady: true`, and verified file counts.

### Emergency Rollback Procedure
- **Policy-Level Instant Rollback (Zero Downtime)**: In `General Settings → Security Governance`, revert the Global/Company/Branch policy version or toggle Optional `PAGE` / `USER` scopes `DISABLED` (triggers immediate cache version increment and session revalidation).
- **Database Schema Rollback (Pre-Cutover Clean Revert)**:
  ```sql
  DROP TABLE IF EXISTS
    zt_security_admin_audit_history, zt_deployment_health_checks, zt_ai_model_registry,
    zt_software_registry, zt_browser_compliance_logs, zt_session_protection_states,
    zt_security_incidents, zt_security_events, zt_effective_policy_evaluations,
    zt_exception_approvals, zt_policy_exceptions, zt_security_policy_versions,
    zt_optional_user_policy_configs, zt_optional_page_policy_configs, zt_optional_scope_settings,
    zt_module_policy_configs, zt_branch_policy_configs, zt_company_policy_configs,
    zt_security_policy_definitions;
  ```
  Restore pre-migration database snapshot if needed (`mysql ... < backup_pre_zt_*.sql`).
