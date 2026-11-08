import time
from collections import defaultdict, deque

from app.core.errors import AppError


class LoginRateLimiter:
    """In-memory limiter: ``max_failures`` failed attempts per key within ``window_seconds``.

    Good enough for a single backend instance. Use a shared store (e.g. Redis)
    if the API is ever scaled horizontally.
    """

    def __init__(self, max_failures: int = 5, window_seconds: int = 15 * 60) -> None:
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, key: str, now: float) -> deque[float]:
        attempts = self._failures[key]
        while attempts and now - attempts[0] > self.window_seconds:
            attempts.popleft()
        if not attempts:
            self._failures.pop(key, None)
            return deque()
        return attempts

    def check(self, key: str) -> None:
        if len(self._prune(key, time.monotonic())) >= self.max_failures:
            raise AppError(
                429, "TOO_MANY_ATTEMPTS", "Too many failed login attempts. Try again later."
            )

    def register_failure(self, key: str) -> None:
        self._failures[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)
