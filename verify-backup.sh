#!/usr/bin/env sh
# Downloads the most recent backup from S3 and restores it into a scratch
# Postgres instance to prove it's actually usable - not just present. A
# backup nobody has ever restored is not a real backup. Run right after
# backup-db.sh so this checks the exact object that just landed in S3.
set -eu

: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"

latest=$(aws s3api list-objects-v2 --bucket "$BACKUP_BUCKET" \
  --query 'sort_by(Contents, &LastModified)[-1].Key' --output text)
if [ -z "$latest" ] || [ "$latest" = "None" ]; then
  echo "No backups found in s3://${BACKUP_BUCKET}" >&2
  exit 1
fi

echo "Verifying: s3://${BACKUP_BUCKET}/${latest}"
tmpfile="/tmp/verify.dump"
aws s3 cp "s3://${BACKUP_BUCKET}/${latest}" "$tmpfile"

# Sanity-check the archive's own table of contents before attempting a real
# restore - catches truncation/corruption fast, without needing a database.
pg_restore --list "$tmpfile" > /dev/null

# --clean --if-exists: a freshly created database already has a default,
# empty "public" schema, which collides with the dump's own CREATE SCHEMA -
# drop-then-recreate makes this idempotent, same as a real disaster-recovery
# restore into a fresh database would need anyway.
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname "$RESTORE_DATABASE_URL" "$tmpfile"

row_count=$(psql "$RESTORE_DATABASE_URL" -tAc "SELECT count(*) FROM orders;")
echo "Restored 'orders' table row count: ${row_count}"
if [ "${row_count}" -lt 1 ]; then
  echo "Restore produced an empty orders table - treating this as a failed verification." >&2
  exit 1
fi

rm -f "$tmpfile"
echo "Backup verified OK: restorable and contains data."
