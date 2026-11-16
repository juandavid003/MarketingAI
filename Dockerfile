# Production image for the DigitalOcean droplet (see deploy/README.md).
# Built by GitHub Actions — not on the droplet, whose 2 GB RAM is too tight
# for `next build` alongside Postgres.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- all dependencies (dev included: needed to build)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- production-only dependencies for the final image (prisma CLI is a prod
# dependency: `npm start` runs migrations before starting Next)
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# --- build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholder values only so modules that validate env at import time (e.g.
# lib/auth.ts) can load while Next collects page data. They exist only in
# this build stage; the runtime container gets the real ones from .env.
# prisma generate only reads the schema; no DB connection at build time.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-placeholder-not-a-secret" \
    npm run build

# --- runtime
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STORAGE_DIR=/data/storage
# ffmpeg/ffprobe for the video pipeline; DejaVu font for placeholder images.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/src/generated ./src/generated

RUN mkdir -p /data/storage && chown -R node:node /data /app
USER node
EXPOSE 3000
# Applies pending migrations, then starts Next (see package.json "start").
CMD ["npm", "start"]
