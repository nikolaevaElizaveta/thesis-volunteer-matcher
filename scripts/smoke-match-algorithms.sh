#!/usr/bin/env bash
# E2E smoke test: run all matching algorithms through BACKEND /match endpoint.
# Requires running stack (backend + matcher + db), demo seed user "coordinator"/"demo123".
#
# Usage:
#   ./scripts/smoke-match-algorithms.sh
#   API_BASE=http://localhost:3000 ./scripts/smoke-match-algorithms.sh
#
# Optional:
#   KEEP_ASSIGNMENTS=1 ./scripts/smoke-match-algorithms.sh

set -euo pipefail

BASE="${API_BASE:-http://localhost:3000}"
KEEP_ASSIGNMENTS="${KEEP_ASSIGNMENTS:-0}"
ALGORITHMS=("greedy" "hungarian" "max_coverage" "bottleneck")

die() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK  $*"; }

json_post() {
  curl -sS -X POST "$1" -H "Content-Type: application/json" ${2:+-H "$2"} -d "$3"
}

post_with_code() {
  # prints body + last line as HTTP code
  curl -sS -X POST "$1" -H "Content-Type: application/json" ${2:+-H "$2"} -d "$3" -w '\n%{http_code}'
}

echo "Smoke matching via backend @ $BASE"

# 1) Login as coordinator
login_raw="$(post_with_code "$BASE/auth/login" "" '{"username":"coordinator","password":"demo123"}')"
login_code="$(echo "$login_raw" | tail -n 1)"
login="$(echo "$login_raw" | sed '$d')"
[[ "$login_code" == "200" ]] || die "coordinator login expected 200, got $login_code: $login"
token="$(echo "$login" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)"
[[ -n "$token" ]] || die "login failed for coordinator: $login"
auth_header="Authorization: Bearer $token"
ok "POST /auth/login coordinator -> token"

# 2) Clear old assignments unless explicitly preserved
if [[ "$KEEP_ASSIGNMENTS" != "1" ]]; then
  code="$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE "$BASE/assignments" -H "$auth_header")"
  [[ "$code" == "200" ]] || die "DELETE /assignments expected 200, got $code"
  ok "DELETE /assignments -> 200"
fi

# 3) Run all algorithms through backend /match, assert response shape
for alg in "${ALGORITHMS[@]}"; do
  body="{\"algorithm\":\"$alg\"}"
  raw="$(post_with_code "$BASE/match" "$auth_header" "$body")"
  code="$(echo "$raw" | tail -n 1)"
  resp="$(echo "$raw" | sed '$d')"
  if [[ "$code" != "200" && "$code" != "201" ]]; then
    die "POST /match $alg expected 200/201, got $code: $resp"
  fi
  python3 - "$alg" "$resp" <<'PY'
import json, sys
alg = sys.argv[1]
payload = sys.argv[2]
try:
    data = json.loads(payload)
except Exception as e:
    raise SystemExit(f"invalid JSON for {alg}: {e}")
if not isinstance(data, dict):
    raise SystemExit(f"response for {alg} is not object")
matches = data.get("matches")
if not isinstance(matches, list):
    raise SystemExit(f"response for {alg} has no list 'matches'")
print(f"{alg}: matches={len(matches)}")
PY
  ok "POST /match algorithm=$alg"
done

echo "All matching algorithm smoke checks passed."
