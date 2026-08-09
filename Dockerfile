# QuizSet frontend — pnpm workspace monorepo; the real app is artifacts/quizset/.
# Frontend-only for now (no backend yet) — this just needs to serve a static SPA.
#
# Two build-time traps this Dockerfile deliberately avoids:
#
# 1. vite.config.ts THROWS at config-eval time — before `vite build` even starts —
#    if PORT or BASE_PATH env vars are missing (artifacts/quizset/vite.config.ts:8-28).
#    Render's Web Service (Docker) dashboard "Environment Variables" panel only
#    reaches the RUNNING container, never `docker build`. So if `vite build` ran
#    during `docker build`, PORT would be unset and the build would fail outright
#    — the same class of trap already hit and fixed in the sibling quiz-ITI repo.
#    Fix: `pnpm install` (no env vars needed) happens at build time and is cached;
#    the actual `vite build` + serve happens at CONTAINER START via
#    docker-entrypoint.sh, by which point PORT is genuinely present — Render
#    injects it into every running container automatically, no dashboard
#    configuration required for it.
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

# `serve` is a real static-file server with SPA-fallback support (-s), unlike
# `vite preview`, which Vite's own docs say is not meant for production use.
RUN npm install -g serve@14

# Copying the whole repo before `pnpm install` (rather than manifest-only layer
# caching) is deliberate: this is a pnpm workspace where artifacts/quizset
# depends on workspace:* packages under lib/, so a partial copy risks a subtly
# incomplete install. Simplicity over marginal build-cache speed here.
COPY . .
RUN pnpm install --frozen-lockfile

RUN chmod +x docker-entrypoint.sh

ENV BASE_PATH=/
# Documentation only — Render's own PORT value (injected at runtime) is what
# actually governs the bound port, not this line.
EXPOSE 10000

ENTRYPOINT ["./docker-entrypoint.sh"]
