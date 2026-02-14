import os
from celery import Celery


# Guard at import time: if PYTEST_CURRENT_TEST or CELERY_TASK_ALWAYS_EAGER
# is set, force BROKER_URL and BACKEND_URL to memory:// unconditionally.
# This MUST happen before Celery() is instantiated to prevent any Redis
# connection attempts during tests.
IS_TEST_ENV = (
    os.getenv("CELERY_TASK_ALWAYS_EAGER", "").lower() in ("true", "1", "yes")
    or "PYTEST_CURRENT_TEST" in os.environ
)

if IS_TEST_ENV:
    # FORCE memory backend/broker during tests to avoid Redis completely
    BROKER_URL = "memory://"
    BACKEND_URL = "memory://"
else:
    # Use Redis in non-test environments
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    BROKER_URL = REDIS_URL
    BACKEND_URL = REDIS_URL

# Safety latch: double check we aren't using Redis in tests
if IS_TEST_ENV and (BROKER_URL.startswith("redis://") or BACKEND_URL.startswith("redis://")):
    BROKER_URL = "memory://"
    BACKEND_URL = "memory://"

celery_app = Celery(
    "worker",
    broker=BROKER_URL,
    backend=BACKEND_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)

if IS_TEST_ENV:
    celery_app.conf.update(
        task_always_eager=True,
        task_eager_propagates=True,
        # Ensure the broker and backend are also overridden at the conf level
        broker_url="memory://",
        result_backend="cache+memory://",
    )
