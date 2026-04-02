"""
Shared data models and utility functions for matching algorithms.
"""

from math import radians, cos, sin, asin, sqrt
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict
from pydantic import BaseModel

# --- Data Models ---

class Location(BaseModel):
    lat: float
    lon: float

class TimeWindow(BaseModel):
    start: str  # ISO8601
    end: str

class ShelterTask(BaseModel):
    id: str
    location: Location
    required_skills: List[str]
    time_window: TimeWindow
    description: Optional[str] = None

class AvailabilityWindow(BaseModel):
    start: str  # ISO8601
    end: str

class VolunteerOffer(BaseModel):
    id: str
    location: Location
    skills: List[str]
    availability: List[AvailabilityWindow]
    max_distance_km: float
    description: Optional[str] = None

class Match(BaseModel):
    id: Optional[str] = None
    shelter_task_id: str
    volunteer_offer_id: str
    score: Optional[float] = None

class MatchRequest(BaseModel):
    tasks: List[ShelterTask]
    offers: List[VolunteerOffer]
    algorithm: str
    metadata: Optional[Dict[str, Any]] = None

class MatchResponse(BaseModel):
    matches: List[Match]

# --- Utility Functions ---

def haversine_km(lat1, lon1, lat2, lon2):
    """Compute distance between two points on Earth (km)."""
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return R * c

def _to_naive(dt: datetime) -> datetime:
    """Strip timezone info so all comparisons use naive datetimes."""
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt

def time_overlap(task_start, task_end, avail_start, avail_end):
    """Check if two time intervals overlap (strict open-interval)."""
    return max(_to_naive(task_start), _to_naive(avail_start)) < min(_to_naive(task_end), _to_naive(avail_end))