# Hifz Tracker: 1337 Quran Memorization Club

A bilingual (English / Arabic) web app to track the Quran memorization progress of students in the 1337 school club. It has two interfaces: a **Student** interface (personal stats) and an **Admin** interface (activity of every student, weekly session management).

> This document is the full specification. Build the project in the phases described in section 12. Ask before deviating from the data model or business rules.

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Database | **Turso** (libSQL / SQLite-compatible) |
| Backend | **FastAPI** (Python 3.11+), Pydantic v2 |
| DB access | `libsql-client` / `libsql-experimental` (or SQLAlchemy with the libSQL dialect), plain SQL migrations |
| Frontend | **React + TypeScript** (Vite) |
| UI | Tailwind CSS + shadcn/ui (or Radix), Recharts for charts |
| Data fetching | TanStack Query, Axios/fetch |
| Routing | React Router |
| i18n | `react-i18next`, English + Arabic, full **RTL** support |
| Auth | JWT (access + refresh in httpOnly cookies), bcrypt/argon2 password hashing |
| Deployment (suggested) | Backend on Render/Fly/Railway, frontend on Vercel/Netlify, Turso cloud DB |

---

## 2. Domain Concepts

- The Quran is divided into **60 Hizb**.
- Each Hizb is divided into **8 parts** (so **480 parts** in total).
- A **Position** is a pair `(hizb, part)` with `hizb ∈ [1..60]`, `part ∈ [1..8]`.
  Internally, use a single **global index**: `index = (hizb - 1) * 8 + part`, ranging from 1 to 480.
- Every student has a **current part**: the part they are currently working to memorize.
- A **Session** happens once a week. Every student is expected to attend and recite the part they memorized.

### Session outcomes (per student, per session)

| Status | Meaning | Effect on progress |
|---|---|---|
| `PASSED` | Attended and memorized the part well enough | Student **advances** to the next part |
| `NOT_PASSED` | Attended but did not memorize well enough | Student **stays** on the same part |
| `ABSENT` | Did not attend, no valid reason | Stays on the same part |
| `ABSENT_EXCUSED` | Did not attend, with a good reason | Stays on the same part |

### Progress rules

1. Advancing from `(h, 8)` goes to `(h + 1, 1)`.
2. Advancing from `(60, 8)` means the student has **completed the whole Quran** (status `COMPLETED`, show a celebration in the UI).
3. A student can only have **one record per session**.
4. Only `PASSED` changes the student's position.
5. `ABSENT_EXCUSED` is tracked separately from `ABSENT` in stats (excused absences should not count against attendance rate in the "adjusted" rate).
6. **Progress must stay consistent when an admin corrects a past record.** Recommended approach: a student's current position is always **derived** from `start_index + number of PASSED records`, and cached in `students.current_index`, which is recomputed whenever a record is created, edited or deleted.
7. Each attendance record stores the `part_index` the student was being evaluated on (the part at that time), so history stays accurate and readable.

---

## 3. User Roles

### Student
- Logs in, sees only their own data.
- Cannot edit any attendance or progress.

### Admin
- Manages students, sessions and attendance.
- Sees analytics for the whole club and for each student.
- Can correct past records (with an audit trail).
- Optional later: a `SUPER_ADMIN` role that manages other admins.

---

## 4. Database Schema (Turso / SQLite)

Use migrations (e.g. numbered `.sql` files in `backend/migrations/`) and a small migration runner.

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  login         TEXT NOT NULL UNIQUE,          -- intra login or email
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('STUDENT','ADMIN')),
  preferred_lang TEXT NOT NULL DEFAULT 'en' CHECK (preferred_lang IN ('en','ar')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE students (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  start_index    INTEGER NOT NULL DEFAULT 1 CHECK (start_index BETWEEN 1 AND 480),
  current_index  INTEGER NOT NULL DEFAULT 1 CHECK (current_index BETWEEN 1 AND 481),
                 -- 481 = completed the whole Quran
  joined_at      TEXT NOT NULL DEFAULT (date('now')),
  status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','COMPLETED','LEFT')),
  notes          TEXT
);

CREATE TABLE sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_date TEXT NOT NULL UNIQUE,           -- YYYY-MM-DD
  title        TEXT,
  notes        TEXT,
  is_cancelled INTEGER NOT NULL DEFAULT 0,
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE attendance_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('PASSED','NOT_PASSED','ABSENT','ABSENT_EXCUSED')),
  part_index  INTEGER NOT NULL CHECK (part_index BETWEEN 1 AND 480),
              -- the part the student was evaluated on / expected to be evaluated on
  excuse_note TEXT,                            -- reason when ABSENT_EXCUSED
  admin_note  TEXT,                            -- feedback on recitation quality
  marked_by   INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, student_id)
);

CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id   INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,                    -- e.g. 'ATTENDANCE_UPDATED'
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  old_value  TEXT,                             -- JSON
  new_value  TEXT,                             -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_attendance_student ON attendance_records(student_id);
CREATE INDEX idx_attendance_session ON attendance_records(session_id);
```

### Helper logic (backend, in a dedicated `progress` service)

```python
def index_to_position(index: int) -> tuple[int, int]:
    return ((index - 1) // 8 + 1, (index - 1) % 8 + 1)   # (hizb, part)

def position_to_index(hizb: int, part: int) -> int:
    return (hizb - 1) * 8 + part

def recompute_student_progress(student_id): 
    # current_index = start_index + count(PASSED records), capped at 481
    # status = COMPLETED if current_index > 480
    # Must run inside a transaction after any create/update/delete of a record.
```

---

## 5. Authentication & Authorization

- Admins create student accounts (single form or **bulk CSV import**: `login, full_name, email, start_hizb, start_part`).
- Login with `login/email + password`. First login forces a password change.
- JWT in httpOnly, secure, SameSite cookies. Refresh token rotation.
- Role-based guards in FastAPI (`require_admin`, `require_student`) and in React routes.
- *Optional later:* login with 42 intra OAuth.
- Rate limit the login endpoint.

---

## 6. REST API (FastAPI)

Prefix everything with `/api/v1`. Auto-generate OpenAPI docs. Use Pydantic schemas and consistent error format `{ "detail": "...", "code": "..." }`.

### Auth
- `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`
- `GET /auth/me`, `PATCH /auth/me` (name, language), `POST /auth/change-password`

### Student endpoints (role: STUDENT)
- `GET /me/overview`: current position, overall progress %, streak, attendance rate, counts per status
- `GET /me/history?page=&status=`: paginated list of past session records
- `GET /me/progress-timeline`: data for the chart (position over time)

### Admin endpoints (role: ADMIN)
**Students**
- `GET /admin/students?search=&status=&hizb=&sort=&page=`
- `POST /admin/students`, `POST /admin/students/import` (CSV)
- `GET /admin/students/{id}`: full profile and stats
- `PATCH /admin/students/{id}` (status, start position, notes, manual position correction)
- `POST /admin/students/{id}/reset-password`

**Sessions**
- `GET /admin/sessions`, `POST /admin/sessions`, `PATCH /admin/sessions/{id}`
- `GET /admin/sessions/{id}`: session with every active student and their record (or none yet)
- `PUT /admin/sessions/{id}/attendance`: **bulk** upsert of records for the whole session (one transaction, recomputes progress)
- `PATCH /admin/attendance/{record_id}`: correct a record (writes to `audit_log`)

**Analytics**
- `GET /admin/stats/overview`: totals, average attendance rate, passed rate, distribution of students by hizb, active vs. completed
- `GET /admin/stats/weekly`: per-session attendance and pass counts (chart)
- `GET /admin/stats/at-risk`: students with N consecutive absences or N consecutive `NOT_PASSED`
- `GET /admin/export/students.csv`, `GET /admin/export/attendance.csv`

---

## 7. Frontend: Pages & Features

### Shared
- Login page, language switcher (EN / العربية) persisted in user profile + localStorage, light/dark theme toggle.
- **Full RTL** when Arabic is selected (`dir="rtl"` on `<html>`, use Tailwind logical properties like `ms-*`, `ps-*`, `text-start`).
- Arabic-friendly font (e.g. Cairo or Tajawal) + a clean Latin font for English.
- Option to display numbers in Arabic-Indic numerals when in Arabic (nice-to-have).
- Responsive, mobile-first (most students will use phones).
- Loading skeletons, empty states, toasts, and error boundaries.

### Student interface
1. **Dashboard**
   - Hero card: "You are at **Hizb 12 · Part 5**" with a progress ring (X / 480 parts, Y %).
   - A visual **Quran map**: 60 hizb tiles each split into 8 segments, colored as memorized / current / upcoming.
   - Stats cards: attendance rate, passed sessions, current streak of passed sessions, next session date.
   - Chart: progress over time (line) and a status breakdown (donut).
2. **History**: table/timeline of every session: date, part evaluated, status badge (colored + icon), admin note, excuse note.
3. **Profile / Settings**: language, theme, change password.

### Admin interface
1. **Dashboard**: club-wide KPIs, weekly attendance chart, distribution of students by hizb (bar chart), "at risk" students list, recent activity.
2. **Students list**: searchable, filterable, sortable data table; quick view of each student's position, attendance rate, last status; bulk actions; CSV import/export.
3. **Student detail**: same visuals as the student dashboard plus the full history, editable notes, status changes, and the audit trail.
4. **Sessions list**: create a session (default: next weekly date), see summary per session.
5. **Session attendance view (core screen)**
   - List of all active students with their current part shown.
   - One-tap status selector per student: ✅ Passed · 🔁 Not passed · ❌ Absent · 📝 Absent (excused, opens an optional reason field).
   - Optional note per student.
   - Keyboard-friendly and fast, with search/filter, "mark all as absent/unmarked" helpers, and a sticky **Save** bar with unsaved-changes warning.
   - After saving, show a summary (X passed, Y not passed, Z absent).
6. **Reports/Export**: CSV exports with date range filters.

---

## 8. UX Requirements

- Modern, clean, calm visual identity (suggested palette: deep green + gold accent + neutral grays; it should feel respectful and appropriate for the subject).
- Consistent status colors: Passed = green, Not passed = amber, Absent = red, Excused = blue/gray. Never rely on color alone (add icons and labels).
- Accessible: keyboard navigation, focus states, ARIA labels, contrast AA.
- Optimistic updates where safe; clear confirmation for destructive/correcting actions.
- Localized dates (Gregorian by default; optional Hijri date display toggle).
- All user-facing strings come from translation files (`en.json`, `ar.json`), no hardcoded text.

---

## 9. Suggested Project Structure

```
hifz-tracker/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/            # config, security, db (Turso client), deps
│   │   ├── models/          # row mappers / DB access
│   │   ├── schemas/         # Pydantic models
│   │   ├── routers/         # auth.py, me.py, admin_students.py, admin_sessions.py, admin_stats.py
│   │   ├── services/        # progress.py, stats.py, csv_import.py, audit.py
│   │   └── tests/
│   ├── migrations/          # 0001_init.sql ...
│   ├── scripts/             # create_admin.py, seed_demo.py
│   ├── requirements.txt
│   └── .env.example         # TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET, CORS_ORIGINS
├── frontend/
│   ├── src/
│   │   ├── api/             # typed API client (ideally generated from OpenAPI)
│   │   ├── components/      # ui/, charts/, quran-map/, layout/
│   │   ├── features/        # auth/, student/, admin/
│   │   ├── i18n/            # en.json, ar.json, config.ts
│   │   ├── hooks/ lib/ routes/ styles/
│   │   └── main.tsx
│   └── .env.example         # VITE_API_URL
└── README.md
```

---

## 10. Non-Functional Requirements

- **Security:** input validation, parameterized queries only, CORS restricted, password hashing, secure cookies, role checks on every admin route.
- **Data integrity:** all progress-changing operations run in a DB transaction.
- **Testing:** pytest for the progress logic (index conversion, advancing across hizb boundaries, completion, recalculation after editing a record) and for authorization; Vitest/React Testing Library for key components; optional Playwright E2E for the attendance flow.
- **Performance:** pagination on all lists; indexes on foreign keys.
- **Observability:** structured logging, health check endpoint `GET /health`.
- **Privacy:** only admins see other students' data; students see only their own.

---

## 11. Assumptions (change if wrong)

1. Memorization goes in ascending order starting from each student's `start_index` (default Hizb 1 · Part 1). *If the club memorizes in descending order (e.g. starting from Hizb 60), add a per-student or global `direction` setting.*
2. One session per week, one evaluation per student per session, and a student is evaluated on **one part** per session.
3. Admins (club organizers) mark attendance. Students cannot self-check-in.
4. Accounts are created by admins (no public registration).
5. Gregorian dates by default.

---

## 12. Implementation Plan (phases)

1. **Foundation:** repo setup, Turso connection, migrations, FastAPI skeleton, React + Tailwind + i18n (EN/AR + RTL) skeleton, auth (login, JWT, role guards), seed script with an admin and demo students.
2. **Core domain:** progress service + unit tests, students CRUD, sessions CRUD, bulk attendance endpoint, record correction + audit log.
3. **Admin UI:** students list/detail, sessions list, the attendance marking screen.
4. **Student UI:** dashboard (progress ring, Quran map, stats), history page.
5. **Analytics:** admin dashboard charts, at-risk list, CSV import/export.
6. **Polish:** accessibility pass, empty/error states, mobile QA, dark mode, README with setup & deployment instructions.

---

## 13. Acceptance Criteria (summary)

- An admin can create a session, mark every student's status in one screen, save, and each student's position updates correctly (including hizb rollover from part 8 → next hizb part 1, and completion after Hizb 60 · Part 8).
- `NOT_PASSED`, `ABSENT` and `ABSENT_EXCUSED` keep the student on the same part.
- Editing a past record recalculates the student's current position correctly and writes an audit entry.
- A student sees only their own dashboard and history; a student calling an admin endpoint gets `403`.
- The whole UI works in English and Arabic, with correct RTL layout, and the language choice persists.
- The app is usable on a phone.
