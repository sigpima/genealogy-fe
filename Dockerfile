# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` resolves next.config.ts's rewrites() destinations into a static
# routes-manifest baked into the standalone output - unlike `next dev`, the
# standalone server.js does NOT re-read API_BASE_URL at container start, so it
# must be correct here at build time (see docker-compose.yml's `build.args`).
ARG API_BASE_URL=http://localhost:8000
ENV API_BASE_URL=$API_BASE_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# `output: 'standalone'` (next.config.ts) traces only the files server.js actually
# needs, instead of shipping the full node_modules tree into the final image.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
