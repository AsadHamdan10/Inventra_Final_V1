# INVENTRA V1 — PRODUCTION RELEASE CHECKLIST

## 1. Database Preparation
- [ ] Provision a dedicated managed PostgreSQL 15+ cluster.
- [ ] Configure `DATABASE_URL` securely in the production `.env`.
- [ ] Execute `npx prisma migrate deploy` (NEVER `prisma db push` in production).

## 2. Environment Variables
- [ ] Ensure `NODE_ENV=production`.
- [ ] Set a secure, 64+ character `JWT_SECRET`.
- [ ] Configure `FRONTEND_URL` for strict CORS filtering.
- [ ] Set real GST API Provider credentials (ClearTax, etc.) if going live.

## 3. Infrastructure & Networking
- [ ] Configure Reverse Proxy (Nginx / HAProxy / AWS ALB).
- [ ] Install SSL/TLS Certificates (Let's Encrypt / AWS ACM).
- [ ] Force HTTPS redirects.
- [ ] Bind backend Express server to `localhost` or internal VPC IP (do not expose port 3000 directly to the internet).

## 4. Build & Deployment
- [ ] Run `npm run build` on Backend.
- [ ] Run `npm run build` on Frontend.
- [ ] Transfer `dist/` and `package.json` to the production server.
- [ ] Install `--production` dependencies only.
- [ ] Configure process manager (PM2 / systemd / Docker) to run `node dist/server.js`.
- [ ] Serve frontend static files via Nginx or CDN.

## 5. Security Validation
- [ ] Run automated vulnerability scanner (`npm audit`).
- [ ] Verify `helmet` is active for security headers.
- [ ] Verify rate limiting is active.
- [ ] Test cross-tenant isolation manually on staging environment.

## 6. Post-Deployment Smoke Test
- [ ] Create initial Super Admin account.
- [ ] Create first Tenant.
- [ ] Complete 1 basic Sale lifecycle to verify DB connection.
- [ ] Complete 1 basic Purchase lifecycle.
- [ ] View Dashboard to ensure read-queries function.
- [ ] *IMMEDIATELY DELETE or REVERSE smoke test data using proper transactions (Do not hard delete).*

## 7. Monitoring & Backup
- [ ] Ensure cron jobs for database backups are active.
- [ ] Configure application error logging (e.g., Sentry, Winston to CloudWatch).
- [ ] Configure uptime monitoring.
