-- Migration 006: Financial Year Management, Accounting Periods, FY Numbering Series & Workday Calendar Engine
-- Scope Revision Guarantee: Shift Management is 100% excluded (NO shift tables, columns, or placeholders).

CREATE TABLE IF NOT EXISTS fiscal_calendars (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  calendar_type VARCHAR(32) NOT NULL CHECK (calendar_type IN ('APRIL_MARCH', 'JANUARY_DECEMBER', 'JULY_JUNE', 'CUSTOM')),
  start_month SMALLINT NOT NULL CHECK (start_month BETWEEN 1 AND 12),
  start_day SMALLINT NOT NULL CHECK (start_day BETWEEN 1 AND 31),
  default_period_frequency VARCHAR(24) NOT NULL CHECK (default_period_frequency IN ('MONTHLY', 'QUARTERLY', 'CUSTOM')),
  allow_adjustment_periods BOOLEAN NOT NULL DEFAULT TRUE,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_years (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  company_code VARCHAR(64) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  financial_year_code VARCHAR(32) NOT NULL,
  financial_year_name VARCHAR(255) NOT NULL,
  fiscal_calendar_id VARCHAR(64) NOT NULL REFERENCES fiscal_calendars(id),
  fiscal_calendar_type VARCHAR(32) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  period_frequency VARCHAR(24) NOT NULL,
  number_of_periods INT NOT NULL,
  include_adjustment_period BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(24) NOT NULL CHECK (status IN ('FUTURE', 'ACTIVE', 'CLOSING', 'CLOSED', 'ARCHIVED')),
  description TEXT,
  version INT NOT NULL DEFAULT 1,
  is_default_active_for_company BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by VARCHAR(120),
  approved_at TIMESTAMPTZ,
  closed_by VARCHAR(120),
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_fy_dates CHECK (start_date < end_date),
  CONSTRAINT uq_company_fy_code UNIQUE (company_id, financial_year_code)
);

CREATE TABLE IF NOT EXISTS accounting_periods (
  id VARCHAR(64) PRIMARY KEY,
  financial_year_id VARCHAR(64) NOT NULL REFERENCES financial_years(id),
  financial_year_code VARCHAR(32) NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  period_number INT NOT NULL,
  period_code VARCHAR(32) NOT NULL,
  period_name VARCHAR(120) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_adjustment_period BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(24) NOT NULL CHECK (status IN ('FUTURE', 'OPEN', 'TEMPORARILY_LOCKED', 'CLOSING', 'CLOSED')),
  version INT NOT NULL DEFAULT 1,
  opened_by VARCHAR(120),
  opened_at TIMESTAMPTZ,
  locked_by VARCHAR(120),
  locked_at TIMESTAMPTZ,
  lock_reason TEXT,
  reopened_by VARCHAR(120),
  reopened_at TIMESTAMPTZ,
  reopen_approval_ref VARCHAR(120),
  closed_by VARCHAR(120),
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fy_period_code UNIQUE (financial_year_id, period_code)
);

CREATE TABLE IF NOT EXISTS numbering_series_configs (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'ALL',
  document_type VARCHAR(32) NOT NULL,
  series_code VARCHAR(64) NOT NULL,
  prefix VARCHAR(32) NOT NULL,
  include_company_code BOOLEAN NOT NULL DEFAULT FALSE,
  include_branch_code BOOLEAN NOT NULL DEFAULT TRUE,
  include_fy_code BOOLEAN NOT NULL DEFAULT TRUE,
  separator VARCHAR(8) NOT NULL DEFAULT '-',
  running_number_length INT NOT NULL DEFAULT 4,
  reset_frequency VARCHAR(32) NOT NULL CHECK (reset_frequency IN ('FY_RESET', 'CALENDAR_YEAR_RESET', 'MONTHLY_RESET', 'CONTINUOUS')),
  allocation_event VARCHAR(24) NOT NULL CHECK (allocation_event IN ('ON_DRAFT', 'ON_SUBMISSION')),
  sequence_state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  effective_from DATE NOT NULL,
  effective_until DATE,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  updated_by VARCHAR(120) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS year_end_closings (
  id VARCHAR(64) PRIMARY KEY,
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  source_financial_year_id VARCHAR(64) NOT NULL REFERENCES financial_years(id),
  target_financial_year_id VARCHAR(64) NOT NULL REFERENCES financial_years(id),
  status VARCHAR(32) NOT NULL CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'COMPLETED')),
  checklist_json JSONB NOT NULL,
  transition_summary_json JSONB NOT NULL,
  initiated_by VARCHAR(120) NOT NULL,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by VARCHAR(120),
  approved_at TIMESTAMPTZ,
  audit_evidence_ref VARCHAR(120) NOT NULL
);

-- Workday Calendar Engine Modules (Holiday, Weekly Off, Workday Calendar) — ZERO SHIFT MANAGEMENT
CREATE TABLE IF NOT EXISTS holiday_masters (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  holiday_code VARCHAR(64) NOT NULL,
  holiday_name VARCHAR(255) NOT NULL,
  holiday_type VARCHAR(32) NOT NULL,
  duration_type VARCHAR(24) NOT NULL CHECK (duration_type IN ('FULL_DAY', 'HALF_DAY_FIRST', 'HALF_DAY_SECOND')),
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_month SMALLINT,
  recurring_day SMALLINT,
  fixed_date DATE,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  created_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS holiday_calendars (
  id VARCHAR(64) PRIMARY KEY,
  calendar_code VARCHAR(64) NOT NULL,
  calendar_name VARCHAR(255) NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64),
  plant_id VARCHAR(64),
  workforce_category VARCHAR(64) DEFAULT 'ALL',
  financial_year_id VARCHAR(64) NOT NULL REFERENCES financial_years(id),
  financial_year_code VARCHAR(32) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  approval_status VARCHAR(24) NOT NULL CHECK (approval_status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
  approved_by VARCHAR(120),
  approved_at TIMESTAMPTZ,
  created_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS holiday_calendar_entries (
  id VARCHAR(64) PRIMARY KEY,
  holiday_calendar_id VARCHAR(64) NOT NULL REFERENCES holiday_calendars(id) ON DELETE CASCADE,
  holiday_master_id VARCHAR(64) REFERENCES holiday_masters(id),
  holiday_date DATE NOT NULL,
  holiday_name VARCHAR(255) NOT NULL,
  holiday_type VARCHAR(32) NOT NULL,
  duration_type VARCHAR(24) NOT NULL,
  optional_holiday BOOLEAN NOT NULL DEFAULT FALSE,
  restricted_holiday BOOLEAN NOT NULL DEFAULT FALSE,
  override_from_company BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS weekly_off_patterns (
  id VARCHAR(64) PRIMARY KEY,
  pattern_code VARCHAR(64) NOT NULL,
  pattern_name VARCHAR(255) NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'ALL',
  department VARCHAR(64) NOT NULL DEFAULT 'ALL',
  workforce_category VARCHAR(64) NOT NULL DEFAULT 'ALL',
  financial_year_id VARCHAR(64) REFERENCES financial_years(id),
  rule_type VARCHAR(48) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  config_json JSONB NOT NULL,
  created_by VARCHAR(120) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workday_calendars (
  id VARCHAR(64) PRIMARY KEY,
  calendar_code VARCHAR(64) NOT NULL,
  calendar_name VARCHAR(255) NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  financial_year_id VARCHAR(64) NOT NULL REFERENCES financial_years(id),
  financial_year_code VARCHAR(32) NOT NULL,
  holiday_calendar_id VARCHAR(64) REFERENCES holiday_calendars(id),
  weekly_off_pattern_id VARCHAR(64) REFERENCES weekly_off_patterns(id),
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS workday_calendar_entries (
  id VARCHAR(64) PRIMARY KEY,
  workday_calendar_id VARCHAR(64) NOT NULL REFERENCES workday_calendars(id) ON DELETE CASCADE,
  calendar_date DATE NOT NULL,
  day_classification VARCHAR(32) NOT NULL,
  is_working_day BOOLEAN NOT NULL,
  is_half_day BOOLEAN NOT NULL DEFAULT FALSE,
  work_weight NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  holiday_name VARCHAR(255),
  weekly_off_reason VARCHAR(255),
  exception_reason VARCHAR(255),
  CONSTRAINT uq_wdcal_date UNIQUE (workday_calendar_id, calendar_date)
);

CREATE TABLE IF NOT EXISTS calendar_exceptions (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  financial_year_id VARCHAR(64) NOT NULL REFERENCES financial_years(id),
  exception_date DATE NOT NULL,
  exception_type VARCHAR(48) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(24) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by VARCHAR(120) NOT NULL,
  approved_by VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compensatory_offs (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  financial_year_id VARCHAR(64) NOT NULL REFERENCES financial_years(id),
  employee_id VARCHAR(64) NOT NULL,
  employee_name VARCHAR(120) NOT NULL,
  worked_non_working_date DATE NOT NULL,
  comp_off_credit_days NUMERIC(3,1) NOT NULL,
  expiry_date DATE NOT NULL,
  status VARCHAR(24) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'CONSUMED', 'EXPIRED')),
  requested_by VARCHAR(120) NOT NULL,
  approved_by VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Financial Year & Accounting Posting Date Indexes on Core Transaction Tables
ALTER TABLE IF EXISTS purchase_requisitions
  ADD COLUMN IF NOT EXISTS financial_year_id VARCHAR(64) REFERENCES financial_years(id),
  ADD COLUMN IF NOT EXISTS financial_year_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS accounting_period_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS accounting_period_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS accounting_posting_date DATE,
  ADD COLUMN IF NOT EXISTS fy_snapshot_json JSONB;

ALTER TABLE IF EXISTS purchase_orders
  ADD COLUMN IF NOT EXISTS financial_year_id VARCHAR(64) REFERENCES financial_years(id),
  ADD COLUMN IF NOT EXISTS financial_year_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS accounting_period_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS accounting_period_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS accounting_posting_date DATE,
  ADD COLUMN IF NOT EXISTS fy_snapshot_json JSONB;

ALTER TABLE IF EXISTS goods_receipts
  ADD COLUMN IF NOT EXISTS financial_year_id VARCHAR(64) REFERENCES financial_years(id),
  ADD COLUMN IF NOT EXISTS financial_year_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS accounting_period_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS accounting_period_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS accounting_posting_date DATE,
  ADD COLUMN IF NOT EXISTS fy_snapshot_json JSONB;

ALTER TABLE IF EXISTS supplier_invoices
  ADD COLUMN IF NOT EXISTS financial_year_id VARCHAR(64) REFERENCES financial_years(id),
  ADD COLUMN IF NOT EXISTS financial_year_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS accounting_period_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS accounting_period_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS accounting_posting_date DATE,
  ADD COLUMN IF NOT EXISTS fy_snapshot_json JSONB;

CREATE INDEX IF NOT EXISTS idx_pr_company_fy ON purchase_requisitions(company_id, financial_year_id);
CREATE INDEX IF NOT EXISTS idx_po_company_fy ON purchase_orders(company_id, financial_year_id, accounting_posting_date);
CREATE INDEX IF NOT EXISTS idx_grn_company_fy ON goods_receipts(company_id, financial_year_id, accounting_posting_date);
CREATE INDEX IF NOT EXISTS idx_sinv_company_fy ON supplier_invoices(company_id, financial_year_id, accounting_posting_date);
