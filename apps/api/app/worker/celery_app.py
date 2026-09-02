from celery import Celery

from app.config import settings

celery_app = Celery("taskpilot", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    beat_schedule={
        "send-due-reminders": {
            "task": "app.worker.tasks.send_due_reminders",
            "schedule": 60.0,
        },
        "send-daily-digests": {
            "task": "app.worker.tasks.send_daily_digests",
            "schedule": 900.0,
        },
    },
)
celery_app.autodiscover_tasks(["app.worker"])
