import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { RowDataPacket } from 'mysql2';
import { getPool } from './pool.js';

const migrationDirectory = fileURLToPath(
  new URL('../migrations/', import.meta.url),
);

const createHistoryTable = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) NOT NULL PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

export async function runMigrations(): Promise<string[]> {
  const connection = await getPool().getConnection();
  const applied: string[] = [];
  let lockAcquired = false;

  try {
    const [lockRows] = await connection.query(
      'SELECT GET_LOCK(?, 10) AS acquired',
      ['koshit_schema_migrations'],
    );

    lockAcquired =
      Number((lockRows as RowDataPacket[])[0]?.acquired) === 1;

    if (!lockAcquired) {
      throw new Error('Could not acquire the database migration lock.');
    }

    await connection.query(createHistoryTable);

    const files = (await readdir(migrationDirectory))
      .filter((file) => /^\d+_.+\.sql$/i.test(file))
      .sort((a, b) => a.localeCompare(b, 'en'));

    for (const file of files) {
      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT version FROM schema_migrations WHERE version = ?',
        [file],
      );

      if (rows.length > 0) {
        console.log(`Skipping applied migration: ${file}`);
        continue;
      }

      const sql = (await readFile(
        new URL(`../migrations/${file}`, import.meta.url),
        'utf8',
      )).trim();

      if (!sql) {
        throw new Error(`Migration file is empty: ${file}`);
      }

      // Each migration file must contain exactly one SQL statement.
      await connection.query(sql);

      await connection.execute(
        'INSERT INTO schema_migrations (version) VALUES (?)',
        [file],
      );

      applied.push(file);
      console.log(`Applied migration: ${file}`);
    }

    console.log(`Migration run complete. Newly applied: ${applied.length}`);
    return applied;
  } finally {
    try {
      if (lockAcquired) {
        await connection.query(
          'SELECT RELEASE_LOCK(?)',
          ['koshit_schema_migrations'],
        );
      }
    } finally {
      connection.release();
    }
  }
}
