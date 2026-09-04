#!/usr/bin/env sh
# Dumps the production Postgres database and uploads it to a separate S3
# bucket. Meant to run from GitHub Actions (.github/workflows/db-backup.yml),
# with credentials distinct from the app's own AWS/DB credentials, so a
# compromise of the app server or its usual secrets doesn't also give an
# attacker write/delete access to the backups.
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"

timestamp=$(date -u +%Y-%m-%dT%H-%M-%SZ)
filename="chalan-db-${timestamp}.dump"
tmpfile="/tmp/${filename}"

# Scoped to the schemas the app actually owns: "public" (all the app's own
# tables) and "extensions" (where Supabase installs standard Postgres
# extensions like uuid-ossp/pgcrypto). Deliberately excludes Supabase's own
# platform-managed schemas (auth, storage, realtime, vault, graphql,
# pgbouncer) - this app doesn't use Supabase Auth/Storage/Realtime, and
# those schemas depend on Supabase-proprietary extensions (e.g.
# supabase_vault) that don't exist outside a Supabase-hosted Postgres,
# which broke restoring into a plain postgres:17-alpine for verification.
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges \
  --schema=public --schema=extensions --file="$tmpfile"
aws s3 cp "$tmpfile" "s3://${BACKUP_BUCKET}/${filename}"
rm -f "$tmpfile"

echo "Backup uploaded: s3://${BACKUP_BUCKET}/${filename}"
