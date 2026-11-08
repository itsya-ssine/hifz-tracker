import asyncio
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.db import Database
from app.core.security import to_iso

SECRET = "test-secret-test-secret-test-secret"


def login(client, who="alice", password="password123"):
    return client.post("/api/v1/auth/login", json={"login": who, "password": password})


def set_db(db_url, sql, args=None):
    async def run():
        database = Database.connect(db_url)
        try:
            await database.execute(sql, args)
        finally:
            await database.close()

    asyncio.run(run())


def get_db_value(db_url, sql, args=None):
    async def run():
        database = Database.connect(db_url)
        try:
            return await database.fetch_all(sql, args)
        finally:
            await database.close()

    return asyncio.run(run())


# --- login --------------------------------------------------------------------


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_login_success_sets_httponly_cookies_and_returns_user(client, make_user):
    make_user("alice", full_name="Alice A", email="Alice@Example.com")
    response = login(client)

    assert response.status_code == 200
    body = response.json()
    assert body["login"] == "alice"
    assert body["role"] == "STUDENT"
    assert body["full_name"] == "Alice A"
    assert "password_hash" not in body and "password" not in body

    set_cookie = response.headers.get_list("set-cookie")
    assert any(c.startswith("access_token=") and "HttpOnly" in c for c in set_cookie)
    assert any(
        c.startswith("refresh_token=") and "HttpOnly" in c and "Path=/api/v1/auth" in c
        for c in set_cookie
    )
    assert client.get("/api/v1/auth/me").json()["login"] == "alice"


def test_login_with_email_and_case_insensitive(client, make_user):
    make_user("alice", email="alice@example.com")
    assert login(client, "ALICE@example.com").status_code == 200


@pytest.mark.parametrize(
    ("who", "password"), [("alice", "wrong-password"), ("ghost", "password123")]
)
def test_login_failure_is_generic(client, make_user, who, password):
    make_user("alice")
    response = login(client, who, password)
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid login or password", "code": "INVALID_CREDENTIALS"}


def test_inactive_user_cannot_login(client, make_user, db_url):
    make_user("alice")
    set_db(db_url, "UPDATE users SET is_active = 0 WHERE login = 'alice'")
    assert login(client).status_code == 401


def test_login_is_rate_limited(client, make_user):
    make_user("alice")
    for _ in range(5):
        assert login(client, password="nope").status_code == 401
    blocked = login(client)  # even the right password is refused now
    assert blocked.status_code == 429
    assert blocked.json()["code"] == "TOO_MANY_ATTEMPTS"


def test_login_validation_error_format(client):
    response = client.post("/api/v1/auth/login", json={"login": ""})
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


# --- current user / tokens ---------------------------------------------------


def test_me_requires_authentication(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["code"] == "NOT_AUTHENTICATED"


def test_expired_access_token_is_rejected(client, make_user):
    make_user("alice")
    past = datetime.now(UTC) - timedelta(minutes=1)
    token = jwt.encode(
        {"sub": "1", "role": "STUDENT", "type": "access", "exp": past}, SECRET, algorithm="HS256"
    )
    response = client.get("/api/v1/auth/me", headers={"Cookie": f"access_token={token}"})
    assert response.status_code == 401
    assert response.json()["code"] == "TOKEN_EXPIRED"


def test_refresh_token_cannot_be_used_as_access_token(client, make_user):
    make_user("alice")
    login(client)
    refresh_token = client.cookies.get("refresh_token", path="/api/v1/auth")
    response = client.get("/api/v1/auth/me", headers={"Cookie": f"access_token={refresh_token}"})
    assert response.status_code == 401
    assert response.json()["code"] == "TOKEN_INVALID"


def test_garbage_token_is_rejected(client):
    response = client.get("/api/v1/auth/me", headers={"Cookie": "access_token=not-a-jwt"})
    assert response.status_code == 401


# --- refresh rotation ----------------------------------------------------------


def test_refresh_rotates_token_and_detects_replay(client, make_user, db_url):
    make_user("alice")
    login(client)
    old_refresh = client.cookies.get("refresh_token", path="/api/v1/auth")

    refreshed = client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    new_refresh = client.cookies.get("refresh_token", path="/api/v1/auth")
    assert new_refresh and new_refresh != old_refresh

    # Replaying the old token right away: refused, but the new session survives (grace window).
    replay = client.post("/api/v1/auth/refresh", headers={"Cookie": f"refresh_token={old_refresh}"})
    assert replay.status_code == 401 and replay.json()["code"] == "TOKEN_REVOKED"
    assert client.post("/api/v1/auth/refresh").status_code == 200

    # Replay long after rotation looks like theft: every session of the user is revoked.
    old_time = to_iso(datetime.now(UTC) - timedelta(minutes=5))
    set_db(db_url, "UPDATE refresh_tokens SET revoked_at = ? WHERE revoked_at IS NOT NULL", [old_time])
    assert (
        client.post("/api/v1/auth/refresh", headers={"Cookie": f"refresh_token={old_refresh}"}).status_code
        == 401
    )
    current = client.cookies.get("refresh_token", path="/api/v1/auth")
    assert (
        client.post("/api/v1/auth/refresh", headers={"Cookie": f"refresh_token={current}"}).status_code
        == 401
    )


def test_refresh_without_cookie(client):
    assert client.post("/api/v1/auth/refresh").status_code == 401


# --- logout --------------------------------------------------------------------


def test_logout_clears_cookies_and_revokes_refresh_token(client, make_user):
    make_user("alice")
    login(client)
    refresh_token = client.cookies.get("refresh_token", path="/api/v1/auth")

    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401
    replay = client.post("/api/v1/auth/refresh", headers={"Cookie": f"refresh_token={refresh_token}"})
    assert replay.status_code == 401


def test_logout_without_session_is_fine(client):
    assert client.post("/api/v1/auth/logout").status_code == 204


# --- profile & password ---------------------------------------------------------


def test_update_profile(client, make_user):
    make_user("alice")
    login(client)
    response = client.patch("/api/v1/auth/me", json={"preferred_lang": "ar", "full_name": " Alice B "})
    assert response.status_code == 200
    assert response.json()["preferred_lang"] == "ar"
    assert response.json()["full_name"] == "Alice B"
    assert client.patch("/api/v1/auth/me", json={"preferred_lang": "fr"}).status_code == 422


def test_change_password_flow(client, make_user):
    make_user("alice", must_change_password=True)
    assert login(client).json()["must_change_password"] is True

    wrong = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "nope-nope", "new_password": "brand-new-pass"},
    )
    assert wrong.status_code == 400 and wrong.json()["code"] == "WRONG_PASSWORD"

    same = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "password123", "new_password": "password123"},
    )
    assert same.status_code == 400 and same.json()["code"] == "PASSWORD_UNCHANGED"

    short = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "password123", "new_password": "short"},
    )
    assert short.status_code == 422

    other_session_refresh = client.cookies.get("refresh_token", path="/api/v1/auth")
    ok = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "password123", "new_password": "brand-new-pass"},
    )
    assert ok.status_code == 200 and ok.json()["must_change_password"] is False
    assert client.get("/api/v1/auth/me").status_code == 200  # still signed in

    # Old sessions are revoked, old password no longer works, new one does.
    assert (
        client.post(
            "/api/v1/auth/refresh", headers={"Cookie": f"refresh_token={other_session_refresh}"}
        ).status_code
        == 401
    )
    client.post("/api/v1/auth/logout")
    assert login(client).status_code == 401
    assert login(client, password="brand-new-pass").status_code == 200


# --- role guards ----------------------------------------------------------------


def test_role_guards(client, make_user):
    make_user("admin1", role="ADMIN")
    make_user("alice", role="STUDENT")

    assert client.get("/_test/admin").status_code == 401

    login(client, "alice")
    denied = client.get("/_test/admin")
    assert denied.status_code == 403 and denied.json()["code"] == "FORBIDDEN"
    assert client.get("/_test/student").status_code == 200
    client.post("/api/v1/auth/logout")

    login(client, "admin1")
    assert client.get("/_test/admin").status_code == 200
    assert client.get("/_test/student").status_code == 403


def test_password_change_required_blocks_role_routes(client, make_user):
    make_user("admin1", role="ADMIN", must_change_password=True)
    login(client, "admin1")
    blocked = client.get("/_test/admin")
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "PASSWORD_CHANGE_REQUIRED"
    assert client.get("/api/v1/auth/me").status_code == 200  # /me stays reachable
