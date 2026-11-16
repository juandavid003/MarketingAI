# Despliegue en DigitalOcean

Un solo droplet (USD 12/mes: 2 GB RAM, 1 vCPU, 50 GB SSD) con tres contenedores:

| Contenedor | Qué hace |
|---|---|
| `caddy` | HTTPS automático (Let's Encrypt) y proxy hacia la app |
| `app` | Next.js + ffmpeg. Aplica migraciones al arrancar. Archivos en el volumen `appdata` (`/data/storage`) |
| `db` | PostgreSQL 17. **Única base de datos** del producto. No expuesta a internet |

Cada push a `main` en GitHub → GitHub Actions construye la imagen, la sube a GitHub Container Registry y reinicia la app en el droplet (`.github/workflows/deploy.yml`). La imagen se construye en GitHub, no en el droplet (2 GB no alcanzan para `next build` junto a Postgres).

## Dominio

Mientras no haya dominio propio se usa **sslip.io**: para la IP `164.90.1.2` el dominio es `164-90-1-2.sslip.io`. Tiene certificado HTTPS válido y Meta lo acepta como dominio de la app. Cambiar a un dominio propio = actualizar `APP_DOMAIN` en `.env`, el DNS, y los dominios/redirect URI en Meta.

## Puesta en marcha (una sola vez)

1. **Droplet:** Ubuntu 24.04, Basic → Regular, USD 12/mes. Región: New York (la más cercana a Ecuador). Autenticación: llave SSH `marketingai-deploy` (pública abajo en el chat / `~/.ssh/marketingai_deploy.pub`).
2. **Servidor:** `ssh root@IP 'bash -s' < deploy/setup-droplet.sh` (Docker, 2 GB de swap, firewall 22/80/443, actualizaciones automáticas).
3. **Configuración:** copiar `docker-compose.yml`, `Caddyfile`, `backup.sh` a `/opt/marketingai` y crear `/opt/marketingai/.env` desde `env.example`. **`ENCRYPTION_SECRET` debe ser el mismo de hoy.**
4. **Datos:** `docker compose up -d db` → `OLD_DATABASE_URL=... bash migrate-data.sh` (copia todo desde Prisma Postgres) → `docker compose up -d`.
5. **Backups:** cron diario con `backup.sh` (14 días). Recomendado además: backups de droplet de DigitalOcean (+20 % del precio) para tener copia fuera del servidor.
6. **GitHub:** repo privado `juandavid003/MarketingAI`; secrets `DROPLET_HOST`, `DROPLET_SSH_KEY` (la imagen se descarga con el token temporal del workflow).
7. **Meta:** Dominios de la app = `APP_DOMAIN`; URI de redirección OAuth = `https://APP_DOMAIN/api/auth/meta/callback`; actualizar las URLs de privacidad y términos.
8. **Apagar Railway y Prisma Postgres** solo después de verificar que todo funciona en el droplet.

## Desarrollo local contra la base de producción

Hay una sola base de datos: la del droplet. Postgres solo escucha en `127.0.0.1` del droplet; desde tu PC se llega por túnel SSH:

```bash
npm run db:tunnel     # deja esta terminal abierta (localhost:5433 -> Postgres del droplet)
npm run dev           # en otra terminal; .env apunta a localhost:5433
```

Todo lo que hagas en local escribe en producción.

## Operación

```bash
ssh -i ~/.ssh/marketingai_deploy root@IP
cd /opt/marketingai
docker compose ps                 # estado
docker compose logs -f app        # logs de la app
docker compose exec db psql -U marketingai marketingai   # consola SQL
ls backups/                       # respaldos
```
