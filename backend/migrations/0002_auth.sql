-- Authentication: forced password change on first login and refresh-token rotation.

ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;

CREATE TABLE refresh_tokens (
  id         TEXT PRIMARY KEY,            -- the token's jti
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
