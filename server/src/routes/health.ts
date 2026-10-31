import { Router } from 'express';
import type { RequestHandler } from 'express';

export function createHealthRouter(checkDatabase: () => Promise<void>): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'koshit-api' });
  });

  const databaseHealth: RequestHandler = async (_req, res) => {
    try {
      await checkDatabase();
      res.status(200).json({ status: 'ok', database: 'connected' });
    } catch {
      // Do not return credentials, SQL details, or network topology to callers.
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  };
  router.get('/db', databaseHealth);

  return router;
}
