#!/usr/bin/env bash
# Backend e2e tests against the Docker Compose network (Postgres + matcher).
# Avoids macOS/Homebrew Postgres stealing localhost:5432.
#
# Usage:
#   ./scripts/run-e2e.sh

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Ensuring postgres + matcher are up"
docker compose up -d postgres matcher

for i in $(seq 1 45); do
  if docker compose exec -T postgres pg_isready -U postgres -d volunteer_matcher >/dev/null 2>&1 \
    && curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker compose exec -T postgres psql -U postgres -d volunteer_matcher \
  -c "CREATE EXTENSION IF NOT EXISTS postgis;" >/dev/null

PG_CID="$(docker compose ps -q postgres 2>/dev/null || true)"
if [[ -n "$PG_CID" ]]; then
  NETWORK="$(docker inspect "$PG_CID" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' | head -1)"
fi
if [[ -z "${NETWORK:-}" ]]; then
  NETWORK="$(basename "$ROOT")_default"
fi

echo "==> Running backend e2e on docker network: $NETWORK"
docker run --rm \
  --network "$NETWORK" \
  -e DATABASE_URL=postgresql://postgres:postgres@postgres:5432/volunteer_matcher \
  -e MATCHER_URL=http://matcher:8000 \
  -e SEED=true \
  -e JWT_SECRET=e2e_jwt_secret_at_least_8_chars \
  -e TYPEORM_SYNCHRONIZE=true \
  -e HEALTH_CHECK_MATCHER=false \
  -v "$ROOT/backend:/app" \
  -w /app \
  node:20-bookworm-slim \
  bash -lc "npm ci && npm run test:e2e"

echo "==> E2E passed"
