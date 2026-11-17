-- Migration 008: KOSH Innovations Enterprise Zero-Trust Visual Data Protection & Leakage Prevention Engine
-- Reuses existing master tables (users, companies, branches, module_registry, audit_logs) via referenced IDs.
-- Creates the 18 Zero-Trust Security Governance entities with PKs, FKs, Unique Constraints, Indexes, and Tenant Isolation.

CREATE TABLE IF NOT EXISTS zt_security_policy_definitions (
  id VARCHAR(64) PRIMARY KEY,
  scope_level ENUM('GLOBAL', 'COMPANY', 'BRANCH', 'MODULE', 'PAGE', 'USER') NOT NULL,
  scope_ref_id VARCHAR(128) NOT NULL,
  scope_label VARCHAR(255) NOT NULL,
  company_id VARCHAR(64) NULL,
  branch_id VARCHAR(64) NULL,
  module_key VARCHAR(64) NULL,
  page_key VARCHAR(128) NULL,
  user_id VARCHAR(64) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INT NOT NULL DEFAULT 1,
  controls_json JSON NOT NULL,
  parameters_json JSON NOT NULL,
  change_reason VARCHAR(500) NOT NULL,
  updated_by_id VARCHAR(64) NOT NULL,
  updated_by_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_zt_scope_ref (scope_level, scope_ref_id),
  INDEX idx_zt_scope_company_branch (company_id, branch_id, module_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_company_policy_configs (
  id VARCHAR(64) PRIMARY KEY,
  policy_definition_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_zt_company_policy (company_id),
  CONSTRAINT fk_zt_company_pol_def FOREIGN KEY (policy_definition_id) REFERENCES zt_security_policy_definitions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_branch_policy_configs (
  id VARCHAR(64) PRIMARY KEY,
  policy_definition_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_zt_branch_policy (company_id, branch_id),
  CONSTRAINT fk_zt_branch_pol_def FOREIGN KEY (policy_definition_id) REFERENCES zt_security_policy_definitions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_module_policy_configs (
  id VARCHAR(64) PRIMARY KEY,
  policy_definition_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  module_key VARCHAR(64) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_zt_module_policy (module_key),
  CONSTRAINT fk_zt_module_pol_def FOREIGN KEY (policy_definition_id) REFERENCES zt_security_policy_definitions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_optional_scope_settings (
  id VARCHAR(32) PRIMARY KEY,
  page_level_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  user_level_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by VARCHAR(120) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_optional_page_policy_configs (
  id VARCHAR(64) PRIMARY KEY,
  policy_definition_id VARCHAR(64) NOT NULL,
  module_key VARCHAR(64) NOT NULL,
  page_key VARCHAR(128) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_zt_page_policy (page_key),
  CONSTRAINT fk_zt_page_pol_def FOREIGN KEY (policy_definition_id) REFERENCES zt_security_policy_definitions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_optional_user_policy_configs (
  id VARCHAR(64) PRIMARY KEY,
  policy_definition_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_zt_user_policy (user_id),
  CONSTRAINT fk_zt_user_pol_def FOREIGN KEY (policy_definition_id) REFERENCES zt_security_policy_definitions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_security_policy_versions (
  id VARCHAR(64) PRIMARY KEY,
  version_number INT NOT NULL,
  scope_level ENUM('GLOBAL', 'COMPANY', 'BRANCH', 'MODULE', 'PAGE', 'USER') NOT NULL,
  scope_ref_id VARCHAR(128) NOT NULL,
  scope_label VARCHAR(255) NOT NULL,
  changed_by_id VARCHAR(64) NOT NULL,
  changed_by_name VARCHAR(120) NOT NULL,
  change_reason VARCHAR(500) NOT NULL,
  previous_controls_json JSON NULL,
  new_controls_json JSON NOT NULL,
  previous_parameters_json JSON NULL,
  new_parameters_json JSON NOT NULL,
  triggers_revalidation BOOLEAN NOT NULL DEFAULT FALSE,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_zt_ver_scope (scope_level, scope_ref_id, version_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_policy_exceptions (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NULL,
  module_key VARCHAR(64) NULL,
  page_key VARCHAR(128) NULL,
  target_user_id VARCHAR(64) NULL,
  scope_level ENUM('GLOBAL', 'COMPANY', 'BRANCH', 'MODULE', 'PAGE', 'USER') NOT NULL,
  scope_ref_id VARCHAR(128) NOT NULL,
  control_key VARCHAR(64) NOT NULL,
  requested_by_user_id VARCHAR(64) NOT NULL,
  requested_by_name VARCHAR(120) NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'PENDING',
  start_date TIMESTAMP NOT NULL,
  expiry_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_zt_exc_lookup (company_id, control_key, status, expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_exception_approvals (
  id VARCHAR(64) PRIMARY KEY,
  exception_id VARCHAR(64) NOT NULL,
  approver_user_id VARCHAR(64) NOT NULL,
  approver_name VARCHAR(120) NOT NULL,
  decision ENUM('APPROVED', 'REJECTED', 'REVOKED') NOT NULL,
  decision_notes TEXT NOT NULL,
  decided_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_zt_exc_app FOREIGN KEY (exception_id) REFERENCES zt_policy_exceptions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_effective_policy_evaluations (
  id VARCHAR(64) PRIMARY KEY,
  cache_key VARCHAR(255) NOT NULL,
  cache_version INT NOT NULL,
  policy_version INT NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  module_key VARCHAR(64) NOT NULL,
  page_key VARCHAR(128) NULL,
  effective_controls_json JSON NOT NULL,
  evaluated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_zt_eval_ctx (company_id, branch_id, module_key, user_id, evaluated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_security_events (
  id VARCHAR(64) PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  severity ENUM('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  user_name VARCHAR(120) NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  module_key VARCHAR(64) NOT NULL,
  page_key VARCHAR(128) NULL,
  session_id VARCHAR(128) NOT NULL,
  policy_version INT NOT NULL,
  detection_source VARCHAR(48) NOT NULL,
  action_taken VARCHAR(255) NOT NULL,
  resolution_status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  summary TEXT NOT NULL,
  metadata_json JSON NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_zt_evt_tenant_time (company_id, branch_id, severity, occurred_at),
  INDEX idx_zt_evt_user (user_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_security_incidents (
  id VARCHAR(64) PRIMARY KEY,
  incident_number VARCHAR(40) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(48) NOT NULL,
  severity ENUM('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
  status ENUM('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  module_key VARCHAR(64) NOT NULL,
  page_key VARCHAR(128) NULL,
  affected_user_id VARCHAR(64) NOT NULL,
  affected_user_name VARCHAR(120) NOT NULL,
  assigned_to_user_id VARCHAR(64) NULL,
  assigned_to_name VARCHAR(120) NULL,
  linked_event_ids_json JSON NOT NULL,
  policy_version INT NOT NULL,
  resolution_summary TEXT NULL,
  audit_history_json JSON NOT NULL,
  acknowledged_at TIMESTAMP NULL,
  resolved_at TIMESTAMP NULL,
  closed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_zt_inc_status (company_id, status, severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_session_protection_states (
  session_id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  user_name VARCHAR(120) NOT NULL,
  user_role VARCHAR(48) NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  module_key VARCHAR(64) NOT NULL,
  page_key VARCHAR(128) NULL,
  browser_family VARCHAR(48) NOT NULL,
  browser_version VARCHAR(32) NOT NULL,
  browser_compliant BOOLEAN NOT NULL,
  secure_context BOOLEAN NOT NULL,
  protection_status ENUM('PROTECTED', 'WARNING', 'BLACKOUT_LOCKED', 'SUSPENDED', 'TERMINATED') NOT NULL DEFAULT 'PROTECTED',
  blackout_active BOOLEAN NOT NULL DEFAULT FALSE,
  blackout_reason VARCHAR(500) NULL,
  blackout_triggered_at TIMESTAMP NULL,
  blackout_until TIMESTAMP NULL,
  incident_ref VARCHAR(64) NULL,
  watermark_session_ref VARCHAR(64) NOT NULL,
  webcam_monitoring_active BOOLEAN NOT NULL DEFAULT FALSE,
  webcam_backend VARCHAR(32) NULL,
  policy_version INT NOT NULL DEFAULT 1,
  last_heartbeat_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_zt_sess_user (user_id, protection_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_browser_compliance_logs (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  browser_family VARCHAR(48) NOT NULL,
  browser_version VARCHAR(32) NOT NULL,
  is_approved_family BOOLEAN NOT NULL,
  is_secure_context BOOLEAN NOT NULL,
  capabilities_json JSON NOT NULL,
  compliant BOOLEAN NOT NULL,
  decision VARCHAR(32) NOT NULL,
  evaluated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_zt_browser_sess (session_id, evaluated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_software_registry (
  id VARCHAR(64) PRIMARY KEY,
  component_name VARCHAR(160) NOT NULL,
  category VARCHAR(48) NOT NULL,
  version VARCHAR(48) NOT NULL,
  official_source VARCHAR(500) NOT NULL,
  download_source VARCHAR(500) NOT NULL,
  license VARCHAR(64) NOT NULL,
  commercial_use_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  integrity_verification VARCHAR(255) NOT NULL,
  sha256_digest VARCHAR(128) NULL,
  installation_status VARCHAR(32) NOT NULL,
  integration_status VARCHAR(32) NOT NULL,
  configuration_status VARCHAR(32) NOT NULL,
  test_status VARCHAR(32) NOT NULL,
  vulnerability_status VARCHAR(32) NOT NULL,
  last_verified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_ai_model_registry (
  id VARCHAR(64) PRIMARY KEY,
  model_name VARCHAR(160) NOT NULL,
  version VARCHAR(48) NOT NULL,
  official_source VARCHAR(500) NOT NULL,
  local_artifact_path VARCHAR(255) NOT NULL,
  license VARCHAR(64) NOT NULL,
  commercial_use_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  sha256_digest VARCHAR(128) NOT NULL,
  installation_status VARCHAR(32) NOT NULL,
  integration_status VARCHAR(32) NOT NULL,
  test_status VARCHAR(32) NOT NULL,
  last_verified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_deployment_health_checks (
  id VARCHAR(64) PRIMARY KEY,
  check_name VARCHAR(120) NOT NULL,
  component_group VARCHAR(64) NOT NULL,
  status ENUM('HEALTHY', 'DEGRADED', 'FAILED') NOT NULL,
  latency_ms INT NOT NULL DEFAULT 0,
  details TEXT NULL,
  checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zt_security_admin_audit_history (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  actor_user_id VARCHAR(64) NOT NULL,
  actor_name VARCHAR(120) NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  target_entity_type VARCHAR(48) NOT NULL,
  target_entity_id VARCHAR(128) NOT NULL,
  previous_value_json JSON NULL,
  new_value_json JSON NOT NULL,
  change_reason VARCHAR(500) NOT NULL,
  policy_version INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_zt_admin_aud_time (company_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
