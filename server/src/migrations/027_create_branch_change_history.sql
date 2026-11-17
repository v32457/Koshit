CREATE TABLE IF NOT EXISTS branch_change_history (
  history_id VARCHAR(64) PRIMARY KEY,
  entity_id VARCHAR(64) NOT NULL,
  global_item_id BIGINT UNSIGNED NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  field_attribute VARCHAR(120) NOT NULL,
  previous_value TEXT NULL,
  new_value TEXT NULL,
  changed_by VARCHAR(150) NOT NULL,
  changed_by_user_id VARCHAR(64) NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  change_reason VARCHAR(500) NOT NULL,
  approval_reference VARCHAR(120) NULL,
  applicable_rule_version INT NULL,
  related_request_ref VARCHAR(120) NULL,
  KEY idx_branch_hist_entity (entity_id, company_id, branch_id, field_attribute, changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
