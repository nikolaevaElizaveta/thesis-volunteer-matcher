"""
Formal evaluation benchmark for matching algorithms.

Metrics (computed identically for every algorithm):
  - match_count        : number of assigned pairs
  - task_coverage_pct  : 100 * match_count / total_tasks
  - total_distance_km  : sum of haversine distances for all assigned pairs
  - max_distance_km    : max haversine distance across assigned pairs
  - avg_distance_km    : total_distance_km / match_count  (null if 0 matches)
  - time_ms            : wall-clock time of the HTTP round-trip

Usage:
  # Single run on an existing file
  python3 benchmark.py --input synthetic_input.json

  # Generate synthetic data (fixed seed) and run N times
  python3 benchmark.py --tasks 30 --offers 60 --seed 42 --runs 5

  # Save structured results
  python3 benchmark.py --tasks 20 --offers 50 --runs 3 --out results.json

  # Scaling experiment — surplus offers (2:1 ratio)
  python3 benchmark.py --scale
  python3 benchmark.py --scale --out scaling_results.json

  # Scaling experiment — constrained offers (tasks > offers, ~0.6 ratio)
  python3 benchmark.py --scale-constrained
  python3 benchmark.py --scale-constrained --out constrained_results.json

Requires: matcher service running at http://localhost:8000
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from typing import Any, Dict, List

import numpy as np
import requests  # type: ignore[import-not-found]

from generate_synthetic_data import generate_tasks, generate_offers

ALGORITHMS = ["greedy", "hungarian", "max_coverage", "bottleneck"]
URL = "http://localhost:8000/match"


# ---------------------------------------------------------------------------
# Metric computation (single run, single algorithm)
# ---------------------------------------------------------------------------

def gini_coefficient(values: List[float]) -> float:
    """
    Compute Gini coefficient for a list of non-negative values.
    Returns 0.0 for empty input or zero-sum values.
    """
    if not values:
        return 0.0
    x = sorted(v for v in values if v >= 0)
    n = len(x)
    s = sum(x)
    if n == 0 or s == 0:
        return 0.0
    weighted_sum = sum((i + 1) * xi for i, xi in enumerate(x))
    g = (2.0 * weighted_sum) / (n * s) - (n + 1) / n
    return float(g)


def compute_metrics(payload: dict, algorithm: str) -> Dict[str, Any]:
    """Send payload to matcher and return structured metrics dict."""
    body = {**payload, "algorithm": algorithm}

    t0 = time.perf_counter()
    resp = requests.post(URL, json=body, timeout=60)
    resp.raise_for_status()
    elapsed_ms = (time.perf_counter() - t0) * 1000

    matches = resp.json().get("matches", [])

    n_tasks = len(payload["tasks"])
    n_offers = len(payload["offers"])
    match_count = len(matches)

    # Distance: score = 1/(1+d)  =>  d = (1/score) - 1
    distances = []
    for m in matches:
        s = m.get("score")
        if s and s > 0:
            distances.append((1.0 / s) - 1.0)

    total_distance = sum(distances)
    # Fairness/distribution metrics; edge case (no matches): all zeros.
    if distances:
        avg_distance = total_distance / len(distances)
        max_distance = max(distances)
        distance_std = float(np.std(np.array(distances, dtype=float)))
        gini_distance = gini_coefficient(distances)
    else:
        avg_distance = 0.0
        max_distance = 0.0
        distance_std = 0.0
        gini_distance = 0.0

    return {
        "algorithm": algorithm,
        "total_tasks": n_tasks,
        "total_offers": n_offers,
        "match_count": match_count,
        "task_coverage_pct": round(100 * match_count / n_tasks, 2) if n_tasks else 0,
        "total_distance_km": round(total_distance, 4),
        "max_distance_km": round(max_distance, 4),
        "avg_distance_km": round(avg_distance, 4),
        "distance_std_km": round(distance_std, 4),
        "gini_distance": round(gini_distance, 4),
        "time_ms": round(elapsed_ms, 2),
    }


# ---------------------------------------------------------------------------
# Multi-run aggregation
# ---------------------------------------------------------------------------

def aggregate_runs(run_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate metrics across N runs for one algorithm."""
    n = len(run_results)
    if n == 0:
        return {}

    def avg(key):
        vals = [r[key] for r in run_results if r[key] is not None]
        return round(sum(vals) / len(vals), 4) if vals else None

    return {
        "algorithm": run_results[0]["algorithm"],
        "runs": n,
        "total_tasks": run_results[0]["total_tasks"],
        "total_offers": run_results[0]["total_offers"],
        "match_count_avg": avg("match_count"),
        "task_coverage_pct_avg": avg("task_coverage_pct"),
        "total_distance_km_avg": avg("total_distance_km"),
        "max_distance_km_avg": avg("max_distance_km"),
        "avg_distance_km_avg": avg("avg_distance_km"),
        "distance_std_km_avg": avg("distance_std_km"),
        "gini_distance_avg": avg("gini_distance"),
        "time_ms_avg": avg("time_ms"),
        "time_ms_min": round(min(r["time_ms"] for r in run_results), 2),
        "time_ms_max": round(max(r["time_ms"] for r in run_results), 2),
    }


# ---------------------------------------------------------------------------
# Display
# ---------------------------------------------------------------------------

def print_table(summaries: List[Dict[str, Any]]):
    print()
    print("-" * 146)
    print(
        f"{'Algorithm':<16} {'Runs':<6} {'match_count':>12} {'coverage %':>11} "
        f"{'total_dist_km':>14} {'avg_dist_km':>12} {'std_km':>10} {'gini':>8} "
        f"{'max_dist_km':>12} {'runtime_ms':>12}"
    )
    print("-" * 146)
    for s in summaries:
        ad = f"{s['avg_distance_km_avg']:.3f}" if s["avg_distance_km_avg"] is not None else "N/A"
        sd = f"{s['distance_std_km_avg']:.3f}" if s["distance_std_km_avg"] is not None else "N/A"
        gd = f"{s['gini_distance_avg']:.3f}" if s["gini_distance_avg"] is not None else "N/A"
        md = f"{s['max_distance_km_avg']:.3f}" if s["max_distance_km_avg"] is not None else "N/A"
        print(
            f"{s['algorithm']:<16} {s['runs']:<6} "
            f"{s['match_count_avg']:>12.1f} {s['task_coverage_pct_avg']:>10.1f}% "
            f"{s['total_distance_km_avg']:>14.3f} {ad:>12} {sd:>10} {gd:>8} {md:>12} "
            f"{s['time_ms_avg']:>6.1f} ({s['time_ms_min']:.0f}-{s['time_ms_max']:.0f})"
        )
    print("-" * 146)


# ---------------------------------------------------------------------------
# Scaling experiment
# ---------------------------------------------------------------------------

SCALE_SURPLUS_SIZES = [
    (10, 20),
    (50, 100),
    (100, 200),
    (300, 600),
]

SCALE_CONSTRAINED_SIZES = [
    (50, 30),
    (100, 60),
    (200, 120),
    (400, 240),
]

SCALE_RUNS = 5
SCALE_SEED = 42


def _compact_summary(agg: Dict[str, Any]) -> Dict[str, Any]:
    """Extract the five official metrics from an aggregated result."""
    return {
        "match_count": agg["match_count_avg"],
        "task_coverage_pct": agg["task_coverage_pct_avg"],
        "total_distance_km": agg["total_distance_km_avg"],
        "avg_distance_km": agg["avg_distance_km_avg"],
        "distance_std_km": agg["distance_std_km_avg"],
        "gini_distance": agg["gini_distance_avg"],
        "max_distance_km": agg["max_distance_km_avg"],
        "time_ms_avg": agg["time_ms_avg"],
    }


def run_scaling_experiment(
    sizes: List[tuple],
    experiment_name: str,
    default_out: str,
    seed: int = SCALE_SEED,
    out_path: str = None,
):
    """Run greedy, hungarian, max_coverage, and bottleneck across sizes."""
    base_date = datetime(2026, 2, 10, 8, 0, 0)
    sizes_results = []

    print(f"{experiment_name}  |  seed={seed}  |  runs={SCALE_RUNS}")
    print(f"Sizes: {sizes}")
    print()

    try:
        for n_tasks, n_offers in sizes:
            payload = {
                "tasks": generate_tasks(n_tasks, base_date, seed=seed),
                "offers": generate_offers(n_offers, base_date, seed=seed + 1),
            }

            per_alg: Dict[str, List[Dict[str, Any]]] = {a: [] for a in ALGORITHMS}
            for run_idx in range(SCALE_RUNS):
                for alg in ALGORITHMS:
                    m = compute_metrics(payload, alg)
                    m["run"] = run_idx
                    per_alg[alg].append(m)

            entry = {"tasks": n_tasks, "offers": n_offers}
            for alg in ALGORITHMS:
                entry[alg] = _compact_summary(aggregate_runs(per_alg[alg]))

            sizes_results.append(entry)
            print(f"  {n_tasks:>4} tasks / {n_offers:>4} offers  ...  done")

    except requests.exceptions.ConnectionError:
        print("Error: matcher not reachable at", URL)
        print("Start it: cd matcher_service && python3 -m uvicorn main:app --port 8000")
        sys.exit(1)

    # Print compact table
    print_scaling_table(sizes_results)

    # Structured JSON output
    output = {
        "experiment": experiment_name,
        "seed": seed,
        "runs_per_size": SCALE_RUNS,
        "sizes": sizes_results,
    }

    dest = out_path if out_path else default_out
    with open(dest, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nResults saved to {dest}")


def print_scaling_table(sizes: List[Dict[str, Any]]):
    """Print comparison per size: focus on match_count & total_distance_km for all algorithms."""
    print()
    for s in sizes:
        label = f"{s['tasks']} tasks / {s['offers']} offers"
        print(f"\n{'=' * 72}")
        print(f"  {label}")
        print(f"{'=' * 72}")
        print(
            f"{'Algorithm':<16} {'match_count':>11} {'coverage %':>10} {'total_km':>11} "
            f"{'avg_km':>9} {'std_km':>9} {'gini':>7} {'max_km':>10}"
        )
        print("-" * 72)
        for alg in ALGORITHMS:
            m = s[alg]
            print(
                f"{alg:<16} {m['match_count']:>11.1f} {m['task_coverage_pct']:>9.1f}% "
                f"{m['total_distance_km']:>11.3f} {m['avg_distance_km']:>9.3f} "
                f"{m['distance_std_km']:>9.3f} {m['gini_distance']:>7.3f} "
                f"{m['max_distance_km']:>10.3f}"
            )
        print("-" * 72)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Formal evaluation benchmark for matching algorithms"
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--input", type=str, help="Path to existing input JSON")
    group.add_argument("--tasks", type=int, help="Number of tasks to generate")
    group.add_argument("--scale", action="store_true",
                       help="Scaling experiment — surplus offers (2:1 ratio)")
    group.add_argument("--scale-surplus", action="store_true", dest="scale_surplus",
                       help="Alias for --scale (surplus offers, 2:1 ratio)")
    group.add_argument("--scale-constrained", action="store_true", dest="scale_constrained",
                       help="Scaling experiment — constrained offers (tasks > offers)")

    parser.add_argument("--offers", type=int, default=None, help="Number of offers (default: 2x tasks)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for synthetic data")
    parser.add_argument("--runs", type=int, default=1, help="Number of evaluation runs (same data)")
    parser.add_argument("--out", type=str, default=None, help="Output JSON file for structured results")
    args = parser.parse_args()

    # ----- Scaling modes ------------------------------------------------
    if args.scale or args.scale_surplus:
        run_scaling_experiment(
            sizes=SCALE_SURPLUS_SIZES,
            experiment_name="scaling_analysis",
            default_out="scaling_results.json",
            seed=args.seed,
            out_path=args.out,
        )
        return

    if args.scale_constrained:
        run_scaling_experiment(
            sizes=SCALE_CONSTRAINED_SIZES,
            experiment_name="scaling_constrained",
            default_out="scaling_constrained_results.json",
            seed=args.seed,
            out_path=args.out,
        )
        return

    # ----- Single-size mode ---------------------------------------------
    # Build payload
    if args.input:
        if not os.path.isfile(args.input):
            print(f"File not found: {args.input}")
            sys.exit(1)
        with open(args.input) as f:
            payload = json.load(f)
        payload.pop("algorithm", None)
        source = args.input
    elif args.tasks:
        n_offers = args.offers if args.offers else args.tasks * 2
        base_date = datetime(2026, 2, 10, 8, 0, 0)
        payload = {
            "tasks": generate_tasks(args.tasks, base_date, seed=args.seed),
            "offers": generate_offers(n_offers, base_date, seed=args.seed + 1),
        }
        source = f"synthetic (tasks={args.tasks}, offers={n_offers}, seed={args.seed})"
    else:
        parser.print_help()
        sys.exit(1)

    n_tasks = len(payload["tasks"])
    n_offers = len(payload["offers"])
    print(f"Source: {source}")
    print(f"Data:   {n_tasks} tasks, {n_offers} offers, {args.runs} run(s)")

    # Run
    all_runs: Dict[str, List[Dict[str, Any]]] = {alg: [] for alg in ALGORITHMS}

    try:
        for run_idx in range(args.runs):
            for alg in ALGORITHMS:
                metrics = compute_metrics(payload, alg)
                metrics["run"] = run_idx
                all_runs[alg].append(metrics)
    except requests.exceptions.ConnectionError:
        print("Error: matcher not reachable at", URL)
        print("Start it: cd matcher_service && python3 -m uvicorn main:app --port 8000")
        sys.exit(1)

    # Aggregate and display
    summaries = [aggregate_runs(runs) for runs in all_runs.values()]
    print_table(summaries)

    # Structured output
    output = {
        "source": source,
        "total_tasks": n_tasks,
        "total_offers": n_offers,
        "seed": args.seed if args.tasks else None,
        "runs": args.runs,
        "summaries": summaries,
        "raw_runs": {alg: runs for alg, runs in all_runs.items()},
    }

    if args.out:
        with open(args.out, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\nResults saved to {args.out}")
    else:
        with open("benchmark_results.json", "w") as f:
            json.dump(output, f, indent=2)
        print(f"\nResults saved to benchmark_results.json")


if __name__ == "__main__":
    main()
