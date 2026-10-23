# KOSH INNOVATIONS — EXTERNAL CONFIGURATION CHECKLIST

**System Name:** My Kosh Innovations Global IT System  
**Version:** v2.5.0-PROD  

---

## 1. Overview

Before promoting the application to live enterprise production traffic, the following external environment variables, provider credentials, database connections, and API keys must be populated in the production environment.

---

## 2. Infrastructure & Environment Checklist

| Component | Setting / Variable | Purpose | Required Action |
|---|---|---|---|
| **Database** | `DATABASE_URL` | PostgreSQL Connection String | Provision PostgreSQL DB and supply connection URL (e.g. `postgresql://user:pass@localhost:5432/kosh_db`). |
| **Authentication** | `JWT_SECRET` | Access Token Signing Secret | Supply a 64-character random string for JWT signature verification. |
| **SAP Business One** | `SAP_SERVICE_LAYER_URL` | HANA Service Layer Endpoint | Configure Service Layer URL (e.g. `https://sap-hana.koshinnovations.com:50000/b1s/v2`). |
| **SAP Business One** | `SAP_COMPANY_DB` | Target Company Database ID | Enter SAP Company Database identifier (e.g. `KOSH_PROD_DB`). |
| **SAP Business One** | `SAP_USERNAME` | Service Layer Technical User | Configure SAP technical integration user account with item/partner creation rights. |
| **WhatsApp Business** | `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp Cloud API Phone ID | Configure Meta Phone Number ID for company sender `+91 98401 22320`. |
| **WhatsApp Business** | `WHATSAPP_ACCESS_TOKEN` | Meta System User Access Token | Supply Meta WhatsApp Cloud API permanent access token. |
| **Email Delivery** | `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Transactional Email Server | Configure corporate SMTP server for password recovery tokens and 2FA notifications. |
| **GST Verification** | `GST_API_PROVIDER_KEY` | Authorized GST Lookup API Key | Configure GST portal / API provider key for live GSTIN verification lookups. |

---

## 3. Secret Management Compliance Rule

- **No Secrets in Bundles:** Never store or commit passwords, API keys, or access tokens in frontend source code (`src/*`), git repositories, or public bundles.
- **Server Environment Variables:** Load all secrets at runtime on the server via `.env` or system environment variables.
