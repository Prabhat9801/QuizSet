# QuizSet — single Render Web Service serving BOTH the frontend and the real
# backend from one container/process. The Express api-server (artifacts/api-server)
# serves the built quizset SPA (artifacts/quizset/dist/public) via STATIC_DIR
# (see app.ts) and answers /api/* itself — no nginx, no second service, no
# cross-origin base-URL wiring needed on the frontend.
#
# Two build-time traps this Dockerfile deliberately avoids:
#
# 1. vite.config.ts THROWS at config-eval time — before `vite build` even starts —
#    if PORT or BASE_PATH env vars are missing (artifacts/quizset/vite.config.ts:8-28),
#    and the frontend also needs VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY *inlined*
#    at build time (Vite bakes import.meta.env.VITE_* into the bundle — it can't
#    read them at runtime). Render's Web Service (Docker) dashboard "Environment
#    Variables" panel only reaches the RUNNING container, never `docker build`.
#    So if `vite build` ran during `docker build`, all of these would be empty/unset
#    and the build would either fail outright (PORT/BASE_PATH) or silently ship a
#    dead "setup needed" bundle (VITE_SUPABASE_*) — see docs/PROJECT_HISTORY.md's
#    "build-time env var trap" entries; this has bitten this project's sibling repos
#    twice already.
#    Fix: `pnpm install` (no env vars needed) happens at build time and is cached;
#    the actual `vite build` + backend build + server start all happen at CONTAINER
#    START via docker-entrypoint.sh, by which point every real env var Render
#    injects into the running container is genuinely present.
#
# 2. pnpm-workspace.yaml's `overrides` explicitly strip the musl (Alpine) native
#    binaries for lightningcss / @tailwindcss/oxide, keeping only the glibc
#    (Debian/Ubuntu) ones. This MUST run on a glibc base image, not
#    node:*-alpine, or those native bindings fail to load at build time.
#
# BASE_PATH never needs to vary for this deploy (always served from the domain
# root), so it's hardcoded below rather than left for the Render dashboard.

FROM node:20-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copying the whole repo before `pnpm install` (rather than manifest-only layer
# caching) is deliberate: this is a pnpm workspace where artifacts/quizset and
# artifacts/api-server depend on workspace:* packages under lib/, so a partial
# copy risks a subtly incomplete install. Simplicity over marginal build-cache
# speed here.
COPY . .
RUN pnpm install --frozen-lockfile

RUN chmod +x docker-entrypoint.sh

ENV BASE_PATH=/
# Documentation only — Render's own PORT value (injected at runtime) is what
# actually governs the bound port, not this line.
EXPOSE 10000

ENTRYPOINT ["./docker-entrypoint.sh"]
