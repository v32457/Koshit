CREATE TABLE IF NOT EXISTS global_item_attachments (
  attachment_id VARCHAR(64) PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  document_type VARCHAR(64) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_reference VARCHAR(500) NOT NULL,
  description VARCHAR(500) NULL,
  document_version VARCHAR(32) NOT NULL,
  uploaded_by VARCHAR(150) NOT NULL,
  uploaded_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effective_date DATE NULL,
  expiry_date DATE NULL,
  approval_status VARCHAR(24) NOT NULL DEFAULT 'APPROVED',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_global_att_item FOREIGN KEY (item_id) REFERENCES global_items(item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
