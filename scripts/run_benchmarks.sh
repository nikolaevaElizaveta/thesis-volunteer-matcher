#!/usr/bin/env bash
# Full benchmark pipeline for matcher_service.
# - build matcher image
# - run small + constrained + surplus benchmarks
# - generate summary md/json
# - save all artifacts to matcher_service/results/YYYY-MM-DD/
#
# Usage:
#   ./scripts/run_benchmarks.sh
#   SEED=42 RUNS=5 SMALL_TASKS=35 SMALL_OFFERS=20 ./scripts/run_benchmarks.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
RESULTS_DATE="$(date +%F)"
RESULTS_DIR="$ROOT_DIR/matcher_service/results/$RESULTS_DATE"

SEED="${SEED:-42}"
RUNS="${RUNS:-5}"
SMALL_TASKS="${SMALL_TASKS:-35}"
SMALL_OFFERS="${SMALL_OFFERS:-20}"

echo "==> Results directory: $RESULTS_DIR"
mkdir -p "$RESULTS_DIR"

echo "==> Building matcher image"
docker compose -f "$COMPOSE_FILE" build matcher

echo "==> Starting matcher container"
docker compose -f "$COMPOSE_FILE" up -d matcher

echo "==> Waiting matcher readiness on :8000"
docker compose -f "$COMPOSE_FILE" exec -T matcher sh -lc "python - <<'PY'
import sys, time
import requests
url = 'http://127.0.0.1:8000/docs'
for _ in range(60):
    try:
        if requests.get(url, timeout=1).status_code == 200:
            print('ready')
            sys.exit(0)
    except Exception:
        pass
    time.sleep(1)
print('not_ready')
sys.exit(1)
PY"

echo "==> Running SMALL benchmark"
docker compose -f "$COMPOSE_FILE" exec -T matcher \
  python benchmark.py \
    --tasks "$SMALL_TASKS" \
    --offers "$SMALL_OFFERS" \
    --seed "$SEED" \
    --runs "$RUNS" \
    --out benchmark_small.json

echo "==> Running CONSTRAINED scaling benchmark"
docker compose -f "$COMPOSE_FILE" exec -T matcher \
  python benchmark.py \
    --scale-constrained \
    --seed "$SEED" \
    --out scaling_constrained_results.json

echo "==> Running SURPLUS scaling benchmark"
docker compose -f "$COMPOSE_FILE" exec -T matcher \
  python benchmark.py \
    --scale-surplus \
    --seed "$SEED" \
    --out scaling_results.json

echo "==> Building summary tables (md/json)"
docker compose -f "$COMPOSE_FILE" exec -T matcher \
  python build_summary_table.py

echo "==> Copying artifacts from container"
docker compose -f "$COMPOSE_FILE" cp matcher:/app/matcher_service/benchmark_small.json "$RESULTS_DIR/benchmark_small.json"
docker compose -f "$COMPOSE_FILE" cp matcher:/app/matcher_service/scaling_constrained_results.json "$RESULTS_DIR/benchmark_constrained.json"
docker compose -f "$COMPOSE_FILE" cp matcher:/app/matcher_service/scaling_results.json "$RESULTS_DIR/benchmark_surplus.json"
docker compose -f "$COMPOSE_FILE" cp matcher:/app/matcher_service/evaluation_summary.json "$RESULTS_DIR/evaluation_summary.json"
docker compose -f "$COMPOSE_FILE" cp matcher:/app/matcher_service/evaluation_summary.md "$RESULTS_DIR/evaluation_summary.md"

echo "==> Done"
echo "Artifacts saved to: $RESULTS_DIR"
ls -1 "$RESULTS_DIR"
