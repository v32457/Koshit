import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { createApp } from '../src/app.js';

async function withServer<T>(checkDatabase: () => Promise<void>, run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createServer(createApp(checkDatabase));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not determine test server address');
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('GET /api/health reports API status without needing MySQL', async () => {
  await withServer(async () => { throw new Error('DB check should not be called'); }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', service: 'koshit-api' });
  });
});

test('GET /api/health/db reports connected when the injected check succeeds', async () => {
  await withServer(async () => {}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health/db`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', database: 'connected' });
  });
});

test('GET /api/health/db returns a safe 503 when the database check fails', async () => {
  await withServer(async () => { throw new Error('sensitive connection details'); }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health/db`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'error', database: 'unavailable' });
  });
});

test('unknown API routes return a structured 404', async () => {
  await withServer(async () => {}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/missing`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
});
