CREATE TABLE global_items (
  item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_code VARCHAR(64) NOT NULL,
  item_description VARCHAR(500) NOT NULL,
  category_code CHAR(2) NULL,
  type_code CHAR(2) NULL,
  material_form_code CHAR(2) NULL,
  process_code CHAR(2) NULL,
  material_code CHAR(2) NULL,
  colour_code CHAR(2) NULL,
  grade VARCHAR(100) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id),
  UNIQUE KEY uq_global_items_item_code (item_code),
  KEY ix_global_items_status (status),
  KEY ix_global_items_category_type (category_code, type_code),
  KEY ix_global_items_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci