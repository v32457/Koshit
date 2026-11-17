CREATE TABLE IF NOT EXISTS branch_item_revisions (
  revision_id VARCHAR(64) PRIMARY KEY,
  branch_availability_id VARCHAR(64) NOT NULL,
  revision_number VARCHAR(32) NOT NULL,
  revision_description VARCHAR(500) NOT NULL,
  technical_change_ref VARCHAR(120) NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  change_reason VARCHAR(500) NOT NULL,
  approved_by VARCHAR(150) NULL,
  approval_status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_branch_rev_avail FOREIGN KEY (branch_availability_id) REFERENCES branch_item_availability(branch_availability_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
