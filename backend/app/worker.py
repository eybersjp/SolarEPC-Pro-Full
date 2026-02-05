from app.core.celery_app import celery_app

# Import tasks to ensure they are registered
# We will create this module next
from app.services import tasks

if __name__ == "__main__":
    celery_app.start()
