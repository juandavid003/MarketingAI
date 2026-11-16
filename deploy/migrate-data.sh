#!/usr/bin/env bash
# One-time copy of all data from the current Prisma Postgres database into the
# droplet's Postgres. Run on the droplet from /opt/marketingai, BEFORE the app
# container starts for the first time (so the target is empty):
#   docker compose up -d db
#   OLD_DATABASE_URL='postgres://...@db.prisma.io:5432/...' bash migrate-data.sh
#   docker compose up -d
# Only the public schema is copied: Prisma Postgres adds its own extension
# (prisma_postgres) that plain Postgres doesn't have. The dump includes the
# _prisma_migrations table, so `prisma migrate deploy` on app start sees
# everything as already applied.
set -euo pipefail
cd /opt/marketingai
: "${OLD_DATABASE_URL:?Set OLD_DATABASE_URL to the current production DATABASE_URL}"
# Read only what we need: sourcing the whole .env breaks on values like
# EMAIL_FROM="Name <a@b.c>" (bash treats < > as redirections).
env_get() { grep -E "^$1=" .env | head -1 | cut -d= -f2-; }
POSTGRES_USER="$(env_get POSTGRES_USER)"
POSTGRES_DB="$(env_get POSTGRES_DB)"

docker run --rm postgres:17-alpine \
  pg_dump "$OLD_DATABASE_URL" --schema=public --no-owner --no-privileges --format=plain \
  | grep -v -E '^(CREATE SCHEMA public;|COMMENT ON SCHEMA public )' \
  > backups/migration-source.sql

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  < backups/migration-source.sql

echo "Filas por tabla en el destino:"
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "ANALYZE; select relname as tabla, n_live_tup as filas from pg_stat_user_tables order by relname;"
