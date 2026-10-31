import type { ResultSetHeader } from 'mysql2';
import type {
  GstFilingHistoryResult,
  GstVerificationResult,
} from '../../../shared/gst.js';
import { getPool } from '../db/pool.js';

function toMysqlDateTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Cannot persist a GST result with an invalid timestamp.');
  }

  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export async function saveGstVerification(
  result: GstVerificationResult,
): Promise<void> {
  await getPool().execute(
    `INSERT INTO gst_verifications (
       gstin, provider, endpoint, legal_name, trade_name,
       registration_status, taxpayer_type, registration_date,
       cancellation_date, state_code, address, city, pincode,
       block_status, address_details, credits_remaining, retrieved_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       provider = VALUES(provider),
       endpoint = VALUES(endpoint),
       legal_name = VALUES(legal_name),
       trade_name = VALUES(trade_name),
       registration_status = VALUES(registration_status),
       taxpayer_type = VALUES(taxpayer_type),
       registration_date = VALUES(registration_date),
       cancellation_date = VALUES(cancellation_date),
       state_code = VALUES(state_code),
       address = VALUES(address),
       city = VALUES(city),
       pincode = VALUES(pincode),
       block_status = VALUES(block_status),
       address_details = VALUES(address_details),
       credits_remaining = VALUES(credits_remaining),
       retrieved_at = VALUES(retrieved_at)`,
    [
      result.gstin,
      result.provider,
      result.endpoint.slice(0, 255),
      result.profile.legalName.slice(0, 255),
      result.profile.tradeName?.slice(0, 255) ?? null,
      result.profile.status.slice(0, 100),
      result.profile.taxpayerType?.slice(0, 100) ?? null,
      result.profile.registrationDate?.slice(0, 20) ?? null,
      result.profile.cancellationDate?.slice(0, 20) ?? null,
      result.profile.stateCode?.slice(0, 4) ?? null,
      result.profile.address?.slice(0, 500) ?? null,
      result.profile.city?.slice(0, 120) ?? null,
      result.profile.pincode?.slice(0, 12) ?? null,
      result.profile.blockStatus?.slice(0, 100) ?? null,
      result.profile.addressDetails
        ? JSON.stringify(result.profile.addressDetails)
        : null,
      result.creditsRemaining,
      toMysqlDateTime(result.retrievedAt),
    ],
  );
}

export async function saveGstFilingHistory(
  result: GstFilingHistoryResult,
): Promise<void> {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Replace the stored history for this GSTIN and financial year so
    // repeated provider reads cannot create duplicate filing rows.
    await connection.execute(
      'DELETE FROM gst_filing_history WHERE gstin = ? AND financial_year = ?',
      [result.gstin, result.financialYear],
    );

    if (result.returns.length > 0) {
      const retrievedAt = toMysqlDateTime(result.retrievedAt);
      const placeholders = result.returns
        .map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .join(', ');
      const values = result.returns.flatMap((record) => [
        result.gstin,
        result.financialYear,
        record.returnType.slice(0, 20),
        record.returnPeriod,
        record.filingStatus.slice(0, 50),
        record.filingDate?.slice(0, 20) ?? null,
        record.arn?.slice(0, 64) ?? null,
        result.provider,
        result.endpoint.slice(0, 255),
        result.creditsRemaining,
        retrievedAt,
        retrievedAt,
      ]);

      await connection.execute<ResultSetHeader>(
        `INSERT INTO gst_filing_history (
           gstin, financial_year, return_type, return_period,
           filing_status, filing_date, arn, provider, endpoint,
           credits_remaining, retrieved_at, created_at
         ) VALUES ${placeholders}`,
        values,
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
