# Local development (without Docker)

You need **4 things running**: PostgreSQL, matcher (Python), backend (NestJS), frontend (Next.js).

For stack overview, constraints, algorithms, and Docker quick start, see **README.md**.

## 0. One-time setup

**Python matcher**

```bash
cd /path/to/my_thesis
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Backend**

```bash
cd backend
npm install
cp .env.example .env               # edit DATABASE_* and MATCHER_URL
```

**Frontend**

```bash
cd frontend
npm install
```

**PostgreSQL** — local install or Postgres.app. Create a database, e.g. `volunteer_matcher`, and put credentials in `backend/.env`:

```env
PORT=3000
MATCHER_URL=http://localhost:8000

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=volunteer_matcher

# Optional (defaults shown in backend/.env.example):
# TYPEORM_SYNCHRONIZE=true
# SEED=false
# MATCHING_CUTOFF_HOURS_BEFORE_START=24
# HEALTH_CHECK_MATCHER=true
```

(Do **not** set `DATABASE_URL` here unless you use it instead of the discrete variables above.)

**PostGIS (local Postgres):** our schema uses a generated `geography` column — the DB must have the PostGIS extension.

```bash
psql -U your_user -d volunteer_matcher -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

**macOS Homebrew — important:** the `postgis` formula ships extension files for **`postgresql@17`** and **`postgresql@18` only**. It does **not** install into **`postgresql@16`**. If your server is `@16`, `CREATE EXTENSION postgis` fails with *extension "postgis" is not available* even after `brew install postgis`.

Pick one:

| Approach | What to do |
|----------|------------|
| **A. PostgreSQL 17 (matches Homebrew PostGIS)** | See **checklist below**. |
| **B. Docker Postgres only** | `docker compose up -d postgres`, set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/volunteer_matcher` in `backend/.env`, run `npm run migration:run` from the host. Avoids Homebrew PostGIS version mismatch. |

**Port 5432 on Mac:** if Homebrew Postgres and Docker both bind `:5432`, `psql` and e2e may hit the wrong server. Prefer **one** Postgres for this project, or use `./scripts/run-e2e.sh` (Docker network — does not use host `:5432`).

**Docker Compose** uses the `postgis/postgis` image and runs `postgres/init/01-postgis.sql` on first DB init — no Homebrew PostGIS needed for that path.

#### Checklist: PostgreSQL 17 + Homebrew PostGIS (macOS)

1. **Install & start PG 17:**
   ```bash
   brew install postgresql@17
   brew services stop postgresql@16    # if 16 still holds port 5432
   brew services start postgresql@17
   ```
2. **Add PG 17 tools to PATH**, e.g.:
   ```bash
   echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
   ```
   `which psql` should resolve under `postgresql@17`.
3. **Create role + database** (match `backend/.env`):
   ```bash
   createuser -s your_mac_user
   createdb volunteer_matcher
   ```
4. **Enable PostGIS before first Nest boot:**
   ```bash
   psql -d volunteer_matcher -c "CREATE EXTENSION IF NOT EXISTS postgis;"
   ```
5. **Edit `backend/.env`** with `DATABASE_*` vars (or `DATABASE_URL` for Compose DB).
6. **Create tables, then run migrations** (migrations use `ALTER TABLE` — tables must exist first):
   ```bash
   cd backend
   npm run start:dev
   ```
   Wait until Nest starts (TypeORM `synchronize` creates base tables), then Ctrl+C.
   ```bash
   npm run migration:run
   npm run migration:show
   ```
   Expect **`[X]`** on all four migrations:
   - `AddPostgisGeographyColumns1738867200000`
   - `AddAddressToTasksAndOffers1740000000000`
   - `AddUrgentToTasks1740100000000`
   - `AssignmentUniqueApproved1740200000000`
7. **Start backend again** (`npm run start:dev`). Optional: `SEED=true` for demo data on empty tables.

**Migrations CLI:** `migration:show` / `migration:revert` / `migration:run` from `backend/`. Render external `DATABASE_URL` from a laptop needs TLS — `data-source.ts` appends `sslmode=require` for `render.com` hosts.

Entities `TaskEntity` / `OfferEntity` include a **generated** `geography(Point,4326)` column `geog` (+ GiST index).

### Optional: auto-fill demo users, tasks & offers (dev)

In `backend/.env` add:

```env
SEED=true
```

Flow on startup when **`SEED=true`**:

1. If **`users`** is empty → demo accounts (password **`demo123`**): `coordinator`, `demo_shelter`, `demo_volunteer_alex`, `demo_volunteer_sam`, plus `seed_shelter_XX` / `seed_volunteer_XX`.
2. If **both** `tasks` and `offers` are empty → loads `backend/src/seed/dev-seed.json` and augments with generated rows.

If either tasks or offers has data, task/offer seed is **skipped**. Full reset: truncate tables or `docker compose down -v`.

For Docker, set `SEED=true` in the **repo root** `.env` (Compose passes it to the backend). Production / Render: **`SEED=false`**.

---

## Sign in (JWT)

| Username | Password | Role |
|----------|----------|------|
| `coordinator` | `demo123` | coordinator |
| `demo_shelter` | `demo123` | shelter |
| `demo_volunteer_alex` | `demo123` | volunteer |
| `demo_volunteer_sam` | `demo123` | volunteer |

Set **`JWT_SECRET`** (≥8 chars) for production; local dev uses a built-in secret if unset.

Register shelter/volunteer: **http://localhost:3001/register** or Swagger `POST /auth/register`. Coordinators are **not** self-registered.

---

## 1. Every day — 4 terminals

**Terminal 1 — PostgreSQL** (same major version as configured; Homebrew → `postgresql@17`):

```bash
brew services start postgresql@17
```

**Terminal 2 — Matcher (port 8000)**

```bash
cd /path/to/my_thesis/matcher_service
source ../venv/bin/activate
python3 -m uvicorn main:app --reload --port 8000
```

**Terminal 3 — Backend (port 3000)**

```bash
cd /path/to/my_thesis/backend
npm run start:dev
```

- Swagger: http://localhost:3000/api  
- Health: http://localhost:3000/health (DB + matcher readiness)

**Terminal 4 — Frontend (port 3001)**

```bash
cd /path/to/my_thesis/frontend
npm run dev -- --port 3001
```

Open **http://localhost:3001**. API base: `http://localhost:3000` (`NEXT_PUBLIC_API_URL` in `frontend/.env.local` if needed).

---

## Port conflicts

- **3000** taken → change `PORT` in `backend/.env` and `NEXT_PUBLIC_API_URL` in frontend.
- **8000** taken → change matcher port and `MATCHER_URL` in `backend/.env`.
- **5432** taken / wrong Postgres → see approach B or `run-e2e.sh` below.

---

## Tests & smoke (with stack running)

```bash
# Matcher — 16 HTTP tests, 4 algorithms (matcher on :8000)
cd matcher_service && ../venv/bin/python test_matcher.py

# Backend e2e — prefers Docker network (avoids Mac :5432 conflict)
./scripts/run-e2e.sh

# Full local CI (matcher + e2e + smoke)
./scripts/run-ci-local.sh

# Quick HTTP checks (backend on :3000, SEED/demo user for match smoke)
./scripts/smoke-api.sh
./scripts/smoke-match-algorithms.sh
```

GitHub Actions runs the same matcher tests, e2e, and smoke on push — see `.github/workflows/ci.yml`.

---

## Checklist

| Service | URL |
|---------|-----|
| UI | http://localhost:3001 |
| API docs | http://localhost:3000/api |
| Health | http://localhost:3000/health |
| Matcher | http://localhost:8000/docs |
