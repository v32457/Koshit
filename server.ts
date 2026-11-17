/**
 * KOSH INNOVATIONS — FULL-STACK ENTRYPOINT (Port 3000)
 * Serves Express Zero-Trust Security & ERP APIs (/api/security/*, /api/charges/*, /api/health/*, /api/items/*, /api/gst/*)
 * alongside Vite middleware in development or built static assets (dist/) in production.
 */
import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { createServer as createHttpServer } from 'node:http';
import { createHealthRouter } from './server/src/routes/health.js';
import { createItemsRouter } from './server/src/routes/items.js';
import { createGstRouter } from './server/src/routes/gst.js';
import { createChargesRouter } from './server/src/routes/charges.js';
import { createSecurityRouter } from './server/src/routes/security.js';
import { createUomsRouter } from './server/src/routes/uoms.js';
import { createItemGovernanceRouter } from './server/src/routes/itemGovernance.js';
import { createBranchItemsRouter } from './server/src/routes/branchItems.js';
import { createChangeHistoryRouter } from './server/src/routes/changeHistory.js';
import { checkDatabase, closeDatabase } from './server/src/db/pool.js';

async function startServer(): Promise<void> {
  const app = express();
  const port = Number(
    process.env.APP_PORT ||
      process.env.DEFAULT_APP_PORT ||
      (process.env.PORT && process.env.PORT !== process.env.NGINX_PORT ? process.env.PORT : 3000)
  );
  const host = process.env.HOST || '0.0.0.0';
  const isProd = process.env.NODE_ENV === 'production';

  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb', strict: true }));

  // Authoritative Backend API Routers
  app.use('/api/health', createHealthRouter(checkDatabase));
  app.use('/api/items', createItemsRouter());
  app.use('/api/items', createItemGovernanceRouter());
  app.use('/api/branch-items', createBranchItemsRouter());
  app.use('/api/change-history', createChangeHistoryRouter());
  app.use('/api/uoms', createUomsRouter());
  app.use('/api/gst', createGstRouter());
  app.use('/api/charges', createChargesRouter());
  app.use('/api/security', createSecurityRouter());

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (res.headersSent) return;
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } });
      return;
    }
    console.error('Server error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  };
  app.use(errorHandler);

  const server = createHttpServer(app);
  server.listen(port, host, () => {
    console.log(`KOSH Full-Stack Server listening on http://${host}:${port} (${isProd ? 'production' : 'development'})`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received; shutting down gracefully`);
    server.close(async () => {
      try {
        await closeDatabase();
      } finally {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error('Failed to start KOSH full-stack server:', err);
  process.exit(1);
});
