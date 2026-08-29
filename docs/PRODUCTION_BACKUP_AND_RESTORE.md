# INVENTRA V1 — PRODUCTION BACKUP & RESTORE

## 1. Backup Strategy

**Frequency**: 
- Daily automated full backups (cron-based).
- Continuous WAL (Write-Ahead Logging) archiving to S3 for point-in-time recovery (recommended for production).

**Retention Policy**:
- 7 daily backups
- 4 weekly backups
- 12 monthly backups

**Storage Location**: 
- Encrypted AWS S3 Bucket (or equivalent block storage) physically separate from the database host.

## 2. Backup Procedure

### PostgreSQL `pg_dump` Command
Execute this as the `postgres` user to create a compressed, custom-format backup:
```bash
pg_dump -U postgres -F c -d inventra_v1_production -f /var/backups/inventra_v1_prod_$(date +%Y%m%d).dump
```

### Encryption
Compress and encrypt the backup before transferring it offsite:
```bash
gpg -c --batch --passphrase $ENCRYPTION_KEY /var/backups/inventra_v1_prod_$(date +%Y%m%d).dump
```

## 3. Restore Procedure

**CRITICAL WARNING:** Restoring a database drops the existing database and replaces it. Ensure that the application is stopped during a restore.

### Drop and Recreate
```bash
dropdb -U postgres inventra_v1_production
createdb -U postgres inventra_v1_production
```

### Decrypt and Restore
```bash
gpg -d --batch --passphrase $ENCRYPTION_KEY /var/backups/inventra_v1_prod_20261010.dump.gpg > restore.dump
pg_restore -U postgres -d inventra_v1_production -1 restore.dump
```
*(The `-1` flag ensures the restore runs inside a single transaction; if it fails, it rolls back entirely.)*

## 4. Disaster Recovery (DR)

If the primary database server is permanently lost:
1. Provision a new PostgreSQL server matching the exact PostgreSQL version.
2. Ensure the new server has identical `pg_hba.conf` and `postgresql.conf` tuning.
3. Download the latest backup from the S3 bucket.
4. Execute the Restore Procedure.
5. Apply Prisma migrations (if any pending) using `npx prisma migrate deploy` to ensure schema consistency.
6. Re-route the application's `DATABASE_URL` to the new host.
7. Restart the Node.js backend.
