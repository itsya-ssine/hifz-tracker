from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.db import Database
from app.core.errors import register_exception_handlers
from app.core.rate_limit import LoginRateLimiter
from app.routers import auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.db = Database.connect(settings.turso_database_url, settings.turso_auth_token)
    app.state.login_limiter = LoginRateLimiter()
    try:
        yield
    finally:
        await app.state.db.close()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Hifz Tracker API", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
    )
    register_exception_handlers(app)

    @app.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router, prefix="/api/v1")
    return app

