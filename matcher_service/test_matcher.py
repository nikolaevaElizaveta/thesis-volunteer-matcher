import requests
import json
import os

ALGORITHMS = ["greedy", "hungarian"]

TEST_CASES = [
    ("examples/test_case_0_trivial_input.json", "examples/test_case_0_trivial_expected_matches.json"),
    ("examples/test_case_1_input.json", "examples/test_case_1_expected_matches.json"),
    ("examples/test_case_2_conflict_input.json", "examples/test_case_2_conflict_expected_matches.json"),
    ("examples/test_case_3_impossible_input.json", "examples/test_case_3_impossible_expected_matches.json"),
]

def run_test(input_path, expected_path, base_payload, alg, url="http://localhost:8000/match"):
    payload = dict(base_payload)
    payload["algorithm"] = alg
    resp = requests.post(url, json=payload)
    resp.raise_for_status()
    result = resp.json()
    with open(expected_path) as f:
        expected = json.load(f)
    actual_pairs = {(m["shelter_task_id"], m["volunteer_offer_id"]) for m in result["matches"]}
    expected_pairs = {(m["shelter_task_id"], m["volunteer_offer_id"]) for m in expected["matches"]}
    ok = actual_pairs == expected_pairs
    print(f"Test {os.path.basename(input_path)} [{alg}]: {'PASS' if ok else 'FAIL'}")
    if not ok:
        print("  Expected:", expected_pairs)
        print("  Got     :", actual_pairs)
    # Optionally: extra metrics
    if actual_pairs:
        dists = [m.get("score", None) for m in result["matches"] if m.get("score")]
        print(f"   Matches: {len(actual_pairs)}; Avg score: {sum(dists)/len(dists):.3f}" if dists else "")
    else:
        print("   No matches found.")

if __name__ == "__main__":
    for inp, exp in TEST_CASES:
        with open(inp) as f:
            data = json.load(f)
        for alg in ALGORITHMS:
            try:
                run_test(inp, exp, data, alg)
            except Exception as e:
                print(f"Test {os.path.basename(inp)} [{alg}] crashed: {e}")
