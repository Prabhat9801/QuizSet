#!/bin/sh
# Runs at container start, when Render's real env vars are actually present.
# vite.config.ts reads PORT/BASE_PATH at config-eval time, before Vite even
# knows whether it's building or serving, and Vite inlines VITE_SUPABASE_*/
# VITE_API_URL into the bundle at build time — none of that can happen any
# earlier than this point on Render. See the Dockerfile's top comment.
set -e

if [ -z "$PORT" ]; then
  echo "ERROR: PORT is not set." >&2
  echo "Render sets this automatically for every Web Service. Running locally? Pass -e PORT=8090." >&2
  exit 1
fi

# DATABASE_URL is a runtime env var injected by Render into the running
# container, never visible during `docker build`. drizzle.config.ts
# (lib/db/drizzle.config.ts) throws immediately if DATABASE_URL is missing, so
# this genuinely could not run any earlier than this point.
#
# Deliberately `push`, not `push-force`: this runs unattended against a
# possibly-non-empty production database. `push` stops and waits on ambiguous
# schema changes (e.g. a rename it can't distinguish from a drop+add) instead of
# guessing; `push-force` would auto-confirm those prompts, which is not safe to
# do unattended. If this step ever hangs, that's drizzle-kit correctly refusing
# to guess — resolve the ambiguity by hand, don't switch to push-force.
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set — skipping database schema push."
else
  echo "Applying database schema (pnpm --filter @workspace/db run push)..."
  pnpm --filter @workspace/db run push
  echo "Database schema push complete."
fi

# The frontend calls the backend at the SAME origin it's served from (this one
# container answers both), so VITE_API_URL is always the empty string here —
# main.tsx's `if (apiUrl)` guard then leaves the api-client's base URL unset,
# and every /api/... request naturally resolves as same-origin. No need to
# know this container's own public Render URL in advance.
echo "Building QuizSet frontend (PORT=$PORT, BASE_PATH=$BASE_PATH)..."
VITE_API_URL= pnpm --filter @workspace/quizset run build

echo "Building QuizSet api-server..."
pnpm --filter @workspace/api-server run build

echo "Starting combined frontend+backend on port $PORT..."
export STATIC_DIR="/app/artifacts/quizset/dist/public"
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
