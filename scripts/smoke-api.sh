#!/usr/bin/env bash
# Smoke checks against a running backend (e.g. docker compose: backend on :3000).
# Usage: ./scripts/smoke-api.sh
#        API_BASE=http://localhost:3000 ./scripts/smoke-api.sh

set -euo pipefail
BASE="${API_BASE:-http://localhost:3000}"

die() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK  $*"; }

json_post() {
  curl -sS -X POST "$1" -H "Content-Type: application/json" -d "$2"
}

echo "Smoke API @ $BASE"

# 1) Unauthorized
code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/tasks")"
[[ "$code" == "401" ]] || die "GET /tasks without auth expected 401, got $code"
ok "GET /tasks → 401 without token"

# 2) Bad login
code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_shelter","password":"nope"}')"
[[ "$code" == "401" ]] || die "bad login expected 401, got $code"
ok "POST /auth/login wrong password → 401"

# 3) Good login
login="$(json_post "$BASE/auth/login" '{"username":"demo_shelter","password":"demo123"}')"
token="$(echo "$login" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)"
[[ -n "$token" ]] || die "no access_token in login response"
ok "POST /auth/login demo_shelter → token"

# 4) List tasks with token
code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/tasks" -H "Authorization: Bearer $token")"
[[ "$code" == "200" ]] || die "GET /tasks with token expected 200, got $code"
ok "GET /tasks with Bearer → 200"

# 5) Register (unique user)
u="smoke_$(date +%s)"
reg="$(json_post "$BASE/auth/register" "{\"username\":\"$u\",\"password\":\"smokepass1\",\"display_name\":\"Smoke User\",\"role\":\"volunteer\"}")"
rt="$(echo "$reg" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)"
[[ -n "$rt" ]] || die "register failed: $reg"
ok "POST /auth/register → token ($u)"

echo "All smoke checks passed."
