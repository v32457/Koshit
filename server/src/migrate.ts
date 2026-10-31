import { runMigrations } from './db/migrate.js';
import { closeDatabase } from './db/pool.js';

async function main(): Promise<void> {
  try {
    await runMigrations();
  } finally {
    await closeDatabase();
  }
}

main().catch((error: unknown) => {
  console.error('Database migration failed:', error);
  process.exitCode = 1;
});
