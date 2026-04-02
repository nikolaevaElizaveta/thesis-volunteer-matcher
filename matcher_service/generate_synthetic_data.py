"""
Generate synthetic tasks and offers for testing and benchmarking.
Output: JSON file suitable for POST /match (tasks, offers, algorithm).
"""

import json
import random
from datetime import datetime, timedelta

# Bounding box (e.g. city area) in lat/lon
LAT_MIN, LAT_MAX = 59.85, 60.05
LON_MIN, LON_MAX = 30.15, 30.55

SKILLS = ["medical", "logistics", "first_aid", "water", "shelter", "food"]
SPECIAL_REMOTE_SKILL = "rare_remote"

FAR_TASK_RATIO = 0.20
UNIQUE_FAR_TASK_RATIO = 0.08
MAJORITY_VOL_RATIO = 0.80

# Cluster imbalance centers: minority is intentionally far from majority.
MAJORITY_CENTER = {"lat": 59.95, "lon": 30.33}
MINORITY_CENTER = {"lat": 60.05, "lon": 30.53}
CLUSTER_JITTER = 0.02


def random_point():
    return {
        "lat": round(random.uniform(LAT_MIN, LAT_MAX), 4),
        "lon": round(random.uniform(LON_MIN, LON_MAX), 4),
    }


def clustered_point(center: dict, jitter: float = CLUSTER_JITTER):
    return {
        "lat": round(center["lat"] + random.uniform(-jitter, jitter), 4),
        "lon": round(center["lon"] + random.uniform(-jitter, jitter), 4),
    }


def shifted_far_point():
    """
    Produce a "far task" by applying +0.1/+0.1 shift to a random city point.
    """
    p = random_point()
    return {
        "lat": round(p["lat"] + 0.1, 4),
        "lon": round(p["lon"] + 0.1, 4),
    }


def random_time_window(base_date: datetime, length_hours: float = 4):
    start = base_date + timedelta(hours=random.uniform(0, 12))
    end = start + timedelta(hours=length_hours)
    return {
        "start": start.strftime("%Y-%m-%dT%H:%M:%S"),
        "end": end.strftime("%Y-%m-%dT%H:%M:%S"),
    }


def generate_tasks(n: int, base_date: datetime, seed: int = 42):
    random.seed(seed)
    tasks = []
    n_far = int(round(n * FAR_TASK_RATIO))
    n_unique_far = max(1, int(round(n * UNIQUE_FAR_TASK_RATIO))) if n > 0 else 0

    for i in range(n):
        # Unique tasks: only one feasible volunteer via special skill and this volunteer is far.
        is_unique_far = i < n_unique_far
        # Keep 20% additional far tasks as a separate group.
        is_far = n_unique_far <= i < (n_unique_far + n_far)

        if is_unique_far:
            # Place close to majority center so remote specialist (minority cluster) is far.
            loc = clustered_point(MAJORITY_CENTER)
            required_skills = [SPECIAL_REMOTE_SKILL]
        else:
            loc = shifted_far_point() if is_far else random_point()
            required_skills = random.sample(SKILLS, k=random.randint(1, 2))

        tasks.append({
            "id": f"task_{i}",
            "location": loc,
            "required_skills": required_skills,
            "time_window": random_time_window(base_date, length_hours=random.uniform(2, 6)),
        })
    return tasks


def generate_offers(n: int, base_date: datetime, max_dist_km: float = 15, seed: int = 43):
    random.seed(seed)
    offers = []
    if n <= 0:
        return offers

    n_majority = int(round(n * MAJORITY_VOL_RATIO))
    n_majority = min(n_majority, n)

    for i in range(n):
        if i == 0:
            # One remote specialist to create "single feasible volunteer" cases.
            windows = [{
                "start": base_date.strftime("%Y-%m-%dT%H:%M:%S"),
                "end": (base_date + timedelta(hours=18)).strftime("%Y-%m-%dT%H:%M:%S"),
            }]
            skills = [SPECIAL_REMOTE_SKILL, "medical", "logistics"]
            location = clustered_point(MINORITY_CENTER)
            offer_max_dist = max(40.0, max_dist_km)
        else:
            center = MAJORITY_CENTER if i < n_majority else MINORITY_CENTER
            location = clustered_point(center)
            num_windows = random.randint(1, 2)
            windows = [random_time_window(base_date, length_hours=random.uniform(3, 8)) for _ in range(num_windows)]
            skills = random.sample(SKILLS, k=random.randint(2, 4))
            offer_max_dist = max_dist_km

        offers.append({
            "id": f"vol_{i}",
            "location": location,
            "skills": skills,
            "availability": windows,
            "max_distance_km": offer_max_dist,
        })
    return offers


def main():
    import argparse
    p = argparse.ArgumentParser(description="Generate synthetic match input JSON")
    p.add_argument("--tasks", type=int, default=10, help="Number of tasks")
    p.add_argument("--offers", type=int, default=20, help="Number of offers")
    p.add_argument("--seed", type=int, default=42, help="Random seed")
    p.add_argument("--out", type=str, default="synthetic_input.json", help="Output file")
    args = p.parse_args()

    base = datetime(2026, 2, 10, 8, 0, 0)
    payload = {
        "tasks": generate_tasks(args.tasks, base, seed=args.seed),
        "offers": generate_offers(args.offers, base, seed=args.seed + 1),
        "algorithm": "greedy",
    }
    with open(args.out, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"Written {args.tasks} tasks, {args.offers} offers -> {args.out}")


if __name__ == "__main__":
    main()
