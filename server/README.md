# Koshit API — Phase 1A

This phase adds an Express API foundation and a MySQL connection pool. It does not replace the existing React frontend, change item-code business rules, or implement authentication yet.

## Configuration

Copy `.env.example` to `.env` in the repository root and set `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD`. The API binds to `127.0.0.1:8091` by default so it is not exposed to the LAN unintentionally. Configure `API_HOST` only when the server firewall and deployment design are ready.

## Endpoints

- `GET /api/health` — process/API health; does not require MySQL.
- `GET /api/health/db` — executes `SELECT 1`; returns `503` when MySQL is unavailable and does not expose internal error details.

## Start in development

```powershell
npm install
npm run api:dev
```

## Tests

```powershell
npm test
npm run lint
npm run build
```

The health endpoint tests inject a database-check function so they can run without a live MySQL server. A successful `/api/health/db` test proves route behavior, not connectivity to the real database. Verify actual connectivity only after MySQL is installed and `.env` is configured.

## Migration baseline

`src/migrations/001_create_schema_migrations.sql` defines the migration tracking table. Automated migration execution is intentionally not enabled in this phase; schema changes must be reviewed and applied explicitly until the migration runner is implemented.
