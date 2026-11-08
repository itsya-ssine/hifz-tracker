"""Thin async wrapper around the Turso (libSQL) client.

All statements are parameterized. Use ``batch`` for anything that must be atomic:
the statements run inside a single transaction and are rolled back on failure.
"""

from collections.abc import Sequence
from typing import Any

import libsql_client
from libsql_client import ResultSet

Args = Sequence[Any] | None
Statement = tuple[str, Args] | str


def normalize_url(url: str) -> str:
    """libsql:// uses websockets by default; plain HTTPS is more reliable for a web backend."""
    if url.startswith("libsql://"):
        return "https://" + url.removeprefix("libsql://")
    return url


class Database:
    def __init__(self, client: libsql_client.Client) -> None:
        self._client = client

    @classmethod
    def connect(cls, url: str, auth_token: str | None = None) -> "Database":
        client = libsql_client.create_client(normalize_url(url), auth_token=auth_token or None)
        return cls(client)

    async def close(self) -> None:
        await self._client.close()

    async def execute(self, sql: str, args: Args = None) -> ResultSet:
        return await self._client.execute(sql, list(args) if args is not None else None)

    async def fetch_all(self, sql: str, args: Args = None) -> list[dict[str, Any]]:
        result = await self.execute(sql, args)
        return [row.asdict() for row in result.rows]

    async def fetch_one(self, sql: str, args: Args = None) -> dict[str, Any] | None:
        result = await self.execute(sql, args)
        return result.rows[0].asdict() if result.rows else None

    async def fetch_value(self, sql: str, args: Args = None) -> Any:
        result = await self.execute(sql, args)
        return result.rows[0][0] if result.rows else None

    async def batch(self, statements: Sequence[Statement]) -> list[ResultSet]:
        """Run several statements atomically (all succeed or none are applied)."""
        prepared: list[Any] = [
            (s, None) if isinstance(s, str) else (s[0], list(s[1]) if s[1] is not None else None)
            for s in statements
        ]
        return await self._client.batch(prepared)
