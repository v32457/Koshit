# Database Audit

Engine: MySQL (mysql2). Config: MYSQL_* in .env. Migrations 001-005.

Checks executed:
- npm run lint: PASS
- npm test: 63/63 PASS (includes route failure-path DB error handling)
- Live MySQL connection: FAILED (connection refused) — BLOCKED.

Migration tests against clean DB: not executed (MySQL unavailable). Backup/restore: not executed.
