CREATE TABLE IF NOT EXISTS branch_item_barcodes (
  barcode_id VARCHAR(64) PRIMARY KEY,
  branch_availability_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  barcode_value VARCHAR(128) NOT NULL,
  barcode_type ENUM('EAN13', 'UPC', 'CODE128', 'QR', 'GTIN14') NOT NULL,
  gtin VARCHAR(32) NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  is_intentionally_shared BOOLEAN NOT NULL DEFAULT FALSE,
  shared_justification VARCHAR(500) NULL,
  KEY idx_branch_barcode_lookup (company_id, branch_id, barcode_value, status),
  CONSTRAINT fk_branch_bc_avail FOREIGN KEY (branch_availability_id) REFERENCES branch_item_availability(branch_availability_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
