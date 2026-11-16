#!/usr/bin/env bash
# Nightly Postgres backup, keeps the last 14 days. Install with:
#   (crontab -l 2>/dev/null; echo "15 3 * * * /opt/marketingai/backup.sh") | crontab -
# These backups live on the same droplet — also enable DigitalOcean droplet
# backups (or copy these files off-site) so a lost droplet isn't lost data.
set -euo pipefail
cd /opt/marketingai
# Read only what we need: sourcing the whole .env breaks on values like
# EMAIL_FROM="Name <a@b.c>" (bash treats < > as redirections).
env_get() { grep -E "^$1=" .env | head -1 | cut -d= -f2-; }
POSTGRES_USER="$(env_get POSTGRES_USER)"
POSTGRES_DB="$(env_get POSTGRES_DB)"

stamp=$(date +%Y%m%d-%H%M%S)
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner \
  | gzip > "backups/db-$stamp.sql.gz"
find backups -name 'db-*.sql.gz' -mtime +14 -delete
