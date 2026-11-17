-- Migration 007: KOSH Innovations Centralized Charge Management Engine
-- Supports all 10 application levels, 12 calculation methods, configurable applicability rules,
-- transaction charges across PR/RFQ/PO/Shipment/Schedule/GRN/Invoice, deterministic allocations,
-- Domestic & Import statutory tax decomposition, approvals, reconciliation, calculation history, and audit log.

CREATE TABLE IF NOT EXISTS charge_application_levels (
  code VARCHAR(32) PRIMARY KEY,
  display_name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS charge_calculation_methods (
  code VARCHAR(32) PRIMARY KEY,
  display_name VARCHAR(120) NOT NULL,
  requires_formula BOOLEAN NOT NULL DEFAULT FALSE,
  description VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS charge_master (
  id VARCHAR(64) PRIMARY KEY,
  charge_code VARCHAR(64) NOT NULL,
  charge_name VARCHAR(255) NOT NULL,
  charge_description TEXT,
  charge_category VARCHAR(32) NOT NULL,
  default_application_level VARCHAR(32) NOT NULL REFERENCES charge_application_levels(code),
  permitted_application_levels JSON NOT NULL,
  default_calculation_method VARCHAR(32) NOT NULL REFERENCES charge_calculation_methods(code),
  default_calculation_basis VARCHAR(48) NOT NULL,
  default_rate DECIMAL(18, 4) NOT NULL DEFAULT 0,
  default_formula_expression VARCHAR(500),
  applicability_rule VARCHAR(24) NOT NULL,
  default_currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  default_tax_mapping_id VARCHAR(64) NOT NULL,
  default_tax_treatment VARCHAR(48) NOT NULL,
  default_allocation_basis VARCHAR(48) NOT NULL,
  charge_bearer VARCHAR(32) NOT NULL DEFAULT 'BUYER',
  recoverability VARCHAR(32) NOT NULL DEFAULT 'RECOVERABLE_INPUT_CREDIT',
  minimum_charge DECIMAL(18, 4),
  maximum_charge DECIMAL(18, 4),
  rounding_rule VARCHAR(16) NOT NULL DEFAULT 'HALF_UP',
  decimal_precision SMALLINT NOT NULL DEFAULT 2,
  calculation_sequence INT NOT NULL DEFAULT 10,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version_number INT NOT NULL DEFAULT 1,
  created_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modified_by VARCHAR(120) NOT NULL,
  modified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_active_charge_code (charge_code, is_active)
);

CREATE TABLE IF NOT EXISTS company_branch_charge_mappings (
  id VARCHAR(64) PRIMARY KEY,
  version_number INT NOT NULL DEFAULT 1,
  company_id VARCHAR(64) NOT NULL,
  company_code VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'ALL',
  branch_code VARCHAR(64) NOT NULL DEFAULT 'ALL',
  charge_master_id VARCHAR(64) NOT NULL REFERENCES charge_master(id),
  charge_code VARCHAR(64) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  applicability VARCHAR(24) NOT NULL DEFAULT 'OPTIONAL',
  default_calculation_method VARCHAR(32) NOT NULL REFERENCES charge_calculation_methods(code),
  calculation_basis VARCHAR(48) NOT NULL,
  fixed_tariff_or_rate DECIMAL(18, 4) NOT NULL DEFAULT 0,
  formula_expression VARCHAR(500),
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  tax_mapping_id VARCHAR(64) NOT NULL,
  tax_treatment VARCHAR(48) NOT NULL,
  tax_rate_percent DECIMAL(8, 4) NOT NULL DEFAULT 18,
  allocation_basis VARCHAR(48) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  allow_branch_override BOOLEAN NOT NULL DEFAULT TRUE,
  centrally_controlled_fields JSON NOT NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  is_branch_override BOOLEAN NOT NULL DEFAULT FALSE,
  inherited_from_mapping_id VARCHAR(64),
  remarks TEXT,
  created_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(120) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_company_branch_charge (company_id, branch_id, charge_master_id)
);

CREATE TABLE IF NOT EXISTS company_branch_charge_mapping_history (
  id VARCHAR(64) PRIMARY KEY,
  mapping_id VARCHAR(64) NOT NULL,
  version_number INT NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  charge_master_id VARCHAR(64) NOT NULL,
  action_type VARCHAR(40) NOT NULL,
  previous_snapshot_json JSON,
  new_snapshot_json JSON NOT NULL,
  changed_by_id VARCHAR(64) NOT NULL,
  changed_by_name VARCHAR(120) NOT NULL,
  reason TEXT NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS charge_rules (
  id VARCHAR(64) PRIMARY KEY,
  rule_code VARCHAR(64) UNIQUE NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  charge_master_id VARCHAR(64) NOT NULL REFERENCES charge_master(id),
  target_applicability VARCHAR(24) NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  logical_operator VARCHAR(8) NOT NULL DEFAULT 'AND',
  requires_conditional_confirm BOOLEAN NOT NULL DEFAULT FALSE,
  allow_mandatory_bypass_exception BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(120) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS charge_rule_conditions (
  id VARCHAR(64) PRIMARY KEY,
  rule_id VARCHAR(64) NOT NULL REFERENCES charge_rules(id) ON DELETE CASCADE,
  field_name VARCHAR(64) NOT NULL,
  operator_code VARCHAR(24) NOT NULL,
  condition_value VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS charge_rule_level_mapping (
  id VARCHAR(64) PRIMARY KEY,
  rule_id VARCHAR(64) NOT NULL REFERENCES charge_rules(id) ON DELETE CASCADE,
  application_level VARCHAR(32) NOT NULL REFERENCES charge_application_levels(code),
  UNIQUE KEY uq_rule_level (rule_id, application_level)
);

CREATE TABLE IF NOT EXISTS transaction_charge_items (
  id VARCHAR(64) PRIMARY KEY,
  idempotency_key VARCHAR(128) UNIQUE,
  charge_master_id VARCHAR(64) NOT NULL REFERENCES charge_master(id),
  charge_code VARCHAR(64) NOT NULL,
  charge_name VARCHAR(255) NOT NULL,
  charge_category VARCHAR(32) NOT NULL,
  procurement_type VARCHAR(16) NOT NULL DEFAULT 'DOMESTIC',
  source_document_type VARCHAR(32) NOT NULL,
  source_document_id VARCHAR(64) NOT NULL,
  source_document_number VARCHAR(64) NOT NULL,
  source_line_id VARCHAR(64),
  origin_pr_id VARCHAR(64),
  origin_pr_number VARCHAR(64),
  origin_rfq_id VARCHAR(64),
  origin_po_id VARCHAR(64),
  shipment_id VARCHAR(64),
  delivery_schedule_id VARCHAR(64),
  grn_id VARCHAR(64),
  transport_trip_id VARCHAR(64),
  invoice_id VARCHAR(64),
  application_level VARCHAR(32) NOT NULL REFERENCES charge_application_levels(code),
  applicability VARCHAR(24) NOT NULL,
  calculation_method VARCHAR(32) NOT NULL REFERENCES charge_calculation_methods(code),
  calculation_basis VARCHAR(48) NOT NULL,
  allocation_method VARCHAR(48) NOT NULL,
  rate DECIMAL(18, 4) NOT NULL DEFAULT 0,
  formula_expression VARCHAR(500),
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  lifecycle_stage VARCHAR(24) NOT NULL DEFAULT 'ESTIMATED',
  estimated_charge_amount DECIMAL(18, 4) NOT NULL DEFAULT 0,
  quoted_charge_amount DECIMAL(18, 4) NOT NULL DEFAULT 0,
  approved_charge_amount DECIMAL(18, 4) NOT NULL DEFAULT 0,
  actual_charge_amount DECIMAL(18, 4) NOT NULL DEFAULT 0,
  charge_amount DECIMAL(18, 4) NOT NULL DEFAULT 0,
  allocation_status VARCHAR(24) NOT NULL DEFAULT 'UNALLOCATED',
  allocated_amount DECIMAL(18, 4) NOT NULL DEFAULT 0,
  remaining_unallocated_amount DECIMAL(18, 4) NOT NULL DEFAULT 0,
  approval_status VARCHAR(24) NOT NULL DEFAULT 'NOT_REQUIRED',
  reconciliation_status VARCHAR(32) NOT NULL DEFAULT 'ESTIMATED_ONLY',
  is_soft_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_by VARCHAR(120),
  deleted_at TIMESTAMP NULL,
  created_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(120) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tx_charge_source (source_document_type, source_document_id, is_soft_deleted),
  INDEX idx_tx_charge_po (origin_po_id, application_level)
);

CREATE TABLE IF NOT EXISTS charge_allocations (
  id VARCHAR(64) PRIMARY KEY,
  transaction_charge_id VARCHAR(64) NOT NULL REFERENCES transaction_charge_items(id),
  version INT NOT NULL DEFAULT 1,
  allocation_method VARCHAR(48) NOT NULL,
  target_line_id VARCHAR(64) NOT NULL,
  target_item_code VARCHAR(64) NOT NULL,
  grn_id VARCHAR(64),
  shipment_id VARCHAR(64),
  delivery_schedule_id VARCHAR(64),
  allocation_weight_factor DECIMAL(18, 6) NOT NULL,
  allocated_charge_amount DECIMAL(18, 4) NOT NULL,
  allocated_tax_amount DECIMAL(18, 4) NOT NULL DEFAULT 0,
  allocated_recoverable_tax DECIMAL(18, 4) NOT NULL DEFAULT 0,
  allocated_non_recoverable_tax DECIMAL(18, 4) NOT NULL DEFAULT 0,
  allocated_landed_cost_contribution DECIMAL(18, 4) NOT NULL DEFAULT 0,
  is_manually_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  is_approved_override BOOLEAN NOT NULL DEFAULT FALSE,
  override_approved_by VARCHAR(120),
  allocated_by VARCHAR(120) NOT NULL,
  allocated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_alloc_tx (transaction_charge_id, version)
);

CREATE TABLE IF NOT EXISTS charge_tax_details (
  id VARCHAR(64) PRIMARY KEY,
  transaction_charge_id VARCHAR(64) NOT NULL REFERENCES transaction_charge_items(id),
  tax_mapping_id VARCHAR(64) NOT NULL,
  tax_code VARCHAR(64) NOT NULL,
  treatment_type VARCHAR(48) NOT NULL,
  charge_amount DECIMAL(18, 4) NOT NULL,
  taxable_base DECIMAL(18, 4) NOT NULL,
  tax_rate_percent DECIMAL(8, 4) NOT NULL,
  surcharge_percent DECIMAL(8, 4) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(18, 4) NOT NULL,
  surcharge_amount DECIMAL(18, 4) NOT NULL DEFAULT 0,
  recoverable_tax DECIMAL(18, 4) NOT NULL,
  non_recoverable_tax DECIMAL(18, 4) NOT NULL,
  landed_cost_contribution DECIMAL(18, 4) NOT NULL
);

CREATE TABLE IF NOT EXISTS charge_currency_details (
  id VARCHAR(64) PRIMARY KEY,
  transaction_charge_id VARCHAR(64) NOT NULL REFERENCES transaction_charge_items(id),
  source_currency VARCHAR(8) NOT NULL,
  target_reporting_currency VARCHAR(8) NOT NULL,
  exchange_rate DECIMAL(18, 6) NOT NULL,
  source_amount DECIMAL(18, 4) NOT NULL,
  reporting_amount DECIMAL(18, 4) NOT NULL,
  rate_effective_date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS charge_attachments (
  id VARCHAR(64) PRIMARY KEY,
  transaction_charge_id VARCHAR(64) NOT NULL REFERENCES transaction_charge_items(id),
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  document_type VARCHAR(32) NOT NULL,
  uploaded_by VARCHAR(120) NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS charge_approvals (
  id VARCHAR(64) PRIMARY KEY,
  transaction_charge_id VARCHAR(64) NOT NULL REFERENCES transaction_charge_items(id),
  approval_type VARCHAR(48) NOT NULL,
  requested_by VARCHAR(120) NOT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT NOT NULL,
  previous_value_json JSON,
  proposed_value_json JSON,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  decided_by VARCHAR(120),
  decided_at TIMESTAMP NULL,
  decision_remarks TEXT
);

CREATE TABLE IF NOT EXISTS charge_reconciliation (
  id VARCHAR(64) PRIMARY KEY,
  transaction_charge_id VARCHAR(64) NOT NULL REFERENCES transaction_charge_items(id),
  estimated_amount DECIMAL(18, 4) NOT NULL DEFAULT 0,
  quoted_amount DECIMAL(18, 4) NOT NULL DEFAULT 0,
  approved_amount DECIMAL(18, 4) NOT NULL DEFAULT 0,
  actual_amount DECIMAL(18, 4) NOT NULL DEFAULT 0,
  variance_approved_vs_actual DECIMAL(18, 4) NOT NULL DEFAULT 0,
  variance_percent DECIMAL(10, 4) NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL,
  reconciled_by VARCHAR(120),
  reconciled_at TIMESTAMP NULL,
  approval_ref VARCHAR(120)
);

CREATE TABLE IF NOT EXISTS charge_calculation_history (
  id VARCHAR(64) PRIMARY KEY,
  transaction_charge_id VARCHAR(64) NOT NULL REFERENCES transaction_charge_items(id),
  version INT NOT NULL,
  inputs_json JSON NOT NULL,
  raw_basis_value DECIMAL(18, 4) NOT NULL,
  raw_computed_amount DECIMAL(18, 4) NOT NULL,
  clamped_amount DECIMAL(18, 4) NOT NULL,
  converted_amount DECIMAL(18, 4) NOT NULL,
  total_with_tax DECIMAL(18, 4) NOT NULL,
  formula_audit_trace VARCHAR(500),
  calculated_by VARCHAR(120) NOT NULL,
  calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS charge_audit_log (
  id VARCHAR(64) PRIMARY KEY,
  transaction_charge_id VARCHAR(64) NOT NULL,
  source_document_type VARCHAR(32) NOT NULL,
  source_document_number VARCHAR(64) NOT NULL,
  action_type VARCHAR(48) NOT NULL,
  actor_id VARCHAR(64) NOT NULL,
  actor_name VARCHAR(120) NOT NULL,
  previous_value_json JSON,
  new_value_json JSON,
  reason TEXT NOT NULL,
  calculation_version INT,
  approval_reference VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_charge_audit_tx (transaction_charge_id, created_at)
);
