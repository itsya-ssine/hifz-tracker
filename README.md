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

## API overview
Interactive docs: http://localhost:8000/docs (sign in with `POST /api/v1/auth/login` first; the cookie is reused by "Try it out").

| Area | Endpoints (prefix `/api/v1`) |
|------|------------------------------|
| Auth | `POST /auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/change-password`; `GET/PATCH /auth/me` |
| Student | `GET /me/overview`, `/me/history`, `/me/progress-timeline` |
| Admin: students | `GET/POST /admin/students`, `GET/PATCH /admin/students/{id}`, `POST .../reset-password`, `GET .../history`, `.../progress-timeline`, `.../audit` |
| Admin: sessions | `GET/POST /admin/sessions`, `GET/PATCH/DELETE /admin/sessions/{id}` |
| Admin: attendance | `PUT /admin/sessions/{id}/attendance` (bulk, idempotent), `PATCH/DELETE /admin/attendance/{id}` |

### Admin interface (sign in as `admin`)
| Screen | What you can do |
|--------|-----------------|
| Dashboard | Student totals, the session that needs attention next, recent sessions |
| Students | Search, filter by status or current hizb, sort, add a student (temporary password shown once) |
| Student page | Progress, charts, history; edit profile, status, account; correct the current position; reset password; correct or delete individual records; read the audit trail |
| Sessions | Create sessions, see results per session |
| Attendance sheet | Mark each student (passed / not passed / absent / excused), add reasons and notes, bulk-mark the rest, save once; warns before leaving with unsaved changes |

### Business rules
- Only `PASSED` moves a student forward; `NOT_PASSED`, `ABSENT` and `ABSENT_EXCUSED` keep them on the same part.
- Progress is **derived** from `start_index` + passed sessions, so correcting an old record fixes every later one.
- Every attendance, profile and position change is written to the audit log (old and new values).
- A student is on a session's sheet if they are `ACTIVE` and had joined by that date (or already have a record there).
- Admin-created accounts get a temporary password and must change it on first login.

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
2. ✅ Core domain: students and sessions API, bulk attendance, corrections + audit log, student dashboard and history
3. ✅ Admin UI: dashboard, students, student page with corrections and audit trail, sessions, attendance sheet
4. Analytics (at-risk students, club-wide charts) and CSV import/export
5. Polish and deployment
