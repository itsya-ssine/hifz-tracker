-- Initial schema: users, students, sessions, attendance, audit log.

CREATE TABLE users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  login          TEXT NOT NULL UNIQUE,
  full_name      TEXT NOT NULL,
  email          TEXT UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('STUDENT','ADMIN')),
  preferred_lang TEXT NOT NULL DEFAULT 'en' CHECK (preferred_lang IN ('en','ar')),
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE students (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  start_index   INTEGER NOT NULL DEFAULT 1 CHECK (start_index BETWEEN 1 AND 480),
  current_index INTEGER NOT NULL DEFAULT 1 CHECK (current_index BETWEEN 1 AND 481),
  joined_at     TEXT NOT NULL DEFAULT (date('now')),
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','COMPLETED','LEFT')),
  notes         TEXT
);

CREATE TABLE sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_date TEXT NOT NULL UNIQUE,
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
  excuse_note TEXT,
  admin_note  TEXT,
  marked_by   INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, student_id)
);

CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id   INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  old_value  TEXT,
  new_value  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_attendance_student ON attendance_records(student_id);
CREATE INDEX idx_attendance_session ON attendance_records(session_id);
