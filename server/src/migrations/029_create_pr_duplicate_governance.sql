CREATE TABLE IF NOT EXISTS pr_duplicate_governance_records (
  draft_key VARCHAR(128) NOT NULL,
  pr_id VARCHAR(128) NULL,
  pr_number VARCHAR(64) NULL,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  conditions_json LONGTEXT NOT NULL,
  audit_history_json LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (draft_key),
  INDEX idx_pr_dup_gov_pr_id (pr_id),
  INDEX idx_pr_dup_gov_company_branch (company_id, branch_id)
);
