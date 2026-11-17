CREATE TABLE IF NOT EXISTS global_duplicate_detections (
  detection_id VARCHAR(64) PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  matched_item_id BIGINT UNSIGNED NOT NULL,
  similarity_score DECIMAL(5,2) NOT NULL,
  conflict_severity ENUM('HARD_CONFLICT', 'POTENTIAL_MATCH') NOT NULL,
  match_reason VARCHAR(500) NOT NULL,
  matched_dimensions_json JSON NOT NULL,
  checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dup_item FOREIGN KEY (item_id) REFERENCES global_items(item_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
