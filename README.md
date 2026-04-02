# Volunteer Matcher

Full-stack app for matching **shelter tasks** with **volunteer offers** under spatial, skill, and time constraints. Backend orchestrates data and calls a Python **matcher** service; the UI is **Next.js**.

## Stack

| Layer | Tech |
|--------|------|
| API | NestJS, PostgreSQL + **PostGIS**, JWT |
| Matcher | FastAPI, SciPy / custom graph matching |
| UI | Next.js (App Router) |
| Local infra | Docker Compose |

## Features

- **Roles:** coordinator, shelter, volunteer — `POST /auth/login`, Bearer JWT on API routes.
- **Demo data:** with `SEED=true` and an empty DB, loads `backend/src/seed/dev-seed.json` (password **`demo123`** for seeded users, e.g. `coordinator`, `demo_shelter`, `demo_volunteer_alex`, `demo_volunteer_sam`).
- **Matching cutoff:** tasks starting within **24 hours** are skipped by batch match unless marked **Urgent**; set `MATCHING_CUTOFF_HOURS_BEFORE_START=0` to disable.
- **Algorithms** (same hard constraints, different objectives — see below): `greedy`, `hungarian`, `max_coverage`, `bottleneck`.

**Backend Swagger:** `/api` · **Matcher docs:** `/docs`

## Repository layout

```
backend/           NestJS — tasks, offers, assignments, POST /match → matcher
frontend/        Next.js UI
matcher_service/ FastAPI matcher + benchmarks / synthetic data helpers
scripts/         smoke-*.sh etc.
postgres/init/   PostGIS init for Docker
.env.example     Root env template for Compose
LOCAL_DEV.md     Run services without Docker (optional)
```

## Quick start (Docker)

From the repo root:

```bash
cp .env.example .env   # optional; defaults work for local demo
docker compose up --build -d
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| Backend / Swagger | http://localhost:3000 · http://localhost:3000/api |
| Matcher | http://localhost:8000 · http://localhost:8000/docs |

Smoke checks (with the stack running):

```bash
./scripts/smoke-api.sh
./scripts/smoke-match-algorithms.sh
```

For day-to-day dev without Docker, see **LOCAL_DEV.md**.

## Deployment (overview)

Typical split:

- **Frontend** — Vercel: root directory `frontend`, env `NEXT_PUBLIC_API_URL` = public backend URL.
- **Backend, matcher, Postgres** — e.g. Render: Node service (`backend/`), Docker or Python service for matcher, managed PostgreSQL with `CREATE EXTENSION postgis;`.

Keep secrets in provider dashboards, not in Git (see `.gitignore`).

## Matching rules (all algorithms)

- **Distance:** Haversine km ≤ volunteer `max_distance_km`.
- **Skills:** task `required_skills` ⊆ offer `skills`.
- **Time:** strict overlap — `max(task_start, offer_start) < min(task_end, offer_end)` (touching endpoints does not count).
- **Assignment:** at most one task per offer per batch (one-to-one in the bipartite sense).

## Algorithms

| Key | Idea |
|-----|------|
| `greedy` | Earliest tasks first; each gets nearest feasible volunteer. Fast baseline. |
| `hungarian` | Minimize **sum** of distances (classic assignment). |
| `max_coverage` | Maximize match count; tie-break with distance objective. |
| `bottleneck` | Maximize coverage, then minimize **maximum** pairwise distance (min–max / fairer tail). |

Matcher request shape and examples: OpenAPI at **`matcher_service`** or **`/docs`** on the running matcher. Score for a match is `1 / (1 + distance_km)` when returned.

## Tests & tooling

```bash
cd matcher_service && python3 test_matcher.py          # canonical cases
cd matcher_service && python3 test_bottleneck.py       # bottleneck + API smoke
cd backend && npm run test:e2e                       # needs DB + env (see backend)
```

Benchmarks and synthetic data: `matcher_service/benchmark.py`, `matcher_service/generate_synthetic_data.py` (run with matcher up if hitting HTTP).

## License

Add a `LICENSE` file if you redistribute the repo; otherwise state terms in your thesis or institution policy.
