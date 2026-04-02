"""
Greedy volunteer matcher for shelters.
Exposes /match endpoint for batch matching of shelter tasks and volunteer offers.
"""

from datetime import datetime
from typing import List

from fastapi import FastAPI, Body
from schema import (
    ShelterTask, VolunteerOffer, Match, MatchRequest, MatchResponse,
    haversine_km, time_overlap
)

# Optional algorithm imports (Hungarian + max_coverage + bottleneck)
try:
    from hungarian_solver import hungarian_match, max_coverage_match, bottleneck_match
except ImportError as e:
    print(f"Warning: Could not import hungarian_solver: {e}")
    hungarian_match = None
    max_coverage_match = None
    bottleneck_match = None
except Exception as e:
    print(f"Warning: Error importing hungarian_solver: {e}")
    hungarian_match = None
    max_coverage_match = None
    bottleneck_match = None

def greedy_match(tasks: List[ShelterTask], offers: List[VolunteerOffer]) -> List[Match]:
    """
    Greedy matching algorithm.
    - Assigns each task to the nearest eligible volunteer (spatial/skill/time constraints).
    - Only intervals with real overlap are assigned (open intervals: max(start1, start2) < min(end1, end2)).
    - Each volunteer can be used only once.
    """
    matches = []
    used_volunteers = set()
    tasks_sorted = sorted(
        tasks,
        key=lambda t: datetime.fromisoformat(t.time_window.start)
    )
    for task in tasks_sorted:
        task_start = datetime.fromisoformat(task.time_window.start)
        task_end = datetime.fromisoformat(task.time_window.end)
        candidates = []
        for offer in offers:
            if offer.id in used_volunteers:
                continue
            # Skill constraint (task req must be subset of offer skills)
            if not set(task.required_skills).issubset(set(offer.skills)):
                continue
            # Time constraint (strict open-interval overlap)
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
            # Spatial constraint
            dist = haversine_km(
                task.location.lat,
                task.location.lon,
                offer.location.lat,
                offer.location.lon
            )
            if dist > offer.max_distance_km:
                continue
            candidates.append((offer, dist))
        if not candidates:
            continue
        best_offer, best_dist = min(candidates, key=lambda x: x[1])
        matches.append(Match(
            shelter_task_id=task.id,
            volunteer_offer_id=best_offer.id,
            score=1 / (1 + best_dist)
        ))
        used_volunteers.add(best_offer.id)
    return matches

# --- FastAPI App and Endpoints ---

app = FastAPI(title="Volunteer Matcher Matching Service", version="0.1.0")

@app.post("/match", response_model=MatchResponse, summary="Batch matching of shelter tasks and volunteer offers")
def match_endpoint(req: MatchRequest = Body(...)):
    """
    Match volunteers to shelter tasks using the specified algorithm.
    Supported: greedy, hungarian, max_coverage, bottleneck.
    """
    if req.algorithm == "greedy":
        matches = greedy_match(req.tasks, req.offers)
        return MatchResponse(matches=matches)
    if req.algorithm == "hungarian":
        if hungarian_match is None:
            raise ValueError("Hungarian solver not available.")
        matches = hungarian_match(req.tasks, req.offers)
        # Explicitly create Match objects from schema module
        from schema import Match as SchemaMatch
        match_objs = [SchemaMatch(**m.model_dump()) if hasattr(m, 'model_dump') else SchemaMatch(**m.dict()) for m in matches]
        return MatchResponse(matches=match_objs)
    if req.algorithm == "max_coverage":
        if max_coverage_match is None:
            raise ValueError("max_coverage solver not available.")
        matches = max_coverage_match(req.tasks, req.offers)
        from schema import Match as SchemaMatch
        match_objs = [SchemaMatch(**m.model_dump()) if hasattr(m, 'model_dump') else SchemaMatch(**m.dict()) for m in matches]
        return MatchResponse(matches=match_objs)
    if req.algorithm == "bottleneck":
        if bottleneck_match is None:
            raise ValueError("bottleneck solver not available.")
        matches = bottleneck_match(req.tasks, req.offers)
        from schema import Match as SchemaMatch
        match_objs = [SchemaMatch(**m.model_dump()) if hasattr(m, 'model_dump') else SchemaMatch(**m.dict()) for m in matches]
        return MatchResponse(matches=match_objs)
    raise ValueError("Unsupported algorithm")