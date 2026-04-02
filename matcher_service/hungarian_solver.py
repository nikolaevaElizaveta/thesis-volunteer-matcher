from typing import List, Tuple, Dict
import numpy as np
from scipy.optimize import linear_sum_assignment
from datetime import datetime
from schema import ShelterTask, VolunteerOffer, Match, haversine_km, time_overlap


def hungarian_match(tasks: List[ShelterTask], offers: List[VolunteerOffer]) -> List[Match]:
    """
    Match tasks and offers optimally (min total distance) using the Hungarian algorithm (Kuhn-Munkres).
    Only feasible pairs are assigned a finite cost; others set to np.inf to forbid pairing.
    Strict open-interval logic, spatial and skill constraints apply as in baseline.
    """
    if not tasks or not offers:
        return []
    
    n, m = len(tasks), len(offers)
    # Use large finite penalty instead of np.inf so solver prefers feasible edges
    # (scipy linear_sum_assignment can behave badly with inf and yield 0 real matches)
    INF = 1e10
    cost_matrix = np.full((n, m), INF)

    # Build feasible cost matrix (distance if all constraints satisfied, INF otherwise)
    for i, task in enumerate(tasks):
        task_start = datetime.fromisoformat(task.time_window.start)
        task_end = datetime.fromisoformat(task.time_window.end)
        for j, offer in enumerate(offers):
            if not set(task.required_skills).issubset(set(offer.skills)):
                continue
            feasible_time = any(
                time_overlap(
                    task_start,
                    task_end,
                    datetime.fromisoformat(a.start),
                    datetime.fromisoformat(a.end)
                )
                for a in offer.availability
            )
            if not feasible_time:
                continue
            dist = haversine_km(
                task.location.lat,
                task.location.lon,
                offer.location.lat,
                offer.location.lon
            )
            if dist > offer.max_distance_km:
                continue
            cost_matrix[i, j] = dist

    # Check if any feasible pairs exist
    if np.all(cost_matrix >= INF):
        return []

    # Solve assignment (solver prefers finite costs over INF)
    try:
        row_ind, col_ind = linear_sum_assignment(cost_matrix)
        matches = []
        for i, j in zip(row_ind, col_ind):
            if cost_matrix[i, j] < INF:
                matches.append(Match(
                    shelter_task_id=tasks[i].id,
                    volunteer_offer_id=offers[j].id,
                    score=1/(1 + cost_matrix[i, j])
                ))
        return matches
    except Exception:
        return []


def max_coverage_match(tasks: List[ShelterTask], offers: List[VolunteerOffer]) -> List[Match]:
    """
    This algorithm prioritizes maximizing task coverage by allowing assignment flexibility
    through dummy nodes, then minimizes distance.

    Primary objective: maximize the number of real task–offer matches.
    Secondary: among maximum-cardinality solutions, minimize total distance.

    Feasibility (skill subset, strict time overlap, distance <= max_distance_km) matches the
    existing Hungarian setup. Infeasible cells use INF; padded dummy rows/columns use a
    large penalty below INF so the solver prefers real edges, then dummies, never infeasible
    pairs when avoidable.
    """
    if not tasks or not offers:
        return []

    INF = 1e9
    DUMMY = 1e5
    n, m = len(tasks), len(offers)
    S = max(n, m)
    cost_matrix = np.full((S, S), INF)

    for i, task in enumerate(tasks):
        task_start = datetime.fromisoformat(task.time_window.start)
        task_end = datetime.fromisoformat(task.time_window.end)
        for j, offer in enumerate(offers):
            if not set(task.required_skills).issubset(set(offer.skills)):
                continue
            feasible_time = any(
                time_overlap(
                    task_start,
                    task_end,
                    datetime.fromisoformat(a.start),
                    datetime.fromisoformat(a.end),
                )
                for a in offer.availability
            )
            if not feasible_time:
                continue
            dist = haversine_km(
                task.location.lat,
                task.location.lon,
                offer.location.lat,
                offer.location.lon,
            )
            if dist > offer.max_distance_km:
                continue
            cost_matrix[i, j] = dist

    if n > m:
        for i in range(n):
            for j in range(m, S):
                cost_matrix[i, j] = DUMMY
    elif m > n:
        for i in range(n, S):
            for j in range(m):
                cost_matrix[i, j] = DUMMY

    if np.all(cost_matrix[0:n, 0:m] >= INF):
        return []

    try:
        row_ind, col_ind = linear_sum_assignment(cost_matrix)
        matches: List[Match] = []
        for i, j in zip(row_ind, col_ind):
            if i >= n or j >= m:
                continue
            if cost_matrix[i, j] >= INF:
                continue
            c = cost_matrix[i, j]
            matches.append(
                Match(
                    shelter_task_id=tasks[i].id,
                    volunteer_offer_id=offers[j].id,
                    score=1 / (1 + c),
                )
            )
        return matches
    except Exception:
        return []


def _collect_feasible_edges(
    tasks: List[ShelterTask], offers: List[VolunteerOffer]
) -> List[Tuple[int, int, float]]:
    """All (task_index, offer_index, distance_km) satisfying same rules as Hungarian."""
    edges: List[Tuple[int, int, float]] = []
    for i, task in enumerate(tasks):
        task_start = datetime.fromisoformat(task.time_window.start)
        task_end = datetime.fromisoformat(task.time_window.end)
        for j, offer in enumerate(offers):
            if not set(task.required_skills).issubset(set(offer.skills)):
                continue
            feasible_time = any(
                time_overlap(
                    task_start,
                    task_end,
                    datetime.fromisoformat(a.start),
                    datetime.fromisoformat(a.end),
                )
                for a in offer.availability
            )
            if not feasible_time:
                continue
            dist = haversine_km(
                task.location.lat,
                task.location.lon,
                offer.location.lat,
                offer.location.lon,
            )
            if dist > offer.max_distance_km:
                continue
            edges.append((i, j, dist))
    return edges


def _adjacency_for_threshold(
    edges: List[Tuple[int, int, float]], n_tasks: int, D: float
) -> List[List[int]]:
    adj: List[List[int]] = [[] for _ in range(n_tasks)]
    for i, j, d in edges:
        if d <= D:
            adj[i].append(j)
    return adj


def _bipartite_max_matching(
    adj: List[List[int]], n_offers: int
) -> Tuple[int, List[int]]:
    """
    Kuhn augmenting-path algorithm. adj[task_i] = offer indices.
    Returns (matching_size, match_to_offer) where match_to_offer[j] = task i or -1.
    """
    match_to_offer = [-1] * n_offers

    def dfs(task_i: int, seen: List[bool]) -> bool:
        for offer_j in adj[task_i]:
            if seen[offer_j]:
                continue
            seen[offer_j] = True
            if match_to_offer[offer_j] < 0 or dfs(match_to_offer[offer_j], seen):
                match_to_offer[offer_j] = task_i
                return True
        return False

    for task_i in range(len(adj)):
        seen = [False] * n_offers
        dfs(task_i, seen)

    cnt = sum(1 for x in match_to_offer if x >= 0)
    return cnt, match_to_offer


def bottleneck_match(tasks: List[ShelterTask], offers: List[VolunteerOffer]) -> List[Match]:
    """
    Minimize the maximum distance among assigned pairs (bottleneck objective).

    Among all one-to-one matchings that maximize cardinality under feasibility
    (skills subset, strict time overlap, distance <= max_distance_km), pick the
    smallest threshold D such that a matching of that size exists using only
    edges with distance <= D. Then return one such maximum matching.

    Implementation: collect feasible edges, binary search D over sorted distinct
    distances, each step tests maximum bipartite matching size on the subgraph
    of edges with distance <= D.
    """
    if not tasks or not offers:
        return []

    edges = _collect_feasible_edges(tasks, offers)
    if not edges:
        return []

    n, m = len(tasks), len(offers)
    full_adj = _adjacency_for_threshold(edges, n, float("inf"))
    max_size, _ = _bipartite_max_matching(full_adj, m)
    if max_size == 0:
        return []

    dist_vals = sorted({d for (_, _, d) in edges})
    lo, hi = 0, len(dist_vals) - 1
    best_D = dist_vals[-1]
    while lo <= hi:
        mid = (lo + hi) // 2
        D_try = dist_vals[mid]
        adj = _adjacency_for_threshold(edges, n, D_try)
        sz, _ = _bipartite_max_matching(adj, m)
        if sz == max_size:
            best_D = D_try
            hi = mid - 1
        else:
            lo = mid + 1

    final_adj = _adjacency_for_threshold(edges, n, best_D)
    _, match_to_offer = _bipartite_max_matching(final_adj, m)

    pair_dist: Dict[Tuple[int, int], float] = {}
    for i, j, d in edges:
        pair_dist[(i, j)] = d

    matches: List[Match] = []
    for j in range(m):
        i = match_to_offer[j]
        if i < 0:
            continue
        dist = pair_dist.get((i, j))
        if dist is None:
            continue
        matches.append(
            Match(
                shelter_task_id=tasks[i].id,
                volunteer_offer_id=offers[j].id,
                score=1 / (1 + dist),
            )
        )
    return matches