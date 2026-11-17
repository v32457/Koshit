ALTER TABLE global_items
  ADD COLUMN created_by_user_id VARCHAR(64) NOT NULL DEFAULT 'usr-buyer-01',
  ADD COLUMN created_by_name VARCHAR(150) NOT NULL DEFAULT 'Vikram Singh',
  ADD COLUMN submitted_by_user_id VARCHAR(64) NULL,
  ADD COLUMN submitted_at TIMESTAMP NULL,
  ADD COLUMN approved_by_user_id VARCHAR(64) NULL,
  ADD COLUMN approved_at TIMESTAMP NULL;
