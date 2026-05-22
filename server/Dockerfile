# Multi-stage build for the Express + TypeScript API.

# ── Dependencies (cached layer) ─────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Build (compile TS → JS) ─────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Production-only deps (smaller runtime image) ────────────────────────────
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Runtime image ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build     /app/dist          ./dist
COPY                  package*.json      ./

# Schema file is needed only if you want to run migrations from inside the
# container; the compose file mounts it into Postgres directly so this is optional.
COPY                  db/schema.sql      ./db/schema.sql

EXPOSE 4000
CMD ["node", "dist/index.js"]
