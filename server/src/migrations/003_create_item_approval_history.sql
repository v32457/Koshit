CREATE TABLE item_approval_history (
  approval_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(20) NOT NULL,
  action_by VARCHAR(150) NOT NULL,
  comments TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (approval_id),
  KEY ix_approval_history_item_time (item_id, created_at),
  CONSTRAINT fk_approval_history_global_item
    FOREIGN KEY (item_id)
    REFERENCES global_items (item_id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci