CREATE TABLE IF NOT EXISTS branch_item_attachments (
  attachment_id VARCHAR(64) PRIMARY KEY,
  branch_availability_id VARCHAR(64) NOT NULL,
  document_type VARCHAR(64) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_reference VARCHAR(500) NOT NULL,
  description VARCHAR(500) NULL,
  document_version VARCHAR(32) NOT NULL,
  uploaded_by VARCHAR(150) NOT NULL,
  uploaded_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effective_date DATE NULL,
  expiry_date DATE NULL,
  approval_status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_branch_att_avail FOREIGN KEY (branch_availability_id) REFERENCES branch_item_availability(branch_availability_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
