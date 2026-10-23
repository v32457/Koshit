# KOSH INNOVATIONS — STAGE 0 ARCHITECTURE & SYSTEM SPECIFICATION
**Application Title**: My Kosh Innovations Global IT System  
**Module**: Global Item Creation, Governance & SAP Business One HANA Integration (Module 00 - 05.05)  
**Corporate Website**: `https://koshinnovations.com/`  
**Proposed Production Portal**: `https://my.koshinnovations.com/`  
**UAT Environment**: `http://localhost/mykoshinnovations`  
**Document Version**: 1.0.0 (Stage 0 Baseline Review)  
**Date**: 2026-10-22  

---

## Executive Summary & Objective

This specification establishes the architectural foundation for the **My Kosh Innovations Global IT System**, an enterprise-grade multi-branch manufacturing portal. The portal serves as a unified digital ecosystem for Kosh Innovations (headquartered in Pondicherry, with plants across Puducherry, Chennai, Hosur, Pune, and Dehradun). 

The initial production-critical module is the **Global Item Creation & Master Governance System** with direct, controlled integration to **SAP Business One on SAP HANA**.

Per the Consolidated Master Specification:
1. This is a **modular enterprise portal shell**, allowing future modules (e.g., BOM Master, Production Scheduling, Quality Assurance, Logistics) to plug in seamlessly without rewriting authentication, RBAC, branch context, audit, or design-system foundations.
2. Adheres to a strict **gated Stage 0 Architecture Approval** before substantial implementation, followed by a **page-by-page interactive preview and acceptance cycle**.
3. Incorporates real manufacturing master data: 13 industry-standard Categories (FG, SF, RM, BO, PM, MA, CO, SV, SC, TR, CP, MO, HF), precision classifications (Materials, Types, Forms, Processes, Colours, Manufacturers), dynamic category-driven forms, transactional atomic code generation, configurable description engines, and full maker-checker approval workflows.

---

## 1. System Architecture & Modular Shell

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                       Kosh Innovations Enterprise Portal Shell                              │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Header: Kosh Brand Logo | Org Selector | Plant/Branch Switcher | 2FA Badge | User & Role│ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────┬──────────────────────────────────────────────────────────────────┐ │
│ │ Navigation Sidebar   │ Workspace Views (Dynamic Route Mount)                            │ │
│ │ 01. Dashboard        │ ┌──────────────────────────────────────────────────────────────┐ │ │
│ │ 02. Item Master      │ │ Module Registry & RBAC Guard                                 │ │ │
│ │  - 00 Global Items   │ ├──────────────────────────────────────────────────────────────┤ │ │
│ │  - 01 Item Creation  │ │ - Form Engine (Category-driven conditional fields)           │ │ │
│ │  - 02 Branch Avail.  │ │ - Live Preview (Provisional Code & Auto-Description)         │ │ │
│ │ 03. My Requests      │ │ - Approval Engine (Maker-Checker segregation)                │ │ │
│ │ 04. Approval Inbox   │ │ - Rule Engine (Pattern builder, atomic sequences, simulator) │ │ │
│ │ 05. Settings & Logs  │ │ - SAP HANA Integration Manager (Profiles, Tests, Scheduler)  │ │ │
│ │ 05.05 SAP Integr.    │ │ - Audit Trail & 2FA Security Center                          │ │ │
│ │ [Future: BOM Master] │ └──────────────────────────────────────────────────────────────┘ │ │
│ └──────────────────────┴──────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                  │ HTTPS REST / Bearer Auth
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            Application Backend Services & API                               │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Express / FastAPI API Gateway (Auth, RBAC Guard, Input Validation, Session, CSRF, CORS) │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌───────────────────┬───────────────────┬───────────────────┬───────────────────────────┐   │
│ │ Item Governance   │ Rule Builder      │ Approval Workflow │ Durable Job Scheduler     │   │
│ │ Service           │ Service           │ Engine            │ (Asia/Kolkata timezone)   │   │
│ └───────────────────┴───────────────────┴───────────────────┴───────────────────────────┘   │
│ ┌───────────────────────────────────────┬───────────────────────────────────────────────┐   │
│ │ SAP Integration Adapter Layer         │ Governance Audit & Security Engine            │   │
│ │ - Service Layer Client (HANA)         │ - Append-only tamper-evident audit logging    │   │
│ │ - DI API Bridge (Windows COM Bridge)  │ - Email 2FA OTP & Rate Limiting               │   │
│ │ - Transactional Outbox & DLQ Recovery │ - Secret Masking & Protected Vault Reference  │   │
│ └───────────────────────────────────────┴───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                  │ Transactional Pool
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL Enterprise Relational Database                            │
│ (Organizations, Branches, Plants, Users, RBAC, Classification Masters, Rules, Items,        │
│  Item Branches, Approval Steps, SAP Profiles, Schedules, Idempotency Keys, DLQ, Audit)      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack & Repository Layout

### Frontend Architecture
- **Framework**: React 19 with TypeScript 7 (Strict Typing, Functional Components, Custom Hooks).
- **Styling**: Tailwind CSS v4 with industrial design tokens and WCAG 2.2 AA compliant contrast.
- **Routing**: React Router v6 / State-based module router supporting deep-linking, query params (`?autostart=1`, `?tab=`), and browser history.
- **State Management & Caching**: TanStack Query / React Context with Optimistic UI updates.
- **Form System**: React Hook Form with Zod schema validation and dynamic conditional field schemas per category.
- **Icons & Motion**: Lucide React and Framer Motion for clean, subtle transitions.

### Backend & Integration Architecture
- **Full-Stack Runtime**: Express.js server (`server.ts`) with typed API router mounted at `/api/v1`, integrated with Vite middleware for dev and static production serving.
- **Data Persistence**: Relational schema models with ACID transactions, atomic counter locks, and foreign key integrity.
- **Scheduling**: Durable Node/Server scheduler running in `Asia/Kolkata` time zone with persistent job tables.
- **SAP Business One Connectivity**:
  - Primary: SAP Business One Service Layer (REST/OData via HTTPS over SAP HANA).
  - Secondary: DI API Bridge contract (modular interface for Windows COM bridge).
  - Testing & Verification: Fully isolated Mock SAP Server with configurable latency, error simulation, and schema validation.

### Repository Structure
```
├── docs/
│   ├── stage-0-architecture-proposal.md     # This comprehensive architecture spec
│   ├── page-acceptance-register.md          # Version-controlled Page Acceptance Register
│   └── deployment-guide.md                  # Subdomain & server deployment handbook
├── src/
│   ├── assets/                              # Logos, branding SVG, corporate badges
│   ├── components/                          # Shared Design System components
│   │   ├── BrandLogo.tsx                    # Kosh Innovations genuine corporate logo
│   │   ├── AppHeader.tsx                    # Header with Org/Branch switcher, 2FA indicator
│   │   ├── NavigationSidebar.tsx            # Permission-aware hierarchical navigation
│   │   ├── Breadcrumb.tsx                   # Enterprise breadcrumb trail
│   │   ├── PageAcceptancePanel.tsx          # Interactive Accept/Reject review bar
│   │   ├── DataTable.tsx                    # Sortable, filterable, paginated enterprise table
│   │   ├── StatusBadge.tsx                  # Standardized color-coded lifecycle badges
│   │   ├── ConfirmDialog.tsx                # Consequential action modal
│   │   └── SearchableSelect.tsx             # Keyboard-navigable master dropdown
│   ├── context/
│   │   ├── AuthContext.tsx                  # User profile, RBAC permissions, 2FA state
│   │   ├── OrgBranchContext.tsx             # Active Organization & Branch/Plant scope
│   │   └── ThemeContext.tsx                 # Corporate design tokens & styling state
│   ├── modules/
│   │   ├── dashboard/                       # Module 01: KPI Dashboard & Trends
│   │   ├── items/                           # Module 02: Item Creation, Master List, Branch Matrix
│   │   ├── requests/                        # Module 03: My Requests & Revisions
│   │   ├── approvals/                       # Module 04: Approval Inbox & Maker-Checker Queue
│   │   ├── settings/                        # Module 05: Classifications, Rules, Users, Orgs, Logs
│   │   └── integration/                     # Module 05.05: SAP Integration, Testing, Activation, Monitor
│   ├── services/
│   │   ├── itemCodeEngine.ts                # Concurrency-safe Item Code generation logic
│   │   ├── itemDescriptionEngine.ts         # Template parsing & description generator
│   │   ├── sapAdapter.ts                    # SAP Service Layer client & error mapper
│   │   └── auditLogger.ts                   # Append-only governance event logger
│   ├── test/                                # Node:test / tsx unit tests for pure logic
│   │   ├── itemCodeEngine.test.ts           # Concurrency, padding, component order tests
│   │   ├── itemDescriptionEngine.test.ts    # Syntax, trimming, optional field handling tests
│   │   └── sapAdapter.test.ts               # Idempotency, error classification, retry tests
│   ├── App.tsx                              # Main shell & route orchestrator
│   └── main.tsx                             # Application entry point
├── server.ts                                # Backend API server & durable job scheduler
├── package.json                             # Dependencies & build scripts
└── metadata.json                            # Applet identity & permissions
```

---

## 3. Route & Page Inventory (19 Distinct Screens)

| Route | Page Key | Page Title | Primary Workflow & Permissions |
| :--- | :--- | :--- | :--- |
| `/login` | `P-00` | Login & 2FA Verification | User authentication, password verification, Email OTP 2FA challenge, remember session. |
| `/` | `P-01` | Corporate Dashboard | Executive overview: Approved items, pending approvals, SAP queue, branch statistics, creation trends. |
| `/items` | `P-02` | Global Item Master & Import/Export | Search, filter, column toggles, detail view, version history drawer, bulk CSV import/export. |
| `/items/new` | `P-03` | Item Creation (Maker Form) | 13 Category selector, dynamic conditional attributes, live code/description preview, draft autosave. |
| `/items/branch-availability` | `P-04` | Branch Item Availability | Plant assignment matrix, branch-specific purchasing/manufacturing flags, active status toggle. |
| `/requests` | `P-05` | My Requests Tracker | Creator's submission inbox, draft status, returned request corrections, version diffs. |
| `/approvals` | `P-06` | Approval Inbox (Checker) | Maker-checker review queue, field diff comparison, Approve/Reject/Return actions with required remarks. |
| `/settings/general` | `P-07` | General & Security Settings | Email-based 2FA enable/disable, session timeouts, lockout limits, password policies. |
| `/settings/classifications` | `P-08` | Classification Masters | Master tables: 13 Categories, Materials, Types, Forms, Processes, Colours, Manufacturers (CRUD & status). |
| `/settings/item-code-rules` | `P-09` | Item Code Rule Builder & Simulator | Visual component reordering, sequence scope configuration, delimiter rules, live test simulator. |
| `/settings/item-description-rules` | `P-10` | Item Description Rule Builder | Drag/drop template builder, optional field logic, whitespace normalizer, preview tester. |
| `/settings/organizations` | `P-11` | Org & Branch Management | Tree structure: Kosh Org -> Business Units -> Branches (Pondicherry, Chennai, Hosur, Pune, Dehradun) -> Plants. |
| `/settings/users-roles` | `P-12` | User & Role Administration | User credentials, role assignments, multi-branch scoping, temporary access expiry. |
| `/settings/rule-history` | `P-13` | Rule Version History & Rollback | Immutable version timeline, visual diff between versions, audited one-click rollback. |
| `/settings/audit-logs` | `P-14` | Enterprise Audit Log Viewer | Append-only event history, actor, action, timestamp, correlation ID, before/after JSON diffs. |
| `/integration/profiles` | `P-15` | SAP Integration Creation & Scheduling | Profile configuration (HANA URL, Company DB, TLS, timeouts, batch size), durable scheduler (`Asia/Kolkata`). |
| `/integration/testing` | `P-16` | SAP Integration Testing & Reports | 20 safe automated tests (Reachability, TLS, Auth, UDF availability, Field mapping, Simulation), PDF/CSV export. |
| `/integration/activate` | `P-17` | Activate Integration & Emergency Stop | Gated activation dashboard, checker approval, post-activation non-mutating health check, emergency stop switch. |
| `/integration/monitor` | `P-18` | SAP Monitor, Jobs & DLQ Recovery | Real-time job executions, sync status, reconciliation discrepancies, Dead Letter Queue (DLQ), manual retry. |

---

## 4. Corporate Brand Identity & Design System

### Verified Kosh Innovations Brand Tokens
Drawing from Kosh Innovations' corporate identity as a manufacturing leader in automotive tubing, precision injection moulding, and assemblies:

```css
:root {
  /* Primary Corporate Palette */
  --kosh-navy-dark: #0B192C;     /* Deep Industrial Navy - Header, primary text */
  --kosh-navy-surface: #1E3E62;  /* Corporate Slate Blue - Active states, borders */
  --kosh-blue-primary: #005691;  /* Kosh Royal Blue - Primary buttons, links */
  --kosh-blue-light: #EBF4F6;    /* Soft Surface Tint - Table headers, badge backgrounds */
  
  /* Accent & Manufacturing Energy */
  --kosh-orange-accent: #E85C0D; /* Industrial Flame Orange - Attention badges, highlights */
  --kosh-amber: #D97706;         /* Warning / Pending maker-checker state */
  
  /* Neutral Industrial Surfaces */
  --kosh-bg-canvas: #F8FAFC;     /* Clean enterprise canvas background */
  --kosh-bg-card: #FFFFFF;       /* Pure white crisp card surfaces */
  --kosh-border-subtle: #E2E8F0; /* Clean hairline borders */
  --kosh-border-strong: #CBD5E1; /* Input borders */
  --kosh-text-primary: #0F172A;  /* Deep slate readable typography */
  --kosh-text-muted: #64748B;    /* Secondary labels & help text */
  
  /* Semantic Status Indicators */
  --kosh-success: #059669;       /* Emerald - Approved, Active, SAP Synced */
  --kosh-error: #DC2626;         /* Ruby Red - Rejected, SAP Error, Validation failure */
  --kosh-info: #0284C7;          /* Sky Blue - Under Review, Scheduled */
}
```

### UI Typography & Accessibility Standard
- **Font Stack**: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.
- **Hierarchy**: Distinct tabular numbering (`font-mono` for Item Codes, SAP numbers, dates), clear uppercase field labels with required asterisks (`*`), accessible tooltips for codes.
- **WCAG 2.2 AA Compliance**: Minimum 4.5:1 contrast ratio across all interactive controls and status badges.
- **Header Elements**:
  - Genuine Kosh Innovations corporate logo + wordmark.
  - Portal Title: `My Kosh Innovations Global IT System` | Subtitle: `Item Master`.
  - Global Organization selector (e.g. `Kosh Innovations Pvt Ltd`).
  - Active Plant/Branch switcher (e.g. `Pondicherry Main Plant (01)`, `Hosur Auto Components (02)`).
  - Security status badge (2FA Enabled).
  - User avatar with active Role and quick access to switch role (for multi-role testing).

---

## 5. Relational Data Model (PostgreSQL Core Schemas)

```sql
-- 1. Organizations & Multi-Branch Hierarchy
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL,      -- 'KOSH'
    name VARCHAR(255) NOT NULL,            -- 'Kosh Innovations Pvt Ltd'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    code VARCHAR(10) NOT NULL,             -- 'POND', 'CHEN', 'HOSR', 'PUNE', 'DDUN'
    name VARCHAR(255) NOT NULL,            -- 'Pondicherry Unit 1'
    city VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(org_id, code)
);

CREATE TABLE plants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id),
    code VARCHAR(10) NOT NULL,             -- 'PLT01'
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. Users, RBAC & Scopes
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,      -- 'ITEM_MAKER', 'ITEM_CHECKER', 'SAP_ADMIN', etc.
    name VARCHAR(255) NOT NULL,
    description TEXT
);

CREATE TABLE user_branch_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    branch_id UUID REFERENCES branches(id), -- NULL indicates Global Scope
    role_id UUID REFERENCES roles(id),
    is_primary BOOLEAN DEFAULT FALSE
);

-- 3. Classification Dimensions & Masters
CREATE TABLE classification_dimensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dimension_key VARCHAR(50) UNIQUE NOT NULL, -- 'category', 'material', 'type', 'form', 'process', 'colour', 'mfg'
    display_name VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL
);

CREATE TABLE classification_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dimension_key VARCHAR(50) NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_label VARCHAR(255) NOT NULL,   -- e.g. 'PP – Polypropylene (PP)'
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(dimension_key, code)
);

-- 4. Item Code & Description Rules (Configurable & Versioned)
CREATE TABLE item_code_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category_code VARCHAR(20),             -- NULL = Global Default, or 'FG', 'RM', etc.
    components_json JSONB NOT NULL,        -- Array of {type, sourceField, length, padding, case}
    separator VARCHAR(5) DEFAULT '',
    sequence_scope VARCHAR(50) DEFAULT 'CATEGORY', -- 'GLOBAL' | 'CATEGORY' | 'BRANCH'
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(30) DEFAULT 'ACTIVE',   -- 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE item_code_sequences (
    scope_key VARCHAR(100) PRIMARY KEY,    -- e.g. 'FG', 'RM', 'GLOBAL'
    current_val BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE item_description_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code VARCHAR(20) UNIQUE NOT NULL,
    template_pattern TEXT NOT NULL,        -- e.g. '{MATERIAL} – {SPECIFICATION} – {COLOUR} – {FORM}'
    separator VARCHAR(5) DEFAULT ' – ',
    max_length INT DEFAULT 200,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Global Items, Requests & Branch Availability
CREATE TABLE global_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    global_item_code VARCHAR(100) UNIQUE NOT NULL,
    category_code VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'DRAFT',   -- 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'SAP_PENDING' | 'SAP_CREATED'
    attributes JSONB NOT NULL,            -- Material, Form, Process, Dimensions, etc.
    code_rule_version INT,
    desc_rule_version INT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE branch_item_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES global_items(id),
    branch_id UUID REFERENCES branches(id),
    is_stocked BOOLEAN DEFAULT TRUE,
    is_purchased BOOLEAN DEFAULT TRUE,
    is_manufactured BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(item_id, branch_id)
);

CREATE TABLE approval_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES global_items(id),
    action VARCHAR(30) NOT NULL,           -- 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN'
    decided_by UUID REFERENCES users(id),
    decision_timestamp TIMESTAMPTZ DEFAULT NOW(),
    remarks TEXT,
    snapshot_json JSONB NOT NULL
);

-- 6. Module 05.05 SAP Integration Engine
CREATE TABLE sap_integration_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    environment VARCHAR(20) NOT NULL,      -- 'DEV' | 'UAT' | 'PROD'
    service_layer_url TEXT NOT NULL,
    company_db VARCHAR(100) NOT NULL,
    credential_vault_ref VARCHAR(255),
    timeout_seconds INT DEFAULT 30,
    max_retries INT DEFAULT 3,
    batch_size INT DEFAULT 50,
    tls_verify BOOLEAN DEFAULT TRUE,
    status VARCHAR(30) DEFAULT 'DRAFT',   -- 'DRAFT' | 'TESTED' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED'
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sap_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES sap_integration_profiles(id),
    cron_expression VARCHAR(50),
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    is_enabled BOOLEAN DEFAULT FALSE,
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ
);

CREATE TABLE sap_integration_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES sap_integration_profiles(id),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(30) NOT NULL,           -- 'PENDING' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED'
    total_records INT DEFAULT 0,
    success_records INT DEFAULT 0,
    failed_records INT DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_summary TEXT
);

CREATE TABLE sap_dead_letter_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES sap_integration_jobs(id),
    item_id UUID REFERENCES global_items(id),
    error_category VARCHAR(50) NOT NULL,   -- 'VALIDATION' | 'DUPLICATE' | 'AUTH' | 'TIMEOUT'
    error_message TEXT,
    retry_count INT DEFAULT 0,
    can_retry BOOLEAN DEFAULT TRUE,
    resolution_status VARCHAR(30) DEFAULT 'OPEN' -- 'OPEN' | 'RESOLVED' | 'DISCARDED'
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id VARCHAR(100) NOT NULL,
    actor_id UUID REFERENCES users(id),
    actor_email VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    changes JSONB,
    client_ip VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. RBAC Matrix & Permission Granularity

| Role Name | Scope | Key Capabilities & Enforced Boundaries |
| :--- | :--- | :--- |
| **Platform Administrator** | Global | Full platform config, tenant settings, integration engine, security policies. Audited on every action. |
| **Organization Administrator** | Organization | User management, branch management, master classification CRUD, global approvals oversight. |
| **Global Item Master Admin** | Global | Maintain rule builders, sequence scopes, category form configurations, emergency rollback. |
| **Item Creator / Maker** | Branch / Org | Create item drafts, view live provisional code preview, edit drafts, submit for approval. **Strictly barred from approving own items.** |
| **Item Approver / Checker** | Branch / Org | Review submissions, inspect field diffs, Approve, Reject, or Return for correction. **Cannot approve items they created.** |
| **Branch Item Coordinator** | Branch | Manage branch availability matrix (procure/stock/mfg flags) for approved items within assigned plants. |
| **Master Data Auditor** | Global | Read-only inspection of Global Items, historical versions, approval records, SAP sync runs, and tamper-evident audit logs. |
| **Integration Service Account**| Headless | Dedicated non-interactive service account for scheduled background SAP sync jobs. |
| **Read-Only Viewer** | Branch / Org | View approved items and catalog search without draft creation or edit rights. |

---

## 7. Configurable Rule Engines

### A. Automatic Item Code Generation Engine
- **Pattern**: Composed of arranged dimension codes plus an atomic sequence counter:  
  `{CATEGORY}{MATERIAL}{TYPE}{FORM}{PROCESS}{COLOUR}{SEQUENCE:4}`
- **Concrete Example (Raw Materials)**:
  - Category: `RM` (Raw Materials)
  - Material: `PA` (PC-ABS)
  - Type: `O` (NA)
  - Material Form: `PO` (Powder)
  - Process: `EX` (Extrusion)
  - Colour: `LG` (Light Grey)
  - Sequence: `0001`
  - **Resulting Item Code**: `RMPAOPOEXLG0001`
- **Concurrency & Numbering Safety**:
  - Live preview generates a **Provisional Code** without incrementing the database counter.
  - Final sequence allocation occurs transactionally during submission/approval via atomic database sequence locking.
  - No gaps from abandoned drafts; guaranteed duplicate prevention across all concurrent workers.

### B. Automatic Item Description Engine
- **Template Formula Examples**:
  - **FG (Finished Goods)**: `{MATERIAL} – {PRODUCT_NAME} – {SPECIFICATION} – {COLOUR}`  
    *Example*: `HDPE – Corrugated Tube 25mm – High Temp Resistant – Grey`
  - **RM (Raw Materials)**: `{MATERIAL} – {SPECIFICATION} – {COLOUR} – {FORM}`  
    *Example*: `PC-ABS – Injection Grade V0 – Light Grey – Powder`
  - **MA (Maintenance / Spares)**: `{PART_NAME} – {MANUFACTURER} – {MODEL_NO} – {RATING}`  
    *Example*: `Pneumatic Cylinder – Festo – DSNU-25-100-PPV-A – 10 Bar`
- **Smart Formatting**: Whitespace normalization, deduplication of hyphens/delimiters, and clean omission of optional empty fields without leaving dangling separators.

---

## 8. Module 05.05 — SAP Business One HANA Integration

### A. Lifecycle State Machine
```
[Draft Profile] 
      │ (Configure HANA URL, Company DB, Credentials)
      ▼
[Configuration Validated]
      │ (Run 20 Automated Safe Tests)
      ▼
[Tests Passed] ──(Any fail)──► [Test Failed - Blocked]
      │ (Submit for Activation Approval)
      ▼
[Activation Approval Required]
      │ (Authorized Checker Review & Approval)
      ▼
[Approved for Activation]
      │ (Authorized Activation Action)
      ▼
[ACTIVE] ◄──► [SUSPENDED] / [EMERGENCY STOP]
```

### B. 20 Automated Pre-Activation Tests (Safe & Non-Mutating)
1. Configuration Completeness Check
2. DNS & Backend Network Reachability
3. TLS/SSL Certificate Validation
4. Service Layer Endpoint Response
5. SAP HANA Session Login & Authentication
6. Target Company Database Existence
7. User Authorization & Object Permission Verification
8. SAP Item Master Metadata & Required Fields Discovery
9. Portal-to-SAP Field Mapping Schema Validation
10. Mandatory Field Constraints Verification
11. ItemCode Length & Character Set Compliance
12. Duplicate ItemCode Target Collision Check
13. Approved UDFs Existence in SAP Schema (`U_Kosh_Category`, `U_Kosh_OriginBranch`, etc.)
14. Read-Only Query on Existing SAP Item Master
15. Non-Mutating Write Simulation (Validation Mode)
16. Server-Side Scheduler Health & Asia/Kolkata Timezone Verification
17. Retry & Timeout Configuration Validation
18. Audit Trail Emission Verification
19. Error Classification & Sanitization Check
20. End-to-End Workflow Dry-Run Simulation

### C. Idempotency, Dead Letter Queue & Reconciliation
- **Idempotency**: Every sync request attaches a deterministic `idempotency_key` (hash of `itemId + globalItemCode + targetCompanyDb + version`). SAP adapter performs pre-check lookup to avoid duplicates.
- **Dead Letter Queue (DLQ)**: Records failing permanent validations or exhausting 3 retries enter the DLQ with sanitized error taxonomy and suggested corrective actions.
- **Reconciliation Engine**: Periodic audit compares SAP Item Master against Kosh Portal records, identifying orphan items, status mismatches, or unsynced records.

---

## 9. Security, 2FA & Compliance Architecture

1. **Email-Based 2FA**:
   - Integrates 6-digit Time-based/Email One-Time Passwords (OTP).
   - Configurable Enable/Disable master switch in System Settings.
   - Brute-force protection: 5 attempts max, 15-minute lock.
2. **Secret Protection**:
   - Zero credentials in client-side code.
   - SAP Service Layer passwords masked with `••••••••••••`.
   - Redaction filters on all log outputs.
3. **Audit Trail**:
   - Append-only schema capturing `Actor`, `Action`, `Entity`, `EntityId`, `IP`, `Timestamp`, and `Diff`.

---

## 10. Proposed Implementation Phases & Gated Workflow

Per the **Mandatory Page-by-Page Preview and Acceptance Addendum**:

- **Stage 0 (Current Step)**: System Architecture, Data Model, RBAC Matrix, Route Inventory, and Test Strategy Review. *Awaiting User Approval.*
- **Stage 1**: Corporate Design System & Authenticated Shell Preview (Brand tokens, Kosh logo, AppHeader, Sidebar, Breadcrumb, Org/Branch Switcher, Acceptance Review Bar).
- **Stage 2**: Dashboard & Operational Overview (P-01).
- **Stage 3**: Item Creation Maker Screen with Live Rule Preview (P-03).
- **Stage 4**: Global Item Master & Import/Export Center (P-02).
- **Stage 5**: Branch Item Availability Matrix (P-04).
- **Stage 6**: Maker-Checker Approval Inbox & Requests (P-05, P-06).
- **Stage 7**: Rule Builders & Classification Administration (P-08, P-09, P-10).
- **Stage 8**: User, Role & Multi-Branch Management (P-11, P-12).
- **Stage 9**: Rule Version History & Audit Logs (P-13, P-14).
- **Stage 10**: Module 05.05 SAP Integration Creation & Scheduling (P-15).
- **Stage 11**: Module 05.05 SAP Testing Suite & 20 Safe Checks (P-16).
- **Stage 12**: Module 05.05 SAP Gated Activation & Monitor/DLQ (P-17, P-18).
- **Stage 13**: Final Verification, Deployment Handover & Production Zip Packaging.

---
*Ready for User Review and Explicit Stage 0 Approval.*
