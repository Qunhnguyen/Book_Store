"""
Simple in-memory Circuit Breaker for downstream HTTP calls.

States:
  CLOSED   → normal, requests pass through
  OPEN     → short-circuits, returns 503 immediately
  HALF_OPEN → one probe request allowed to test recovery

Usage:
    cb = CircuitBreaker(name="book-service", failure_threshold=5, recovery_timeout=30)
    with cb:
        response = requests.get(...)
"""

import logging
import threading
import time

logger = logging.getLogger(__name__)


class CircuitBreakerOpen(Exception):
    pass


class CircuitBreaker:
    STATE_CLOSED = "CLOSED"
    STATE_OPEN = "OPEN"
    STATE_HALF_OPEN = "HALF_OPEN"

    def __init__(self, name: str, failure_threshold: int = 5, recovery_timeout: int = 30):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout

        self._state = self.STATE_CLOSED
        self._failure_count = 0
        self._last_failure_time: float = 0.0
        self._lock = threading.Lock()

    @property
    def state(self):
        with self._lock:
            if self._state == self.STATE_OPEN and self._last_failure_time > 0:
                if time.time() - self._last_failure_time >= self.recovery_timeout:
                    self._state = self.STATE_HALF_OPEN
                    logger.info("[CB:%s] OPEN → HALF_OPEN (probe allowed)", self.name)
            return self._state

    def __enter__(self):
        state = self.state
        if state == self.STATE_OPEN:
            raise CircuitBreakerOpen(f"Circuit breaker '{self.name}' is OPEN")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self._on_success()
        else:
            self._on_failure()
        return False  # do not suppress exceptions

    def _on_success(self):
        with self._lock:
            if self._state == self.STATE_HALF_OPEN:
                logger.info("[CB:%s] HALF_OPEN → CLOSED (recovery)", self.name)
            self._state = self.STATE_CLOSED
            self._failure_count = 0

    def _on_failure(self):
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()
            if self._failure_count >= self.failure_threshold or self._state == self.STATE_HALF_OPEN:
                if self._state != self.STATE_OPEN:
                    logger.warning(
                        "[CB:%s] → OPEN after %d failures", self.name, self._failure_count
                    )
                self._state = self.STATE_OPEN


# One circuit breaker per downstream service (module-level singletons)
_breakers: dict[str, CircuitBreaker] = {}
_breakers_lock = threading.Lock()


def get_breaker(service_name: str) -> CircuitBreaker:
    with _breakers_lock:
        if service_name not in _breakers:
            _breakers[service_name] = CircuitBreaker(name=service_name)
        return _breakers[service_name]
