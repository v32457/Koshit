import { createServer } from 'node:http';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { closeDatabase } from './db/pool.js';

const server = createServer(createApp());
server.listen(env.port, env.host, () => {
  console.log(`Koshit API listening on http://${env.host}:${env.port}`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down Koshit API`);
  server.close(async (error) => {
    try {
      await closeDatabase();
    } finally {
      process.exit(error ? 1 : 0);
    }
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
