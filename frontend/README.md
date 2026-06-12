# Frontend (Next.js)

Role-based UI for the Volunteer Matcher. See the **[root README](../README.md)** for full project setup.

## Local run

```bash
npm install
npm run dev -- --port 3001
```

Open http://localhost:3001. API base URL defaults to `http://localhost:3000` (`NEXT_PUBLIC_API_URL`).

## Pages

| Route | Role |
|-------|------|
| `/` | Dashboard |
| `/tasks` | Shelter tasks |
| `/offers` | Volunteer offers |
| `/matching` | Coordinator — run algorithms |
| `/assignments` | Approved matches (API-filtered by role) |

## Deploy (Vercel)

- Root directory: `frontend`
- Environment: `NEXT_PUBLIC_API_URL` = public backend URL
- Redeploy after changing env (value is baked at build time)
