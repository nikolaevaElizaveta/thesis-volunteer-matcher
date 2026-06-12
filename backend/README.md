# Backend (NestJS)

REST API for tasks, offers, matching, and assignments. See the **[root README](../README.md)** for architecture, Docker, CI, and deployment.

## Local run

```bash
npm install
cp .env.example .env   # DATABASE_* and MATCHER_URL
npm run start:dev
```

- API: http://localhost:3000  
- Swagger: http://localhost:3000/api  

## Main modules

| Path | Description |
|------|-------------|
| `src/auth/` | Login, JWT, role guards |
| `src/tasks/` | Shelter tasks (PostGIS location) |
| `src/offers/` | Volunteer offers |
| `src/match/` | Cutoff + prefilter → matcher HTTP |
| `src/assignments/` | Approve matches, role-scoped listing |
| `src/health/` | Readiness (`/health`) |
| `src/seed/` | Optional dev seed (`SEED=true`) |
| `src/migrations/` | TypeORM migrations |

## Tests

```bash
npm run test:e2e
```

Recommended from repo root: `../scripts/run-e2e.sh` (uses Docker Postgres + matcher).

## Migrations

```bash
npm run migration:run
```

Production: set `TYPEORM_SYNCHRONIZE=false` and run migrations after deploy.
