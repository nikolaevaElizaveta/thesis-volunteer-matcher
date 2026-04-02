# Volunteer Matcher — Backend API

NestJS backend: CRUD for shelter tasks and volunteer offers, and a proxy to the matching service (Python/FastAPI).

## Quick start

```bash
# Install dependencies
npm install

# Optional: copy env and set MATCHER_URL if matcher runs elsewhere
cp .env.example .env

# Run matcher service first (in another terminal)
# cd ../matcher_service && python3 -m uvicorn main:app --port 8000

# Start backend
npm run start:dev
```

- API: http://localhost:3000  
- Swagger: http://localhost:3000/api  

## Endpoints

| Method | Path        | Description                    |
|--------|-------------|--------------------------------|
| POST   | /tasks      | Create task                    |
| GET    | /tasks      | List tasks                     |
| GET    | /tasks/:id  | Get task                       |
| DELETE | /tasks/:id  | Delete task                    |
| POST   | /offers     | Create offer                   |
| GET    | /offers     | List offers                    |
| GET    | /offers/:id | Get offer                      |
| DELETE | /offers/:id | Delete offer                   |
| POST   | /match      | Run matching (uses stored data)|

**POST /match** body (optional):

```json
{
  "algorithm": "greedy",
  "metadata": { "experiment_id": "test_01" }
}
```

If omitted, `algorithm` defaults to `greedy`. The backend loads all tasks and offers from memory and calls the matcher at `MATCHER_URL`.

---

## How to call match (step by step)

### 1. Start both services

- **Terminal 1 — matcher:** `cd matcher_service && source ../venv/bin/activate && python3 -m uvicorn main:app --port 8000`
- **Terminal 2 — backend:** `cd backend && npm run start:dev`

### 2. Open Swagger

Go to **http://localhost:3000/api**

### 3. Create a task

- Expand **POST /tasks** → **Try it out**.
- Use this body (or edit as you like):

```json
{
  "location": { "lat": 59.9, "lon": 30.3 },
  "required_skills": ["medical"],
  "time_window": { "start": "2026-02-10T12:00:00", "end": "2026-02-10T16:00:00" },
  "description": "Need medical help"
}
```

- **About id:** Each task and offer always has an `id`. If you **omit** `id` from the request body, the backend generates a UUID and returns it in the response — use that for GET /tasks/:id or GET /offers/:id later. Do not leave the placeholder `"string"` in the body (Swagger’s default), or the stored id will be literally `"string"`.
- Click **Execute**. In the response you’ll see the created task and its `id` (e.g. a UUID).

### 4. Create an offer (that matches the task)

- Expand **POST /offers** → **Try it out**.
- Use this body (same location area, same skill, overlapping time):

```json
{
  "location": { "lat": 59.91, "lon": 30.31 },
  "skills": ["medical", "logistics"],
  "availability": [
    { "start": "2026-02-10T14:00:00", "end": "2026-02-10T18:00:00" }
  ],
  "max_distance_km": 10,
  "description": "Volunteer medic"
}
```

- Omit `id` in the body (backend will generate one) or pass your own; avoid the literal `"string"`.
- Click **Execute**.

### 5. Run matching

- Expand **POST /match** → **Try it out**.
- Request body can be empty `{}` or:

```json
{
  "algorithm": "greedy"
}
```

- Click **Execute**.

### 6. Result

- **Response 200:** body will look like:

```json
{
  "matches": [
    {
      "shelter_task_id": "<id of the task you created>",
      "volunteer_offer_id": "<id of the offer you created>",
      "score": 0.99
    }
  ]
}
```

So the backend took all tasks and offers from memory, sent them to the matcher, and returned the assignments.

**If you see `"shelter_task_id": "string"` and `"volunteer_offer_id": "string"`:** You created the task or offer with the default Swagger example value `"string"` in the `id` field. Delete those (DELETE /tasks/:id and DELETE /offers/:id), then create again **without** the `id` field in the body so the backend generates UUIDs.

## Environment

| Variable     | Default               | Description           |
|-------------|------------------------|-----------------------|
| PORT        | 3000                   | Backend port          |
| MATCHER_URL | http://localhost:8000  | Matcher service URL   |

## Project structure

```
src/
  common/dto/     # Shared DTOs (location, time window)
  tasks/          # Tasks module (CRUD)
  offers/         # Offers module (CRUD)
  match/          # Match module (calls matcher HTTP)
  app.module.ts
  main.ts
```

Storage is in-memory (Phase 1). Replace with PostgreSQL in Phase 2.
