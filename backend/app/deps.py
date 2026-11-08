from typing import Annotated, Any

from fastapi import Depends, Request

from app.core.config import Settings, get_settings
from app.core.db import Database
from app.core.errors import AppError
from app.core.security import decode_token
from app.models import users

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"


def get_db(request: Request) -> Database:
    return request.app.state.db


DbDep = Annotated[Database, Depends(get_db)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


async def get_current_user(request: Request, db: DbDep, settings: SettingsDep) -> dict[str, Any]:
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise AppError(401, "NOT_AUTHENTICATED", "Not authenticated")
    payload = decode_token(token, "access", settings)
    user = await users.get_by_id(db, int(payload["sub"]))
    if user is None or not user["is_active"]:
        raise AppError(401, "NOT_AUTHENTICATED", "Not authenticated")
    return users.public_user(user)


CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


def _require_role(role: str):
    async def dependency(user: CurrentUser) -> dict[str, Any]:
        if user["role"] != role:
            raise AppError(403, "FORBIDDEN", "You do not have access to this resource")
        if user["must_change_password"]:
            raise AppError(403, "PASSWORD_CHANGE_REQUIRED", "You must change your password first")
        return user

    return dependency


require_admin = _require_role("ADMIN")
require_student = _require_role("STUDENT")

AdminUser = Annotated[dict[str, Any], Depends(require_admin)]
StudentUser = Annotated[dict[str, Any], Depends(require_student)]
