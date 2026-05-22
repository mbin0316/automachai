# Multi-stage build for the Next.js dashboard (standalone output).

# ── Dependencies ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Build ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# NEXT_PUBLIC_* and any env used inside next.config.js rewrites need to be
# present at BUILD time, not just runtime, because Next.js bakes the rewrite
# destination URL into the build output.
ARG NEXT_PUBLIC_API_BASE=http://api:4000
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output bundles only the minimum needed to run
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static     ./.next/static
COPY --from=build /app/public           ./public

EXPOSE 3000
CMD ["node", "server.js"]
