CREATE TABLE IF NOT EXISTS branch_warehouse_planning (
  planning_id VARCHAR(64) PRIMARY KEY,
  branch_availability_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  warehouse_id VARCHAR(64) NOT NULL,
  warehouse_code VARCHAR(32) NOT NULL,
  warehouse_name VARCHAR(150) NOT NULL,
  is_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
  storage_location VARCHAR(100) NULL,
  safety_stock DECIMAL(18,4) NULL,
  reorder_level DECIMAL(18,4) NULL,
  maximum_stock DECIMAL(18,4) NULL,
  replenishment_method ENUM('MIN_MAX', 'REORDER_POINT', 'MRP', 'ON_DEMAND') NULL,
  procurement_lead_time_days INT NULL,
  UNIQUE KEY uq_branch_wh_planning (branch_availability_id, warehouse_id),
  CONSTRAINT fk_branch_wh_avail FOREIGN KEY (branch_availability_id) REFERENCES branch_item_availability(branch_availability_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
