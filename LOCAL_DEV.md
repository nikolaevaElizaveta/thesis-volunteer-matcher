# Local development (without Docker)

You need **4 things running**: PostgreSQL, matcher (Python), backend (NestJS), frontend (Next.js).

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
```

(Do **not** set `DATABASE_URL` here unless you use it instead of the variables above.)

**PostGIS (local Postgres):** our schema uses a generated `geography` column — the DB must have the PostGIS extension.

```bash
psql -U your_user -d volunteer_matcher -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

**macOS Homebrew — important:** the `postgis` formula ships extension files for **`postgresql@17`** and **`postgresql@18` only** (under e.g. `.../postgresql@17/extension/postgis.control`). It does **not** install into **`postgresql@16`**. If your server is `@16`, `CREATE EXTENSION postgis` fails with *extension "postgis" is not available* even after `brew install postgis`.

Pick one:

| Approach | What to do |
|----------|------------|
| **A. PostgreSQL 17 (matches Homebrew PostGIS)** | See **checklist below**. |
| **B. Stay on PostgreSQL 16** | Use **Docker** Postgres only for this project: `docker compose up -d postgres`, set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/volunteer_matcher` in `backend/.env`, run `npm run migration:run` from the host. |

**Docker Compose** uses the `postgis/postgis` image and runs `postgres/init/01-postgis.sql` on first DB init — no Homebrew PostGIS needed for that path.

#### Checklist: PostgreSQL 17 + Homebrew PostGIS (macOS)

1. **Install & start PG 17** (PostGIS from `brew install postgis` already targets this version):
   ```bash
   brew install postgresql@17
   brew services stop postgresql@16    # if 16 still holds port 5432
   brew services start postgresql@17
   ```
2. **Add PG 17 tools to your PATH** for this shell (Homebrew prints a hint after install), e.g.:
   ```bash
   echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
   ```
   Use `which psql` — it should resolve under `postgresql@17`.
3. **Create role + database** (adjust names/passwords to match `backend/.env`):
   ```bash
   createuser -s your_mac_user          # superuser, or use postgres role you prefer
   createdb volunteer_matcher
   ```
   Or: `psql -d postgres -c "CREATE USER ...; CREATE DATABASE volunteer_matcher OWNER ...;"`
4. **Enable PostGIS before the first Nest boot** (entities use `geography`; synchronize needs the extension):
   ```bash
   psql -d volunteer_matcher -c "CREATE EXTENSION IF NOT EXISTS postgis;"
   ```
   (`npm run migration:run` also runs `CREATE EXTENSION`, but only after tables exist — so enable it here to avoid startup errors.)
5. **Edit `backend/.env`**: `DATABASE_HOST=localhost`, `DATABASE_PORT=5432`, `DATABASE_USER=...`, `DATABASE_PASSWORD=...` (empty if trust/peer), `DATABASE_NAME=volunteer_matcher`. Remove or override `DATABASE_URL` if you rely on discrete vars.
6. **Create tables, then run the PostGIS migration** (migrations use `ALTER TABLE` — tables must exist first):
   ```bash
   cd backend
   npm run start:dev
   ```
   Wait until Nest starts without errors (TypeORM `synchronize` creates `shelter_tasks`, `volunteer_offers`, etc.), then stop with Ctrl+C.
   ```bash
   npm run migration:run
   npm run migration:show    # expect [X] AddPostgisGeographyColumns…
   ```
7. **Start backend again** (`npm run start:dev`). Optional: `SEED=true` in `.env` if you want demo rows on empty tasks/offers.

### TypeORM migration: `geog` columns (PostGIS)

After PostGIS is available in the database you use for the backend:

```bash
cd backend
npm run migration:run    # applies 1738867200000-AddPostgisGeographyColumns
```

- **`migration:show`** — pending vs executed  
- **`migration:revert`** — undo last migration  

Entities `TaskEntity` / `OfferEntity` include a **generated** `geography(Point,4326)` column `geog` (+ GiST index) so `TYPEORM_SYNCHRONIZE=true` does not drop them.

**Local Postgres without PostGIS:** install it (e.g. `brew install postgis`) or point `backend/.env` at the Compose DB (`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/volunteer_matcher`) and run the migration there.

### Optional: auto-fill demo tasks & offers (dev)

In `backend/.env` add:

```env
SEED=true
```

On backend startup, if **both** tables are **empty**, Nest loads `backend/src/seed/dev-seed.json` (2 demo tasks + 2 demo offers).  
If there is already any row, seed is **skipped** (restart-safe).  
To re-seed: clear tasks/offers in DB (or `docker compose down -v`), then start again with `SEED=true`.

Demo tasks use `owner_name: "Demo Shelter"` — log in as shelter with that **exact** name to see them under “My Tasks”.

For Docker, set `SEED=true` in the root `.env` (compose passes it to the backend).

---

## Sign in (JWT)

The UI uses **username + password** against `POST /auth/login`. After **`SEED=true`** and an **empty `users` table**, the backend seeds:

| Username | Password | Role |
|----------|----------|------|
| `coordinator` | `demo123` | coordinator |
| `demo_shelter` | `demo123` | shelter |
| `demo_volunteer_alex` | `demo123` | volunteer |
| `demo_volunteer_sam` | `demo123` | volunteer |

Set **`JWT_SECRET`** (≥8 chars) in `backend/.env` for production builds; local **`NODE_ENV=development`** uses a built-in dev secret if unset. Docker Compose sets a default `JWT_SECRET`.

Shelters/volunteers can register in the UI at **http://localhost:3001/register** or via **`POST /auth/register`** in Swagger. Coordinators are **not** self-registered.

---

## 1. Every day — 4 terminals

**Terminal 1 — PostgreSQL**  
If it’s not already a system service:

```bash
# macOS Homebrew example:
brew services start postgresql@16
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

Swagger: http://localhost:3000/api

**Terminal 4 — Frontend (port 3001)**

```bash
cd /path/to/my_thesis/frontend
npm run dev -- --port 3001
```

Open **http://localhost:3001** in the browser.

Default API URL is `http://localhost:3000` (see `NEXT_PUBLIC_API_URL` in `frontend/.env.local` if you need to change it).

---

## Port conflicts

- If **3000** is taken, change `PORT` in `backend/.env` and set `NEXT_PUBLIC_API_URL` in the frontend accordingly.
- If **8000** is taken, change matcher port and `MATCHER_URL` in `backend/.env`.

---

## Checklist

| Service   | URL                      |
|-----------|--------------------------|
| UI        | http://localhost:3001    |
| API docs  | http://localhost:3000/api |
| Matcher   | http://localhost:8000/docs |
