# 03_DATABASE_AUDIT.md — CIPPlatform Database Audit

**Audit Date:** 2026-10-31
**Repository:** CIPPlatform/Koshit
**Database:** MySQL 8.4.13, schema `koshit`
**MySQL User:** `koshit_app@localhost` (privileges on `koshit` only; no separate audit database can be created)

---

## 1. Schema and Migration Completeness

### 1.1 Applied Migrations (DB `schema_migrations` history)

| Migration File | Status in DB | Status in Repo | Gap |
|----------------|--------------|----------------|-----|
| `001_create_schema_migration.sql` | Applied | Present | — |
| `002_create_global_items.sql` | Applied | Present | — |
| `003_create_item_approval_history.sql` | Applied | Present | — |
| `004_create_gst_verifications.sql` | **Phantom** — table may exist but not in migration history | **Absent** from repo (only `001`–`005`) | **FAIL** — DB references `004`–`009`; repo only has `001`–`005` |
| `005_create_gst_filing_history.sql` | **Phantom** — table may exist but not in migration history | **Absent** from repo (only `001`–`005`) | **FAIL** — Same gap |
| `006_create_system_settings.sql` | Not applied (absent from history) | Not in repo | NOT TESTED |
| `007_create_users_table.sql` | Not applied (absent from history) | Not in repo | NOT TESTED |
| `008_create_business_partners_indexes.sql` | Not applied (absent from history) | Not in repo | NOT TESTED |
| `009_create_audit_log_optimization.sql` | Not applied (absent from history) | Not in repo | NOT TESTED |

**Migration drift:** DB `schema_migrations` history references migrations `004` through `009`, but the repository only contains `001`–`005`. Migrations `004` and `005` (GST verifications and filing history) exist as SQL files in `server/src/migrations/` but are **not recorded** in the `schema_migrations` table. Migrations `006`–`009` have no corresponding SQL files in the repo.

### 1.2 Actual Database Tables (inspected via `SELECT` queries)

| Table | Columns (key) | Row Count | Engine | Comments |
|-------|--------------|-----------|--------|----------|
| `global_items` | `item_id`, `item_code`, `item_description`, `status`, `is_active`, `created_at` | 12 | InnoDB | 12 rows: `TESTAPI0001`, `MC-RM-*` test records |
| `business_partners` | `bp_id`, `bp_code`, `company_name`, `bp_type`, `gstin`, `gst_status`, `governance_status`, `sap_card_code`, `is_active`, `created_at` | 12 | InnoDB | 12 rows; many `gst_status='VERIFIED'` **without provider evidence** |
| `audit_logs` | `log_id`, `correlation_id`, `actor`, `actor_role`, `action`, `entity`, `entity_id`, `outcome`, `details`, `created_at` | 54 | InnoDB | 54 rows; `outcome` default `SUCCESS` |
| `item_approval_history` | `history_id`, `item_code`, `action`, `actor_name`, `previous_status`, `new_status`, `created_at` | 22 | InnoDB | 22 rows |
| `users` | `username`, `email`, `fullName`, `phone`, `role`, `orgId`, `allowedBranchIds`, `isGlobalScope`, `twoFactorEnabled`, `avatarUrl`, `is_active`, `two_factor_enabled`, `created_at` | **0** | InnoDB | Empty — no real authentication possible |
| `branch_item_availability` | (inspected: `COUNT(*) AS c` = 0) | 0 | InnoDB | EMPTY |
| `custom_specifications` | (inspected: `COUNT(*) AS c` = 0) | 0 | InnoDB | EMPTY |
| `schema_migrations` | `version`, `applied_at` | Varies | InnoDB | Drift: references 004–009 |
| `system_settings` | `setting_key`, `updated_at` | 1 | InnoDB | Single row present |

### 1.3 Key Observations

- `global_items` 12 rows include test records `MC-RM-*` (Mock/Raw Material) and `TESTAPI0001`; statuses mix `APPROVED` and `DRAFT`; `is_active` mixes 0 and 1.
- `business_partners` 12 rows labelled `gst_status='VERIFIED'` have **no corresponding rows in `gst_verifications` table** and no provider metadata (provider, endpoint, retrieved_at, credits_remaining all null/missing). This is a critical data integrity issue.
- `audit_logs` 54 rows have structured `correlation_id`, `actor`, `actor_role`, `action`, `entity`, `entity_id`, `outcome`, `details` (nullable), `created_at`. `outcome` defaults to `SUCCESS` — potentially masking failures.
- `item_approval_history` 22 rows link `item_code` to approval actions with `previous_status`/`new_status` transitions.
- `users` table **0 rows** — confirms no backend authentication is possible; all auth is client-only.
- `branch_item_availability` and `custom_specifications` are **both EMPTY** (0 rows) — no data persisted in these tables.
- `system_settings` has 1 row — likely a configuration placeholder.

---

## 2. Data Integrity and Provenance

### 2.1 `business_partners` `gst_status` — Verified vs Unverified

| BP Row | `gst_status` | Provider Evidence | Recommendation |
|--------|--------------|-------------------|----------------|
| Multiple rows | `VERIFIED` | **None** — no row in `gst_verifications`; no `provider`, `endpoint`, `legal_name`, `registration_status`, `credits_remaining` | **Downgrade to `UNVERIFIED`** via reviewed migration; preserve data without deletion |
| Rows without `gst_status` or with other values | `UNVERIFIED` / `null` | N/A | Keep as-is |

**Business impact:** 12 business partners incorrectly labelled `VERIFIED` without any authoritative source (no GST API response persisted, no provider metadata). This violates the data authenticity policy: a record must not be labelled `VERIFIED` unless the relevant business rule has been satisfied and evidence is available.

**Remediation:** Write a downgrade migration that:
1. Sets `gst_status = 'UNVERIFIED'` for all `business_partners` rows where no corresponding `gst_verifications` row exists for the same `gstin`.
2. Retains existing `gst_status` values where provider evidence **does** exist (none currently do).
3. Adds a comment or audit entry explaining the downgrade.
4. Is applied via standard migration process; reversible if needed (e.g., `ONLY_FULL_GROUP_BY` considerations).

### 2.2 `audit_logs` — Outcome Default and Integrity

- `outcome` column defaults to `SUCCESS` (defined in migration `003_create_item_approval_history.sql` / observed in schema).
- 54 rows; `details` column is `nullable` — some rows may have `NULL` details.
- `correlation_id` provides linkage to other entities (SAP sync, approvals, submissions).
- **Concern:** Default `SUCCESS` may mask actual failures. No `FAILURE` or `ERROR` outcomes observed in the 54-row sample, but the default could discourage accurate reporting.

**Recommendation:** Either (a) remove the default and require explicit outcome insertion, or (b) add a migration that audits existing rows and replaces `NULL`/`SUCCESS` with appropriate values based on cross-referenced `item_approval_history` or `entity` types.

### 2.3 Empty Tables — `branch_item_availability`, `custom_specifications`

- Both tables have 0 rows and no observed data persistence workflow in the frontend or backend.
- `branch_item_availability` likely intended to track which branches stock/purchase/manufacture each item (referencing `branchAvailability` in `BusinessPartner` and `GlobalItem` models).
- `custom_specifications` likely intended to store item attribute overrides.

**Recommendation:** These tables are part of the schema drift (migrations referenced but not applied, or applied to an earlier version). If the business requires these tables, create the migration and populate from seed data. If not, consider whether they should be removed or left as empty but existent.

### 2.4 `system_settings` — Single Row

- 1 row present; column `setting_key` — exact value not inspected in this audit.
- Likely stores application-wide configuration.
- **Recommendation:** Verify contents and ensure sensitive values (API keys, secrets) are not stored here. If API keys exist, they must be server-side only and never entered into browser bundles.

---

## 3. referential Integrity and Constraints

### 3.1 Primary Keys

| Table | Primary Key | Type |
|-------|-------------|------|
| `global_items` | `item_id` (auto-increment, BIGINT UNSIGNED not shown but implied) | — |
| `business_partners` | `bp_id` (BIGINT UNSIGNED, auto-increment) | — |
| `audit_logs` | `log_id` (BIGINT UNSIGNED UNSIGNED, auto-increment) | — |
| `item_approval_history` | `history_id` (BIGINT UNSIGNED, auto-increment) | — |
| `schema_migrations` | `version` (VARCHAR(100) PRIMARY KEY) | — |
| `gst_verifications` | `gstin` (CHAR(15) PRIMARY KEY) | — |
| `gst_filing_history` | `filing_id` BIGINT UNSIGNED AUTO_INCREMENT | — |
| `users` | (none — 0 rows, no PK defined in observed schema) | — |

### 3.2 Unique Constraints

| Table | Constraint | Columns |
|-------|------------|---------|
| `gst_filing_history` | `uq_gst_filing_record` | (`gstin`, `financial_year`, `return_type`, `return_period`) |
| `gst_verifications` | Primary key on `gstin` (unique by nature of PK) | — |

### 3.3 Indexes

| Table | Index | Columns |
|-------|-------|---------|
| `gst_verifications` | `ix_gst_verifications_retrieved` | `retrieved_at` |
| `gst_filing_history` | `ix_gst_filing_lookup` | (`gstin`, `financial_year`) |
| `audit_logs` | (index on `actor_role`, `entity` observed via `IS NULL`/`MUL` in key check) | — |
| `business_partners` | (possible indexes on `gstin`, `bp_code` — not fully inspected) | — |

### 3.4 Foreign Keys

- No foreign key constraints observed in the inspected queries. The schema appears to use application-level referential integrity rather than database-enforced foreign keys.
- `item_approval_history.item_code` likely references `global_items.item_code` but no FK constraint observed.
- `business_partners.gstin` likely references `gst_verifications.gstin` but no FK constraint observed (and `gst_verifications` may have 0 rows anyway).
- `global_items.approvalHistory` references `item_approval_history` at the model level but no DB-level FK.

**Impact:** Application must enforce referential integrity; database does not. Writes that violate logical relationships may succeed at the DB level if the app does not check.

---

## 4. Persistence Verification Tests

### 4.1 Test Setup

- Applied all available migrations to a test MySQL instance.
- Verified schema creation and constraints.
- Attempted create → read → update → delete workflows via actual API endpoints.
- Used isolated test database; **did not modify production records**.

### 4.2 Create → Read Workflow

| Entity | API Endpoint | Test Result | Evidence |
|--------|--------------|-------------|----------|
| `global_items` | `POST /api/items` (create) + `GET /api/items` (read) | **PASS** (logic) | Tests verify item creation with code generation; read back matches persisted values. |
| `business_partners` | GST verify + save | **PASS** (logic, BLOCKED without key) | `POST /api/gst/verify` maps provider response and persists to `gst_verifications`; `saveGstVerification` works when MySQL reachable. |
| `users` | No auth endpoint | **BLOCKED** | No backend; `users` table 0 rows; cannot test create/read/write. |
| `audit_logs` | No dedicated API (populated by app logic) | **NOT TESTED** | No API route to create read audit logs; populating by app-side logic only. |

### 4.3 Restart Persistence

- Verified that records created via API persist across application restart when MySQL is running.
- Empty tables (`branch_item_availability`, `custom_specifications`) remain empty after restart — no auto-seed observed.
- `system_settings` single row persists across restart.

### 4.4 Duplicate and Unauthorized Write Tests

- Duplicate `item_code` in `global_items`: MySQL unique constraint on `item_code` not observed in schema; app-level checks exist in code generation (`generates exact Raw Material code matching specification` test passes).
- Unauthorized write to `users`: Not testable — no API endpoint; `users` table 0 rows.
- Duplicate `gstin` in `business_partners`: Not testable without auth; `gst_verifications` has `gstin` as PK, so duplicate insertion would fail at DB level.

### 4.5 Transaction Failure and Rollback

- Not explicitly tested in this audit. MySQL connection refused errors in GST routes tests are handled honestly (test passes by reporting failure, not fabricating success). No `ROLLBACK` behavior verified.

### 4.6 Migration Compatibility

- Applied `001`–`005` migrations to clean database: all succeeded.
- `004` and `005` (GST verifications and filing history) **SQL files exist** in `server/src/migrations/` but **are not in `schema_migrations` history**. Applying them manually would add the tables but would not record the version in the history unless manually inserted.
- **Recommendation:** Either (a) apply `004`/`005` manually and insert `schema_migrations` entries, or (b) reconcile the drift by documenting that `004`/`005` exist as migration scripts but were not recorded in the applied history (perhaps applied and rolled back, or applied to a different environment).

---

## 5. Backup and Restore

- No backup tooling or restoration procedures discovered in the repository.
- No `mysqldump` scripts, `pg_dump` equivalents, or cloud backup references found.
- **Recommendation:** If production backup is required, configure MySQL native backup (`mysqldump`, `mysqlbackup`, or cloud provider tools). Do not attempt backup/restore tests without tooling and permissions.

---

## 6. Database Audit Summary

| Category | Status | Evidence |
|----------|--------|----------|
| Migration drift | **FAIL** | DB references 004–009; repo has 001–005; GST tables exist as SQL but not recorded |
| `business_partners`.`gst_status` | **FAIL** | 12 rows `VERIFIED` without provider evidence; requires downgrade migration |
| `users` table | **BLOCKED** | 0 rows; no backend auth possible |
| `branch_item_availability`, `custom_specifications` | **NOT TESTED** | 0 rows; no observed workflow |
| `audit_logs` outcome default | **NOT TESTED** | Default `SUCCESS` may mask failures |
| `system_settings` | **PASS** | 1 row present; further inspection needed for sensitive data |
| `global_items` | **PASS** | 12 rows; test data; persistence verified |
| `audit_logs` | **PASS** | 54 rows; structured correlation data |
| `item_approval_history` | **PASS** | 22 rows; approval transitions |
| `gst_verifications` / `gst_filing_history` tables | **BLOCKED** | Migration files exist (004, 005) but not applied to live DB; no provider data persisted |
| Backup/restore | **NOT APPLICABLE** | No tooling or procedures in repo |

**Overall Database Status: FAIL / BLOCKED** — Migration drift and VERIFIED-Without-Evidence records are critical data integrity issues. GST tables not applied. No real auth possible (users table empty).