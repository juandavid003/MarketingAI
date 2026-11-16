# Production image for the DigitalOcean droplet (see deploy/README.md).
# Built by GitHub Actions — not on the droplet, whose 2 GB RAM is too tight
# for `next build` alongside Postgres.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- dependencies (incl. dev: prisma CLI is needed at runtime for migrations)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma generate only reads the schema; no DB connection at build time.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build

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
COPY --from=build /app/node_modules ./node_modules
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
