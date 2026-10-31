CREATE TABLE gst_verifications (
  gstin CHAR(15) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  trade_name VARCHAR(255) NULL,
  registration_status VARCHAR(100) NOT NULL,
  taxpayer_type VARCHAR(100) NULL,
  registration_date VARCHAR(20) NULL,
  cancellation_date VARCHAR(20) NULL,
  state_code VARCHAR(4) NULL,
  address VARCHAR(500) NULL,
  city VARCHAR(120) NULL,
  pincode VARCHAR(12) NULL,
  block_status VARCHAR(100) NULL,
  address_details JSON NULL,
  credits_remaining INT NULL,
  retrieved_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (gstin),
  KEY ix_gst_verifications_retrieved (retrieved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
