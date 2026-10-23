# KOSH INNOVATIONS — ENTERPRISE DEPLOYMENT HANDBOOK
**System**: My Kosh Innovations Global IT System  
**Module**: Item Master & Global Governance System (Module 00 - 05.05)  
**Production Subdomain**: `https://my.koshinnovations.com/`  
**UAT Environment**: `http://localhost/mykoshinnovations`  
**Version**: 1.0.0 (Production Release Baseline)  
**Date**: 2026-10-22  

---

## 1. Domain & DNS Administration
- **Corporate Website**: `https://koshinnovations.com/`
- **Target Production Host**: `my.koshinnovations.com`
- **DNS Records**:
  - `A` Record: `my.koshinnovations.com` → Production Host IP (or CNAME to cloud ingress load balancer)
  - `TXT` Record: Verification key for ACME / Let's Encrypt automated TLS renewal
- **UAT Setup**: On-premise Linux / Windows reverse proxy under `/mykoshinnovations` path or dedicated UAT virtual host `http://uat.koshinnovations.internal/`.

---

## 2. Infrastructure & Hosting Requirements
- **Operating System**: Enterprise Linux (RHEL 9, Rocky Linux 9, or Ubuntu 24.04 LTS) or Windows Server 2022.
- **Compute Sizing**:
  - Minimum: 4 vCPU, 16 GB RAM, 100 GB NVMe SSD.
  - Recommended for Multi-Plant Peak Operations: 8 vCPU, 32 GB RAM, 250 GB NVMe SSD.
- **Runtimes**:
  - Node.js 22 LTS / Bun.
  - PostgreSQL 16+ with high availability replication.
  - Nginx 1.26+ or HAProxy 3.0+ for reverse proxy, SSL termination, and rate limiting.

---

## 3. Reverse Proxy & Nginx Production Configuration

```nginx
# /etc/nginx/sites-available/my.koshinnovations.com.conf

server {
    listen 80;
    server_name my.koshinnovations.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name my.koshinnovations.com;

    # TLS Certificates
    ssl_certificate /etc/letsencrypt/live/my.koshinnovations.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/my.koshinnovations.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Enterprise Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend Single Page App
    root /var/www/mykoshinnovations/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API & Scheduler Gateway
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

---

## 4. Environment Variables (`.env.production`)

```env
# Application Identity
APP_NAME="My Kosh Innovations Global IT System"
APP_ENV=production
APP_URL=https://my.koshinnovations.com
PORT=3000

# PostgreSQL Enterprise Database
DATABASE_URL=postgresql://kosh_admin:${SECURE_DB_PASSWORD}@db.koshinnovations.internal:5432/kosh_master_governance?sslmode=verify-full

# Security & Session
SESSION_SECRET=${SECURE_SESSION_SECRET}
JWT_EXPIRY_MINUTES=30
TWO_FACTOR_ENFORCED=true
OTP_EXPIRY_SECONDS=300

# SAP Business One Service Layer on HANA
SAP_SERVICE_LAYER_URL=https://sap-hana.koshinnovations.internal:50000/b1s/v2
SAP_COMPANY_DB=KOSH_PROD_HANA
SAP_VAULT_REF=vault://kosh-secrets/sap-service-layer-creds
SAP_TIMEOUT_SECONDS=30
SAP_MAX_RETRIES=3
SAP_BATCH_SIZE=50
SAP_SCHEDULE_TIMEZONE=Asia/Kolkata
```

---

## 5. Build & Startup Commands

```bash
# 1. Install dependencies
npm ci

# 2. Run automated logic & regression tests
npx tsx --test src/test/itemCodeEngine.test.ts src/test/itemDescriptionEngine.test.ts

# 3. Compile production bundle
npm run build

# 4. Start production service under PM2 / Systemd
pm2 start server.ts --name "kosh-portal-core" -i max
pm2 save
```

---

## 6. Disaster Recovery & Emergency Stop

1. **Database Backup**: Automated pg_dump snapshot every 6 hours with 30-day retention.
2. **Emergency Stop**: Toggle available directly in `Module 05.05.03 Activate Integration` to immediately suspend background worker sync without losing pending requests.
3. **Rollback Policy**: Immutable rule versions in `05.04.01 Rule Version History` permit one-click rollback to any audited prior rule version without database schema mutations.
