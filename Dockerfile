# Multi-stage build for a Next.js 14 (App Router) + Prisma app on CranL.
# CranL requirements this satisfies: named "Dockerfile" at repo root, binds 0.0.0.0,
# has a CMD, uses the Port set in the CranL app's Port setting (EXPOSE 3000 below —
# keep this matching whatever you set there).

FROM node:20-alpine AS base
# Alpine ships musl libc, not glibc, and recent Alpine versions don't include OpenSSL 1.1 by
# default — Prisma's query engine needs to detect it to pick the right binary, and without it
# falls back to a guess ("Prisma failed to detect the libssl/openssl version... Defaulting to
# openssl-1.1.x"), which can silently load the wrong engine. Installing it directly is Prisma's
# own documented fix for Alpine images, cheaper than switching to a Debian-based base.
RUN apk add --no-cache openssl

# ---------- deps: install once, cached across builds unless package*.json changes ----------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder: generate Prisma client, build the Next app ----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---------- runner: the actual image CranL runs ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Next's standalone output traces and prunes node_modules automatically, but the Prisma CLI
# (needed at container start to run `prisma migrate deploy`) is invoked as a separate process,
# never `require()`d by app code — so tracing never picks it up. Copy it explicitly rather than
# discover this as a runtime crash.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

# Applies any pending migrations on every deploy, then starts the server — the same
# `prisma migrate deploy` used locally throughout this project, just run automatically here
# since CranL gives no separate "run a one-off command" step before starting the app.
# Invokes the CLI's entry script directly (node_modules/prisma/build/index.js) rather than via
# node_modules/.bin/prisma — that's a symlink npm creates during install, and it isn't there to
# copy since this image builds node_modules by explicit COPY, not by running npm install itself.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
