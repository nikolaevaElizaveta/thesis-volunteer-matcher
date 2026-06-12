"""
Canonical matcher integration tests (HTTP against :8000).

Usage:
  cd matcher_service && python3 test_matcher.py
"""

import json
import os
import sys

import requests

ALGORITHMS = ["greedy", "hungarian", "max_coverage", "bottleneck"]

TEST_CASES = [
    (
        "examples/test_case_0_trivial_input.json",
        "examples/test_case_0_trivial_expected_matches.json",
    ),
    (
        "examples/test_case_1_input.json",
        "examples/test_case_1_expected_matches.json",
    ),
    (
        "examples/test_case_2_conflict_input.json",
        "examples/test_case_2_conflict_expected_matches.json",
    ),
    (
        "examples/test_case_3_impossible_input.json",
        "examples/test_case_3_impossible_expected_matches.json",
    ),
]

MATCH_URL = os.environ.get("MATCHER_URL", "http://localhost:8000/match")
HEALTH_URL = os.environ.get("MATCHER_HEALTH_URL", "http://localhost:8000/health")


def run_test(input_path, expected_path, base_payload, alg, url=MATCH_URL):
    payload = dict(base_payload)
    payload["algorithm"] = alg
    resp = requests.post(url, json=payload, timeout=30)
    resp.raise_for_status()
    result = resp.json()
    with open(expected_path) as f:
        expected = json.load(f)
    actual_pairs = {
        (m["shelter_task_id"], m["volunteer_offer_id"]) for m in result["matches"]
    }
    expected_pairs = {
        (m["shelter_task_id"], m["volunteer_offer_id"]) for m in expected["matches"]
    }
    ok = actual_pairs == expected_pairs
    label = f"{os.path.basename(input_path)} [{alg}]"
    print(f"Test {label}: {'PASS' if ok else 'FAIL'}")
    if not ok:
        print("  Expected:", expected_pairs)
        print("  Got     :", actual_pairs)
    elif actual_pairs:
        dists = [m.get("score") for m in result["matches"] if m.get("score")]
        if dists:
            print(f"   Matches: {len(actual_pairs)}; Avg score: {sum(dists) / len(dists):.3f}")
    else:
        print("   No matches (expected).")
    return ok


def main() -> int:
    try:
        health = requests.get(HEALTH_URL, timeout=5)
        health.raise_for_status()
        if health.json().get("status") != "ok":
            print(f"Matcher health unexpected: {health.text}")
            return 1
    except Exception as e:
        print(f"Matcher not reachable at {HEALTH_URL}: {e}")
        print("Start: cd matcher_service && python3 -m uvicorn main:app --port 8000")
        return 1

    failed = 0
    for inp, exp in TEST_CASES:
        with open(inp) as f:
            data = json.load(f)
        for alg in ALGORITHMS:
            try:
                if not run_test(inp, exp, data, alg):
                    failed += 1
            except Exception as e:
                print(f"Test {os.path.basename(inp)} [{alg}] crashed: {e}")
                failed += 1

    total = len(TEST_CASES) * len(ALGORITHMS)
    passed = total - failed
    print(f"\n{passed}/{total} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
