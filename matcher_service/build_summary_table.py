"""
Build a unified evaluation summary table from scaling JSON results.

Reads:
  - scaling_results.json            (surplus scenario, offers >= tasks)
  - scaling_constrained_results.json (constrained scenario, tasks > offers)

Outputs:
  - Formatted table to stdout
  - evaluation_summary.json   (structured, machine-readable)
  - evaluation_summary.md     (markdown table for thesis)

Usage:
  python3 build_summary_table.py
"""

import json
from typing import List, Dict, Any

SCENARIOS = [
    ("surplus", "scaling_results.json"),
    ("constrained", "scaling_constrained_results.json"),
]

ALGORITHMS = ["greedy", "hungarian", "max_coverage", "bottleneck"]


def load_rows() -> List[Dict[str, Any]]:
    """Load both JSON files and flatten into a list of row dicts."""
    rows = []
    for scenario, path in SCENARIOS:
        with open(path) as f:
            data = json.load(f)
        for entry in data["sizes"]:
            size = f"{entry['tasks']}/{entry['offers']}"
            for alg in ALGORITHMS:
                if alg not in entry:
                    continue
                m = entry[alg]
                rows.append({
                    "scenario": scenario,
                    "size": size,
                    "tasks": entry["tasks"],
                    "offers": entry["offers"],
                    "algorithm": alg,
                    "coverage_pct": m.get("task_coverage_pct"),
                    "total_distance_km": m.get("total_distance_km"),
                    "max_distance_km": m.get("max_distance_km"),
                    "avg_distance_km": m.get("avg_distance_km"),
                    "time_ms": m.get("time_ms_avg"),
                })
    return rows


def print_table(rows: List[Dict[str, Any]]):
    hdr = (f"{'Scenario':<14} {'Size':<10} {'Algorithm':<12} "
           f"{'Coverage':>9} {'TotalDist':>11} {'MaxDist':>10} {'AvgDist':>10} {'Runtime':>10}")
    sep = "-" * len(hdr)
    print(sep)
    print(hdr)
    print(sep)
    for r in rows:
        cov = f"{r['coverage_pct']:.1f}%" if r["coverage_pct"] is not None else "N/A"
        td = f"{r['total_distance_km']:.1f}" if r["total_distance_km"] is not None else "N/A"
        md = f"{r['max_distance_km']:.2f}" if r["max_distance_km"] is not None else "N/A"
        ad = f"{r['avg_distance_km']:.2f}" if r["avg_distance_km"] is not None else "N/A"
        rt = f"{r['time_ms']:.2f}ms" if r["time_ms"] is not None else "N/A"
        print(f"{r['scenario']:<14} {r['size']:<10} {r['algorithm']:<12} "
              f"{cov:>9} {td:>11} {md:>10} {ad:>10} {rt:>10}")
    print(sep)


def save_markdown(rows: List[Dict[str, Any]], path: str):
    lines = [
        "| Scenario | Size | Algorithm | Coverage | Total Dist (km) | Max Dist (km) | Avg Dist (km) | Runtime (ms) |",
        "|----------|------|-----------|----------|-----------------|---------------|---------------|--------------|",
    ]
    for r in rows:
        cov = f"{r['coverage_pct']:.1f}%" if r["coverage_pct"] is not None else "N/A"
        td = f"{r['total_distance_km']:.1f}" if r["total_distance_km"] is not None else "N/A"
        md = f"{r['max_distance_km']:.2f}" if r["max_distance_km"] is not None else "N/A"
        ad = f"{r['avg_distance_km']:.2f}" if r["avg_distance_km"] is not None else "N/A"
        rt = f"{r['time_ms']:.2f}" if r["time_ms"] is not None else "N/A"
        lines.append(
            f"| {r['scenario']:<12} "
            f"| {r['size']:<9} "
            f"| {r['algorithm']:<9} "
            f"| {cov:>8} "
            f"| {td:>15} "
            f"| {md:>13} "
            f"| {ad:>13} "
            f"| {rt:>12} |"
        )
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


def main():
    rows = load_rows()

    print_table(rows)

    # Structured JSON
    with open("evaluation_summary.json", "w") as f:
        json.dump(rows, f, indent=2)
    print(f"\nJSON  -> evaluation_summary.json")

    # Markdown table
    save_markdown(rows, "evaluation_summary.md")
    print(f"MD    -> evaluation_summary.md")


if __name__ == "__main__":
    main()
