"""
Metrics collection script for algorithm comparison.
Computes match count, average distance, unmatched tasks, and other statistics.
"""

import requests
import json
import os
from typing import Dict, List, Any
import traceback

ALGORITHMS = ["greedy", "hungarian"]
TEST_CASES = [
    "examples/test_case_0_trivial_input.json",
    "examples/test_case_1_input.json",
    "examples/test_case_2_conflict_input.json",
    "examples/test_case_3_impossible_input.json",
]

def compute_distance_from_score(score: float) -> float:
    """Convert score (1/(1+dist)) back to distance in km."""
    if score is None or score == 0:
        return None
    return (1 / score) - 1

def evaluate_algorithm(input_path: str, alg: str, url: str = "http://localhost:8000/match") -> Dict[str, Any]:
    """Run algorithm and collect metrics."""
    with open(input_path) as f:
        payload = json.load(f)
    
    payload["algorithm"] = alg
    resp = requests.post(url, json=payload)
    resp.raise_for_status()
    result = resp.json()
    
    matches = result["matches"]
    tasks = payload["tasks"]
    offers = payload["offers"]
    
    # Basic metrics
    match_count = len(matches)
    total_tasks = len(tasks)
    total_offers = len(offers)
    unmatched_tasks = total_tasks - match_count
    unmatched_offers = total_offers - match_count
    
    # Distance metrics
    distances = []
    scores = []
    for m in matches:
        if m.get("score"):
            scores.append(m["score"])
            dist = compute_distance_from_score(m["score"])
            if dist is not None:
                distances.append(dist)
    
    avg_distance = sum(distances) / len(distances) if distances else None
    total_distance = sum(distances) if distances else 0
    min_distance = min(distances) if distances else None
    max_distance = max(distances) if distances else None
    
    # Coverage metrics
    task_coverage = (match_count / total_tasks * 100) if total_tasks > 0 else 0
    offer_utilization = (match_count / total_offers * 100) if total_offers > 0 else 0
    
    return {
        "algorithm": alg,
        "test_case": os.path.basename(input_path),
        "match_count": match_count,
        "total_tasks": total_tasks,
        "total_offers": total_offers,
        "unmatched_tasks": unmatched_tasks,
        "unmatched_offers": unmatched_offers,
        "task_coverage_pct": round(task_coverage, 2),
        "offer_utilization_pct": round(offer_utilization, 2),
        "avg_distance_km": round(avg_distance, 3) if avg_distance else None,
        "total_distance_km": round(total_distance, 3),
        "min_distance_km": round(min_distance, 3) if min_distance else None,
        "max_distance_km": round(max_distance, 3) if max_distance else None,
    }

def print_metrics_table(results: List[Dict[str, Any]]):
    """Print formatted metrics table."""
    print("\n" + "="*80)
    print("ALGORITHM COMPARISON METRICS")
    print("="*80)
    
    # Group by test case
    by_case = {}
    for r in results:
        case = r["test_case"]
        if case not in by_case:
            by_case[case] = []
        by_case[case].append(r)
    
    for case, metrics_list in by_case.items():
        print(f"\n📊 Test Case: {case}")
        print("-" * 80)
        print(f"{'Metric':<25} {'Greedy':<25} {'Hungarian':<25}")
        print("-" * 80)
        
        # Match count
        greedy_m = next(m for m in metrics_list if m["algorithm"] == "greedy")
        hung_m = next(m for m in metrics_list if m["algorithm"] == "hungarian")
        
        print(f"{'Matches Found':<25} {greedy_m['match_count']:<25} {hung_m['match_count']:<25}")
        print(f"{'Unmatched Tasks':<25} {greedy_m['unmatched_tasks']:<25} {hung_m['unmatched_tasks']:<25}")
        print(f"{'Task Coverage %':<25} {greedy_m['task_coverage_pct']:<25} {hung_m['task_coverage_pct']:<25}")
        print(f"{'Avg Distance (km)':<25} {str(greedy_m['avg_distance_km']):<25} {str(hung_m['avg_distance_km']):<25}")
        print(f"{'Total Distance (km)':<25} {greedy_m['total_distance_km']:<25} {hung_m['total_distance_km']:<25}")
        
        if greedy_m['total_distance_km'] > 0 and hung_m['total_distance_km'] > 0:
            improvement = ((greedy_m['total_distance_km'] - hung_m['total_distance_km']) / greedy_m['total_distance_km']) * 100
            print(f"{'Hungarian Improvement %':<25} {'N/A':<25} {f'{improvement:.1f}%':<25}")

def print_summary(results: List[Dict[str, Any]]):
    """Print summary statistics."""
    print("\n" + "="*80)
    print("SUMMARY STATISTICS")
    print("="*80)
    
    greedy_results = [r for r in results if r["algorithm"] == "greedy"]
    hung_results = [r for r in results if r["algorithm"] == "hungarian"]
    
    def avg(metric):
        g_vals = [r[metric] for r in greedy_results if r[metric] is not None]
        h_vals = [r[metric] for r in hung_results if r[metric] is not None]
        return {
            "greedy": sum(g_vals) / len(g_vals) if g_vals else 0,
            "hungarian": sum(h_vals) / len(h_vals) if h_vals else 0
        }
    
    match_avg = avg("match_count")
    dist_avg = avg("avg_distance_km")
    coverage_avg = avg("task_coverage_pct")
    
    print(f"\nAverage Match Count:")
    print(f"  Greedy:    {match_avg['greedy']:.2f}")
    print(f"  Hungarian: {match_avg['hungarian']:.2f}")
    
    print(f"\nAverage Distance (km):")
    print(f"  Greedy:    {dist_avg['greedy']:.3f}" if dist_avg['greedy'] else "  Greedy:    N/A")
    print(f"  Hungarian: {dist_avg['hungarian']:.3f}" if dist_avg['hungarian'] else "  Hungarian: N/A")
    
    print(f"\nAverage Task Coverage (%):")
    print(f"  Greedy:    {coverage_avg['greedy']:.1f}%")
    print(f"  Hungarian: {coverage_avg['hungarian']:.1f}%")

if __name__ == "__main__":

    print("Starting metrics evaluation...")
    print(f"Testing {len(TEST_CASES)} test cases with {len(ALGORITHMS)} algorithms")
  
    all_results = []
    
    for test_case in TEST_CASES:
        print(f"\nProcessing: {test_case}")
        for alg in ALGORITHMS:
            try:
                print(f"  Running {alg}...", end=" ")
                metrics = evaluate_algorithm(test_case, alg)
                all_results.append(metrics)
                print("✓")
            except requests.exceptions.ConnectionError as e:
                print(f"\n❌ ERROR: Cannot connect to server at http://localhost:8000")
                print("   Make sure the server is running: uvicorn main:app --reload --port 8000")
                exit(1)
            except Exception as e:
                print(f"❌ Error: {e}")
                import traceback
                traceback.print_exc()
    
    if not all_results:
        print("\n❌ No results collected. Check errors above.")
        exit(1)
    
    print_metrics_table(all_results)
    print_summary(all_results)
    
    # Save to JSON for further analysis
    with open("evaluation_results.json", "w") as f:
        json.dump(all_results, f, indent=2)
    print("\n✅ Results saved to evaluation_results.json")