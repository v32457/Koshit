# API and Integration Audit

Integrations:
- GST provider (gstinapi.in): server-side key, timeout/retry handling tested. Live verification BLOCKED (no key).
- Gemini AI: GEMINI_API_KEY placeholder in .env; not exercised.
- SAP integration: UI view only; no backend adapter found.

Endpoints tested via server/test/gstRoutes.test.ts and health.test.ts: all pass.
