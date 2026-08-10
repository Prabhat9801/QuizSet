#!/bin/sh
# Runs at container start, when Render's real PORT env var is actually present.
# `vite build` needs it — vite.config.ts reads process.env.PORT at config-eval
# time, before Vite even knows whether it's building or serving. See the
# Dockerfile's top comment for why this can't happen during `docker build`.
set -e

if [ -z "$PORT" ]; then
  echo "ERROR: PORT is not set." >&2
  echo "Render sets this automatically for every Web Service. Running locally? Pass -e PORT=5173." >&2
  exit 1
fi

# Same "do it at container start, not at docker build time" reasoning as the
# frontend build below: DATABASE_URL is a runtime env var injected by Render
# into the running container, never visible during `docker build`. drizzle.config.ts
# (lib/db/drizzle.config.ts) throws immediately if DATABASE_URL is missing, so this
# genuinely could not run any earlier than this point.
#
# No backend depends on this yet (frontend-only app today, per the Dockerfile's
# top comment), so a deploy with no DATABASE_URL configured is a valid, supported
# case — skip the migration instead of failing the whole container.
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

echo "Building QuizSet (PORT=$PORT, BASE_PATH=$BASE_PATH)..."
pnpm --filter @workspace/quizset run build

echo "Serving artifacts/quizset/dist/public on port $PORT..."
exec serve -s artifacts/quizset/dist/public -l "$PORT"
