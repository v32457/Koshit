import mysql, { type Pool } from 'mysql2/promise';
import { env } from '../config/env.js';

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: env.mysqlHost,
      port: env.mysqlPort,
      database: env.mysqlDatabase,
      user: env.mysqlUser,
      password: env.mysqlPassword,
      waitForConnections: true,
      connectionLimit: env.mysqlConnectionLimit,
      queueLimit: 0,
      enableKeepAlive: true,
      charset: 'utf8mb4',
      timezone: 'Z',
    });
  }
  return pool;
}

export async function checkDatabase(): Promise<void> {
  const connection = await getPool().getConnection();
  try {
    await connection.query('SELECT 1');
  } finally {
    connection.release();
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    const activePool = pool;
    pool = undefined;
    await activePool.end();
  }
}
