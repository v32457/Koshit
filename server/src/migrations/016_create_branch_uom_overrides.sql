CREATE TABLE IF NOT EXISTS branch_uom_overrides (
  override_id VARCHAR(64) PRIMARY KEY,
  branch_availability_id VARCHAR(64) NOT NULL,
  branch_purchase_uom VARCHAR(16) NOT NULL,
  branch_inventory_uom VARCHAR(16) NOT NULL,
  conversion_numerator DECIMAL(18,6) NOT NULL,
  conversion_denominator DECIMAL(18,6) NOT NULL,
  conversion_factor DECIMAL(18,6) NOT NULL,
  updated_by VARCHAR(150) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_branch_uom_override_avail (branch_availability_id),
  CONSTRAINT fk_branch_uom_avail FOREIGN KEY (branch_availability_id) REFERENCES branch_item_availability(branch_availability_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
