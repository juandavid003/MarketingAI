#!/usr/bin/env bash
# One-time copy of all data from the current Prisma Postgres database into the
# droplet's Postgres. Run on the droplet from /opt/marketingai, BEFORE the app
# container starts for the first time (so the target is empty):
#   docker compose up -d db
#   OLD_DATABASE_URL='postgres://...@db.prisma.io:5432/...' bash migrate-data.sh
#   docker compose up -d
# The dump includes the _prisma_migrations table, so `prisma migrate deploy`
# on app start sees everything as already applied.
set -euo pipefail
cd /opt/marketingai
: "${OLD_DATABASE_URL:?Set OLD_DATABASE_URL to the current production DATABASE_URL}"
set -a; source .env; set +a

docker run --rm postgres:17-alpine \
  pg_dump "$OLD_DATABASE_URL" --no-owner --no-privileges --format=plain \
  > backups/migration-source.sql

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  < backups/migration-source.sql

echo "Filas por tabla en el destino:"
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "ANALYZE; select relname as tabla, n_live_tup as filas from pg_stat_user_tables order by relname;"
