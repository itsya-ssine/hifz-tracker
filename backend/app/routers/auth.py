from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Request, Response, status

from app.core.errors import AppError
from app.core.rate_limit import LoginRateLimiter
from app.core.security import (
    DUMMY_HASH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    to_iso,
    utc_now,
    verify_password,
)
from app.deps import ACCESS_COOKIE, REFRESH_COOKIE, CurrentUser, DbDep, SettingsDep
from app.models import refresh_tokens, users
from app.schemas.auth import ChangePasswordRequest, LoginRequest, ProfileUpdate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_PATH = "/api/v1/auth"
# A just-rotated token may be replayed by a second tab; don't treat that as theft.
ROTATION_GRACE = timedelta(seconds=10)


def _set_auth_cookies(response: Response, settings, user_id: int, role: str, refresh_token: str):
    common = {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
    }
    response.set_cookie(
        ACCESS_COOKIE,
        create_access_token(user_id, role, settings),
        max_age=settings.access_token_minutes * 60,
        path="/",
        **common,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        max_age=settings.refresh_token_days * 24 * 3600,
        path=REFRESH_COOKIE_PATH,
        **common,
    )


def _clear_auth_cookies(response: Response, settings) -> None:
    common = {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
    }
    response.delete_cookie(ACCESS_COOKIE, path="/", **common)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, **common)


async def _issue_session(db, settings, response: Response, user: dict[str, Any], extra=()):
    """Create a refresh token (plus any extra atomic statements) and set both cookies."""
    token, jti, expires_at = create_refresh_token(user["id"], settings)
    await db.batch(
        [
            *extra,
            refresh_tokens.purge_expired_statement(user["id"]),
            refresh_tokens.insert_statement(jti, user["id"], expires_at),
        ]
    )
    _set_auth_cookies(response, settings, user["id"], user["role"], token)


@router.post("/login", response_model=UserOut)
async def login(
    payload: LoginRequest, request: Request, response: Response, db: DbDep, settings: SettingsDep
):
    limiter: LoginRateLimiter = request.app.state.login_limiter
    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}:{payload.login.strip().lower()}"
    limiter.check(key)

    row = await users.get_for_login(db, payload.login)
    valid = verify_password(row["password_hash"] if row else DUMMY_HASH, payload.password)
    if row is None or not valid or not row["is_active"]:
        limiter.register_failure(key)
        raise AppError(401, "INVALID_CREDENTIALS", "Invalid login or password")

    limiter.reset(key)
    user = users.public_user(row)
    await _issue_session(db, settings, response, user)
    return user


@router.post("/refresh", response_model=UserOut)
async def refresh(request: Request, response: Response, db: DbDep, settings: SettingsDep):
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise AppError(401, "NOT_AUTHENTICATED", "Not authenticated")
    payload = decode_token(token, "refresh", settings)
    jti, user_id = payload["jti"], int(payload["sub"])

    stored = await refresh_tokens.get(db, jti)
    if stored is None:
        raise AppError(401, "TOKEN_INVALID", "Invalid token")
    if stored["revoked_at"] is not None:
        grace_limit = to_iso(utc_now() - ROTATION_GRACE)
        if stored["revoked_at"] < grace_limit:
            # Old token replayed well after rotation: assume theft, kill every session.
            await db.batch([refresh_tokens.revoke_all_statement(user_id)])
        raise AppError(401, "TOKEN_REVOKED", "Session revoked")

    row = await users.get_by_id(db, user_id)
    if row is None or not row["is_active"]:
        raise AppError(401, "NOT_AUTHENTICATED", "Not authenticated")

    user = users.public_user(row)
    await _issue_session(db, settings, response, user, extra=[refresh_tokens.revoke_statement(jti)])
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, db: DbDep, settings: SettingsDep):
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        try:
            payload = decode_token(token, "refresh", settings)
            await db.batch([refresh_tokens.revoke_statement(payload["jti"])])
        except AppError:
            pass  # expired/invalid token: nothing to revoke
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_auth_cookies(response, settings)
    return response


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(payload: ProfileUpdate, user: CurrentUser, db: DbDep):
    await users.update_profile(
        db, user["id"], full_name=payload.full_name, preferred_lang=payload.preferred_lang
    )
    updated = await users.get_by_id(db, user["id"])
    return users.public_user(updated)


@router.post("/change-password", response_model=UserOut)
async def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    user: CurrentUser,
    db: DbDep,
    settings: SettingsDep,
):
    current_hash = await users.get_password_hash(db, user["id"])
    if not current_hash or not verify_password(current_hash, payload.current_password):
        raise AppError(400, "WRONG_PASSWORD", "Current password is incorrect")
    if payload.new_password == payload.current_password:
        raise AppError(400, "PASSWORD_UNCHANGED", "New password must be different")

    updated_user = {**user, "must_change_password": False}
    # Change the password and revoke every old session, then keep this one signed in.
    await _issue_session(
        db,
        settings,
        response,
        updated_user,
        extra=[
            users.set_password_statement(user["id"], hash_password(payload.new_password)),
            refresh_tokens.revoke_all_statement(user["id"]),
        ],
    )
    return updated_user
