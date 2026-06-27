#!/usr/bin/env bash
# Griskus — deploy to Namecheap shared hosting via git push + SSH
# Usage: ./deploy.sh
# Prereqs: .env.deploy exists (copy .env.deploy.example and fill in your values)
set -euo pipefail

# ── Load deploy config ────────────────────────────────────────────────────────
if [ ! -f .env.deploy ]; then
  echo "✗  Missing .env.deploy — copy .env.deploy.example and fill in your SSH credentials."
  exit 1
fi

# shellcheck disable=SC1091
source .env.deploy

: "${SSH_HOST:?SSH_HOST is required in .env.deploy}"
: "${SSH_USER:?SSH_USER is required in .env.deploy}"
: "${REMOTE_PATH:?REMOTE_PATH is required in .env.deploy}"
: "${SSH_KEY:?SSH_KEY is required in .env.deploy}"

SSH_PORT="${SSH_PORT:-21098}"
SSH_OPTS="-i ${SSH_KEY} -p ${SSH_PORT} -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
DEPLOY_REMOTE="ssh://${SSH_USER}@${SSH_HOST}:${SSH_PORT}/home/${SSH_USER}/repos/griskus.git"

# ── Build the React frontend ──────────────────────────────────────────────────
echo "▶  Building frontend…"
(cd frontend && VITE_BASE_PATH=/griskus VITE_API_BASE=/griskus npm run build)

# Commit the freshly-built dist so the server always gets the correctly-built
# assets. Without this, a manually-committed dist (built without the env vars)
# would ship broken API paths.
if ! git diff --quiet frontend/dist/; then
  echo "▶  Committing updated dist…"
  git add frontend/dist/
  git commit -m "chore: rebuild dist for deploy ($(date +%Y-%m-%d))"
fi

# ── Push to GitHub + server ───────────────────────────────────────────────────
echo "▶  Pushing to GitHub…"
git push origin main

echo "▶  Pushing to ${SSH_HOST}…"
GIT_SSH_COMMAND="ssh ${SSH_OPTS}" git push deploy main

# ── Install server deps + restart ─────────────────────────────────────────────
echo "▶  Installing backend dependencies on remote…"
# shellcheck disable=SC2029
ssh ${SSH_OPTS} "${SSH_USER}@${SSH_HOST}" "
  set -e
  cd ${REMOTE_PATH}/backend
  npm ci --omit=dev
  cd ${REMOTE_PATH}
  mkdir -p tmp && touch tmp/restart.txt
  echo '✓  Server restarted'
"

echo ""
echo "✓  Done. The app should be live in a few seconds."
