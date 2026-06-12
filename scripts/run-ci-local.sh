#!/usr/bin/env bash
# Run the same checks as .github/workflows/ci.yml locally.
#
# Uses Docker Compose for Postgres/matcher/backend — avoids macOS Homebrew
# Postgres on localhost:5432 (role "postgres" does not exist there).
#
# Usage:
#   ./scripts/run-ci-local.sh

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-$ROOT/venv/bin/python}"
if [[ ! -x "$PYTHON" ]]; then
  PYTHON=python3
fi

cleanup() {
  # Leave stack running by default; set CI_STOP_STACK=1 to tear down backend after smoke.
  if [[ "${CI_STOP_STACK:-0}" == "1" ]]; then
    docker compose stop backend 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "==> Docker: postgres + matcher"
docker compose up -d postgres matcher

for i in $(seq 1 45); do
  if docker compose exec -T postgres pg_isready -U postgres -d volunteer_matcher >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker compose exec -T postgres pg_isready -U postgres -d volunteer_matcher

docker compose exec -T postgres psql -U postgres -d volunteer_matcher \
  -c "CREATE EXTENSION IF NOT EXISTS postgis;" >/dev/null

echo "==> Matcher on :8000"
if ! curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
  for i in $(seq 1 30); do
    curl -sf http://127.0.0.1:8000/health >/dev/null && break
    sleep 1
  done
fi
curl -sf http://127.0.0.1:8000/health >/dev/null \
  || { echo "FAIL: matcher not healthy on :8000"; exit 1; }

echo "==> test_matcher.py"
cd matcher_service
"$PYTHON" test_matcher.py
cd "$ROOT"

echo "==> backend e2e (docker network)"
"$ROOT/scripts/run-e2e.sh"

echo "==> backend container for HTTP smoke (SEED=true for demo users)"
SEED=true HEALTH_CHECK_MATCHER=true docker compose up -d --build backend

for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:3000/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
curl -sf http://127.0.0.1:3000/health >/dev/null \
  || { echo "FAIL: backend /health not ready on :3000"; docker compose logs backend --tail 40; exit 1; }

echo "==> smoke scripts"
./scripts/smoke-api.sh
./scripts/smoke-match-algorithms.sh

echo "==> All CI checks passed locally"
