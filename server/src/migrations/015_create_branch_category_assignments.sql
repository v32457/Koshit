CREATE TABLE IF NOT EXISTS branch_category_assignments (
  assignment_id VARCHAR(64) PRIMARY KEY,
  branch_availability_id VARCHAR(64) NOT NULL,
  global_item_id BIGINT UNSIGNED NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  category_code VARCHAR(16) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  active_slot TINYINT GENERATED ALWAYS AS (IF(is_active = TRUE, 1, NULL)) VIRTUAL,
  assigned_by VARCHAR(150) NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_one_active_category_per_branch_item (global_item_id, company_id, branch_id, active_slot),
  CONSTRAINT fk_branch_cat_avail FOREIGN KEY (branch_availability_id) REFERENCES branch_item_availability(branch_availability_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
