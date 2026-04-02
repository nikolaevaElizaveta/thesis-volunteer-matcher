import unittest
from unittest.mock import patch

from hungarian_solver import bottleneck_match, hungarian_match
from main import match_endpoint
from schema import (
    AvailabilityWindow,
    Location,
    MatchRequest,
    ShelterTask,
    TimeWindow,
    VolunteerOffer,
)


def make_task(task_id: str, idx: int) -> ShelterTask:
    return ShelterTask(
        id=task_id,
        location=Location(lat=float(idx), lon=0.0),
        required_skills=["s"],
        time_window=TimeWindow(start="2026-02-10T10:00:00", end="2026-02-10T14:00:00"),
    )


def make_offer(offer_id: str, idx: int, skills=None, max_distance_km: float = 9999.0) -> VolunteerOffer:
    return VolunteerOffer(
        id=offer_id,
        location=Location(lat=float(idx), lon=0.0),
        skills=skills if skills is not None else ["s"],
        availability=[
            AvailabilityWindow(start="2026-02-10T09:00:00", end="2026-02-10T18:00:00")
        ],
        max_distance_km=max_distance_km,
    )


class BottleneckUnitTests(unittest.TestCase):
    def test_bottleneck_matches_maximum_cardinality(self):
        """
        One offer has wrong skills, so only 2 feasible one-to-one matches exist.
        Bottleneck must still return that maximum cardinality.
        """
        tasks = [make_task("t0", 0), make_task("t1", 1), make_task("t2", 2)]
        offers = [
            make_offer("o0", 0, skills=["s"]),
            make_offer("o1", 1, skills=["s"]),
            make_offer("o2", 2, skills=["other"]),  # infeasible by skills
        ]

        matches = bottleneck_match(tasks, offers)
        self.assertEqual(len(matches), 2)

    def test_bottleneck_can_reduce_max_distance_vs_hungarian(self):
        """
        Construct a synthetic distance matrix where min-sum (Hungarian) uses a farther edge,
        while bottleneck finds a lower maximum distance at same cardinality.
        """
        # Distances indexed as [task_idx][offer_idx]
        matrix = [
            [1.0, 40.0, 40.0],
            [40.0, 1.0, 40.0],
            [20.0, 20.0, 50.0],
        ]

        tasks = [make_task("t0", 0), make_task("t1", 1), make_task("t2", 2)]
        offers = [make_offer("o0", 0), make_offer("o1", 1), make_offer("o2", 2)]

        def fake_haversine(task_lat, _task_lon, offer_lat, _offer_lon):
            return matrix[int(task_lat)][int(offer_lat)]

        with patch("hungarian_solver.haversine_km", side_effect=fake_haversine):
            h_matches = hungarian_match(tasks, offers)
            b_matches = bottleneck_match(tasks, offers)

        self.assertEqual(len(h_matches), 3)
        self.assertEqual(len(b_matches), 3)

        def max_dist(matches):
            if not matches:
                return 0.0
            return max((1.0 / m.score) - 1.0 for m in matches if m.score and m.score > 0)

        self.assertLess(max_dist(b_matches), max_dist(h_matches))


class BottleneckIntegrationTests(unittest.TestCase):
    def test_match_endpoint_supports_bottleneck(self):
        payload = MatchRequest(
            algorithm="bottleneck",
            tasks=[
                {
                    "id": "t1",
                    "location": {"lat": 59.93, "lon": 30.31},
                    "required_skills": ["s"],
                    "time_window": {
                        "start": "2026-02-10T10:00:00",
                        "end": "2026-02-10T14:00:00",
                    },
                }
            ],
            offers=[
                {
                    "id": "o1",
                    "location": {"lat": 59.931, "lon": 30.312},
                    "skills": ["s"],
                    "availability": [
                        {
                            "start": "2026-02-10T09:00:00",
                            "end": "2026-02-10T18:00:00",
                        }
                    ],
                    "max_distance_km": 10.0,
                }
            ],
        )

        res = match_endpoint(payload)
        self.assertEqual(len(res.matches), 1)
        self.assertEqual(res.matches[0].shelter_task_id, "t1")
        self.assertEqual(res.matches[0].volunteer_offer_id, "o1")


if __name__ == "__main__":
    unittest.main()
