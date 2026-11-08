# Hifz Tracker

A bilingual (English / Arabic) web app to track Quran memorization progress for the 1337 school club.
Students follow their own stats; admins manage weekly sessions and monitor every student's activity.

> Full specification: [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md)

## Stack
- **Database:** Turso (libSQL)
- **Backend:** FastAPI (Python 3.12)
- **Frontend:** React + TypeScript (Vite), Tailwind CSS v4, TanStack Query, react-i18next (EN/AR with RTL)

## Project structure
```
backend/    FastAPI app, migrations, scripts, tests
frontend/   React + TypeScript app
docs/       Project specification
```

## Getting started

### 1. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # fill in TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET
python -m scripts.migrate            # apply database migrations
python -m scripts.create_admin --login admin --name "Club Admin"
python -m scripts.seed_demo          # optional: demo students and sessions (dev only)
uvicorn app.main:create_app --factory --reload
```
API docs: http://localhost:8000/docs

> No Turso database yet? Use a local file for development: `TURSO_DATABASE_URL=file:./local.db`

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. The dev server proxies `/api` to `http://localhost:8000`, so cookies stay same-origin.

### Demo credentials (after `seed_demo`)
| Role    | Login                     | Password       |
|---------|---------------------------|----------------|
| Admin   | `admin`                   | `Admin1234!`   |
| Student | `student01` … `student20` | `Student1234!` |

## Tests
```bash
cd backend  && pytest
cd frontend && npm run lint && npm run build && npm test
```

## Authentication notes
- Access (15 min) and refresh (7 days) JWTs live in **httpOnly cookies**; refresh tokens rotate and replays are detected.
- Production over HTTPS: set `COOKIE_SECURE=true`. If the frontend and API are on different sites, also set
  `COOKIE_SAMESITE=none` and add the frontend origin to `CORS_ORIGINS` (and set `VITE_API_URL` at build time).
- Login attempts are rate limited in memory (single instance). Behind a reverse proxy, make sure the real client IP is forwarded.

## Roadmap
1. ✅ Foundation: database, progress logic, auth, frontend skeleton, seed data
2. Core domain: students and sessions CRUD, bulk attendance, corrections + audit log
3. Admin UI
4. Student UI
5. Analytics and CSV import/export
6. Polish and deployment
