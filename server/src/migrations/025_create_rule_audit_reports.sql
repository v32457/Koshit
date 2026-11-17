CREATE TABLE IF NOT EXISTS rule_audit_reports (
  audit_id VARCHAR(64) PRIMARY KEY,
  entity_id VARCHAR(64) NOT NULL,
  audit_type ENUM('GLOBAL_ITEM_CREATION', 'BRANCH_ITEM_ACTIVATION') NOT NULL,
  rule_version INT NOT NULL DEFAULT 1,
  overall_result ENUM('PASS', 'WARNING', 'ERROR', 'BLOCKED') NOT NULL,
  checkpoints_json JSON NOT NULL,
  errors_json JSON NULL,
  warnings_json JSON NULL,
  evaluated_by VARCHAR(150) NOT NULL,
  evaluated_by_user_id VARCHAR(64) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rule_audit_entity (entity_id, audit_type, overall_result)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
