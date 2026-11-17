CREATE TABLE IF NOT EXISTS branch_item_alternatives (
  alternative_id VARCHAR(64) PRIMARY KEY,
  branch_availability_id VARCHAR(64) NOT NULL,
  global_item_id BIGINT UNSIGNED NOT NULL,
  alternative_global_item_id BIGINT UNSIGNED NOT NULL,
  relationship_type ENUM('ALTERNATIVE', 'SUBSTITUTE', 'EQUIVALENT') NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  reason VARCHAR(500) NOT NULL,
  approval_status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  UNIQUE KEY uq_branch_alt_rel (branch_availability_id, alternative_global_item_id, relationship_type),
  CONSTRAINT fk_branch_alt_avail FOREIGN KEY (branch_availability_id) REFERENCES branch_item_availability(branch_availability_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
