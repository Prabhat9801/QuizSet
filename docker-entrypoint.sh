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

echo "Building QuizSet (PORT=$PORT, BASE_PATH=$BASE_PATH)..."
pnpm --filter @workspace/quizset run build

echo "Serving artifacts/quizset/dist/public on port $PORT..."
exec serve -s artifacts/quizset/dist/public -l "$PORT"
