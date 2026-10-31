CREATE TABLE gst_filing_history (
  filing_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  gstin CHAR(15) NOT NULL,
  financial_year VARCHAR(7) NOT NULL,
  return_type VARCHAR(20) NOT NULL,
  return_period CHAR(7) NOT NULL,
  filing_status VARCHAR(50) NOT NULL,
  filing_date VARCHAR(20) NULL,
  arn VARCHAR(64) NULL,
  provider VARCHAR(100) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  credits_remaining INT NULL,
  retrieved_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (filing_id),
  UNIQUE KEY uq_gst_filing_record (
    gstin,
    financial_year,
    return_type,
    return_period
  ),
  KEY ix_gst_filing_lookup (gstin, financial_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
