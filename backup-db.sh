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

pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$tmpfile"
aws s3 cp "$tmpfile" "s3://${BACKUP_BUCKET}/${filename}"
rm -f "$tmpfile"

echo "Backup uploaded: s3://${BACKUP_BUCKET}/${filename}"
