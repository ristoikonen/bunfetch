# ------------------------------------------------------------
# bunfetch — Dockerfile for Google Cloud Run
# ------------------------------------------------------------
# Build & run the Bun + Vite + React app in a single container.
# Cloud Run supplies the PORT env var (default 8080) and requires
# the app to listen on 0.0.0.0.

FROM oven/bun:1 AS base

WORKDIR /app

# Production defaults (overridden by Cloud Run env vars where needed)
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# 1) Install dependencies (lockfile-based for reproducible builds)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# 2) Copy the application source
COPY . .

# 3) Build the Vite frontend (output goes to ./dist)
RUN bun run build

# 4) The Bun server serves static HTML from ./public, so copy the
#    built frontend into public so it is served at runtime.
RUN cp -r dist/. public/ 2>/dev/null || true

# 5) Expose the port Cloud Run sends traffic to
EXPOSE 8080

# 6) Start the Bun API/static server
CMD ["bun", "run", "server.ts"]
