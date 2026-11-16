#!/usr/bin/env bash
# Nightly Postgres backup, keeps the last 14 days. Install with:
#   (crontab -l 2>/dev/null; echo "15 3 * * * /opt/marketingai/backup.sh") | crontab -
# These backups live on the same droplet — also enable DigitalOcean droplet
# backups (or copy these files off-site) so a lost droplet isn't lost data.
set -euo pipefail
cd /opt/marketingai
set -a; source .env; set +a

stamp=$(date +%Y%m%d-%H%M%S)
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner \
  | gzip > "backups/db-$stamp.sql.gz"
find backups -name 'db-*.sql.gz' -mtime +14 -delete
