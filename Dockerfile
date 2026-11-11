# syntax=docker/dockerfile:1.7
# Multi-stage image: deps -> dev (compose, hot reload) / build -> runner-web (production).
# The video worker stage (runner-worker, Debian + ffmpeg) is added in Passo 5.

ARG NODE_IMAGE=node:24.22.1-alpine3.24

FROM ${NODE_IMAGE} AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1

# --- dependencies (cached while package-lock.json does not change) ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# --- development: the source code comes from the bind mount in docker-compose.yml ---
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
ENTRYPOINT ["sh", "/app/docker/dev-entrypoint.sh"]
CMD ["npm", "run", "dev"]

# --- production build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- production web server (non-root, standalone output) ---
FROM ${NODE_IMAGE} AS runner-web
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health/ || exit 1
CMD ["node", "server.js"]
