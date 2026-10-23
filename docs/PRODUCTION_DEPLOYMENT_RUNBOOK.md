# KOSH INNOVATIONS — PRODUCTION DEPLOYMENT RUNBOOK

**System Name:** My Kosh Innovations Global IT System  
**Version:** v2.5.0-PROD  
**Target Domain:** `https://my.koshinnovations.com/`  
**UAT Target:** `http://localhost/mykoshinnovations`  

---

## 1. Environment & Prerequisites

### 1.1 Operating Environment
- **Operating System:** Ubuntu 22.04 LTS / Debian 12 / Enterprise Linux
- **Node.js Runtime:** v20.x or v22.x LTS
- **Package Manager:** npm v10.x
- **Reverse Proxy:** Nginx 1.24+ / Apache 2.4+ / IIS 10+
- **Database:** PostgreSQL 15.x / 16.x

---

## 2. Local & UAT Deployment Steps

```bash
# Step 1: Clone Repository & Install Dependencies
cd /var/www/mykoshinnovations
npm install

# Step 2: Validate TypeScript Compilation
npm run lint

# Step 3: Execute Production Build
npm run build

# Step 4: Start Dev/Preview Server on Port 3000
npm run dev
```

---

## 3. Nginx Reverse Proxy Configuration (`/etc/nginx/sites-available/mykoshinnovations`)

```nginx
server {
    listen 80;
    server_name my.koshinnovations.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name my.koshinnovations.com;

    ssl_certificate /etc/letsencrypt/live/my.koshinnovations.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/my.koshinnovations.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/mykoshinnovations/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy Route
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

---

## 4. Health Checks & Verification

1. **HTTP Liveness Check:** `curl -I https://my.koshinnovations.com/` (Should return `HTTP/2 200`).
2. **Build Integrity Check:** Confirm `/var/www/mykoshinnovations/dist/index.html` exists and loads `/assets/*.js`.
3. **Route Guard Check:** Accessing `https://my.koshinnovations.com/dashboard` in Incognito mode redirects to `/login`.
