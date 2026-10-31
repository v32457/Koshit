import express from 'express';
import type { Express, ErrorRequestHandler } from 'express';
import { checkDatabase } from './db/pool.js';
import { createGstRouter } from './routes/gst.js';
import type { GstRouterDependencies } from './routes/gst.js';
import { createHealthRouter } from './routes/health.js';
import { createItemsRouter } from './routes/items.js';

export function createApp(
  databaseCheck: () => Promise<void> = checkDatabase,
  gstDependencies: Partial<GstRouterDependencies> = {},
): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb', strict: true }));

  app.use('/api/health', createHealthRouter(databaseCheck));
  app.use('/api/items', createItemsRouter());
  app.use('/api/gst', createGstRouter(gstDependencies));

  app.use((_req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (res.headersSent) return;

    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON',
        },
      });
      return;
    }

    const mysqlError = error as { code?: string };

    if (mysqlError.code === 'ER_DUP_ENTRY') {
      res.status(409).json({
        error: {
          code: 'DUPLICATE_ITEM_CODE',
          message: 'An item with this item code already exists.',
        },
      });
      return;
    }

    console.error('API request failed:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  };

  app.use(errorHandler);
  return app;
}
