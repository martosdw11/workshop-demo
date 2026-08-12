# Multi-stage build (deps → build → runner) — TDD §11.1.
# Menghasilkan satu container Next.js `output: 'standalone'`, user non-root.

# --- deps --------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build -------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runner ------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

# Direktori media (volume di-mount ke sini oleh docker-compose)
RUN mkdir -p /app/storage/uploads && chown -R nextjs:nodejs /app/storage

USER nextjs
EXPOSE 3000

# Migrasi TIDAK dijalankan di sini. Urutan rilis: build → npm run db:migrate →
# deploy → cek /api/v1/health (TDD §11.1). Migrasi saat boot membuat kegagalan
# skema muncul sebagai crash-loop, bukan deploy yang gagal dengan jelas.
CMD ["node", "server.js"]
