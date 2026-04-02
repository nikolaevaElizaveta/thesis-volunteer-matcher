# Volunteer Matcher

## System Overview

Modular system for two-sided volunteer–shelter task allocation (research / thesis).

| Component | Tech | Role |
|-----------|------|------|
| **Backend API** | Node.js, NestJS | CRUD for tasks/offers, proxy to matcher |
| **Matcher service** | Python, FastAPI | Greedy + Hungarian algorithms |
| **Database** | PostgreSQL + **PostGIS** (Docker) | Tasks, offers, assignments; lat/lon today; PostGIS ready for `geography` / distance queries |
| **Frontend** | React / Next.js | Phase 3 (UI) |

- **Auth:** JWT (`POST /auth/login`), Bearer token on API calls; roles **coordinator** / **shelter** / **volunteer**. With **`SEED=true`**, demo users are created (password `demo123`): `coordinator`, `demo_shelter`, `demo_volunteer_alex`, `demo_volunteer_sam`. Swagger: **Authorize** after login.
- **Auto-matching deadline:** By default, tasks are excluded from `POST /match` when their start is within **24 hours** (config: `MATCHING_CUTOFF_HOURS_BEFORE_START`). Check **Urgent** when creating a task to bypass. Set the env var to **`0`** to disable the cutoff entirely.
- **Matcher:** Two algorithms — **Greedy** (baseline), **Hungarian** (optimal). Same constraints (spatial, skill, time).
- **Evaluation:** Automated test suite and metrics (see `matcher_service/examples/`, `evaluate_metrics.py`).

### Repository structure

```
backend/           # NestJS API (tasks, offers, POST /match → matcher)
matcher_service/   # Python FastAPI matcher (greedy, hungarian)
dissertation_progress/  # Docs for thesis
matcher_openapi.yaml    # Matcher API contract
```

### Docker (full stack)

From the repo root:

```bash
docker compose up --build
```

UI: http://localhost:3001 · See **`DOCKER.md`** and **`.env.example`**.

### Automated checks (API)

- **E2E (Nest + Supertest + real Postgres):** requires `DATABASE_URL` or discrete DB vars in `backend/.env`, PostGIS-enabled DB, and demo user `demo_shelter` / `demo123` (or empty `users` + forced `SEED=true` in the test process).
  ```bash
  cd backend && npm run test:e2e
  ```
- **Smoke (curl, backend must be running):** e.g. after `docker compose up`:
  ```bash
  ./scripts/smoke-api.sh
  # or: API_BASE=http://localhost:3000 ./scripts/smoke-api.sh
  ```

Playwright/Cypress for the Next.js UI are not wired yet; use the flows in **`LOCAL_DEV.md`** manually or extend the repo later.

### Local dev (no Docker — faster day-to-day)

See **`LOCAL_DEV.md`**: Postgres + matcher :8000 + `backend` :3000 + `frontend` :3001.

**Demo seed (dev):** set `SEED=true` in `backend/.env` — on first empty DB, loads `backend/src/seed/dev-seed.json`. See LOCAL_DEV.md.

**PostGIS `geog` migration:** from `backend/`, with PostGIS-enabled DB: `npm run migration:run` (see LOCAL_DEV.md). Docker Postgres image includes PostGIS.

---

## Data Model
- Task (ShelterTask): spatial (lat/lon), skills, time_window
- Offer (VolunteerOffer): spatial (lat/lon), skills, availability_window, max_distance
- Match: assignment between task and offer

All entities specified in OpenAPI and as Pydantic classes.

---

## Matching Constraints

All algorithms enforce the following constraints (hard requirements):

- **Spatial Constraint:** Candidate volunteer must be within `max_distance_km` of the task (Haversine distance formula).
- **Skill Constraint:** Task `required_skills` must be a subset of volunteer `skills`.
- **Temporal Constraint (Strict Open-Interval):** Task time window and volunteer availability must have real overlap:
  
      max(task_start, offer_start) < min(task_end, offer_end)
  
  If intervals only touch boundaries (e.g., task ends exactly when availability starts), no match.
- **One-to-one Assignment:** Each volunteer can be assigned to at most one task per batch.

---

## Available Algorithms

Both algorithms respect the constraints above but differ in their assignment strategy:

### Greedy (Baseline)
- **Complexity:** O(n²) where n = max(tasks, offers)
- **Strategy:** 
  - Processes tasks in order of earliest start time
  - For each task, assigns the nearest eligible volunteer (by distance)
  - Once assigned, volunteer is removed from candidate pool
- **Optimality:** Suboptimal (greedy local choices may not yield global minimum)
- **Use case:** Fast baseline for comparison, suitable for real-time matching

### Hungarian (Optimal)
- **Complexity:** O(n³)
- **Strategy:** 
  - Builds cost matrix (distance) for all feasible task-volunteer pairs
  - Solves minimum-cost bipartite assignment using `scipy.optimize.linear_sum_assignment`
  - Guarantees globally optimal solution (minimizes total assignment distance)
- **Optimality:** Guaranteed optimal
- **Use case:** Research comparison, offline batch processing, evaluation of greedy performance

**Note:** Both algorithms can be compared directly on the same input data via the `/match` endpoint with `algorithm: "greedy"` or `algorithm: "hungarian"`.

---

## Installation and Running

### Matcher only (Python)

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cd matcher_service
python3 -m uvicorn main:app --reload --port 8000
```
→ http://localhost:8000, docs at http://localhost:8000/docs

### Full stack (Backend + Matcher)

1. **Start matcher** (terminal 1):
   ```bash
   cd matcher_service && source ../venv/bin/activate
   python3 -m uvicorn main:app --port 8000
   ```

2. **Start backend** (terminal 2):
   ```bash
   cd backend && npm install && npm run start:dev
   ```
   → http://localhost:3000, Swagger at http://localhost:3000/api

3. Use Backend to create tasks/offers and call **POST /match**; it will forward to the matcher.


### Running Tests

```bash
# Basic test suite (validates correctness):
cd matcher_service
python3 test_matcher.py
```
This runs both algorithms on all canonical test cases and reports PASS/FAIL status.

```bash
# Detailed metrics evaluation (for research analysis):
cd matcher_service
python3 evaluate_metrics.py
```

This generates:
- Detailed comparison tables for each test case
- Summary statistics (average match count, distance, coverage)
- JSON output file (evaluation_results.json) for further analysis

Note: The service must be running (uvicorn main:app --reload --port 8000) before running test scripts.

---

## Test Cases / Evaluation
### Canonical Test Suite
See `matcher_service/examples/` for test case JSONs. Each case includes:
- Input: `test_case_X_input.json` (tasks and offers)
- Expected: `test_case_X_expected_matches.json` (ground truth)

### Test Cases:
- `test_case_0_trivial_*`: One task, one volunteer. Expect 1 match.
- `test_case_1_*`: Two tasks, two volunteers. Each only matches if all constraints satisfied. See actuals in file.
- `test_case_2_conflict_*`: Two volunteers could satisfy, greedy takes the closest.
- `test_case_3_impossible_*`: No volunteer meets skill/time. Expect 0 matches.

### Metrics Collected

The evaluation framework collects:
- Match Count: Number of successful assignments
- Task Coverage: Percentage of tasks matched
- Distance Metrics: Average, total, min, max assignment distances
- Unmatched Resources: Count of unmatched tasks and volunteers

See evaluation_results.json for complete metrics data.

### Synthetic Data and Benchmarking

For **realistic testing at scale**:

```bash
cd matcher_service
# Generate synthetic tasks and offers (e.g. 20 tasks, 50 offers)
python3 generate_synthetic_data.py --tasks 20 --offers 50 --out synthetic_input.json

# Benchmark both algorithms on that input (server must be running)
python3 benchmark.py synthetic_input.json
```

This reports match count, task coverage, total distance, and run time (ms) for both algorithms. See `dissertation_progress/algorithms_note.md` for the objective of each algorithm and how to interpret "optimal" for real use.

---

## API Usage

### Example Request
```bash
curl -X POST "http://localhost:8000/match" \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [
      {
        "id": "task1",
        "location": {"lat": 59.9, "lon": 30.3},
        "required_skills": ["medical"],
        "time_window": {"start": "2026-02-05T12:00:00", "end": "2026-02-05T16:00:00"}
      }
    ],
    "offers": [
      {
        "id": "vol1",
        "location": {"lat": 59.91, "lon": 30.31},
        "skills": ["medical"],
        "availability": [{"start": "2026-02-05T15:00:00", "end": "2026-02-05T18:00:00"}],
        "max_distance_km": 10
      }
    ],
    "algorithm": "greedy",
    "metadata": {"experiment_id": "test_01"}
  }'
```

### Response Format
```json
{
  "matches": [
    {
      "shelter_task_id": "task1",
      "volunteer_offer_id": "vol1",
      "score": 0.99
    }
  ]
}
```

The score field represents match quality: 1 / (1 + distance_km), where higher scores indicate closer matches.

---

## Adding New Experiments or Algorithms
1. Add tasks/offers to `examples/` and expected matches.
2. Expand logic in `main.py` as needed (e.g., add Hungarian, OrTools...)
3. Extend `test_matcher.py` to include further test cases.

---

## Citation / Licensing
For academic use, see LICENSE or contact author.

