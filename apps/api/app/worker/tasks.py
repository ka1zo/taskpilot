import asyncio
from datetime import UTC, datetime, time
from html import escape
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select

from app.bot.messages import msg
from app.config import settings
from app.database import SessionLocal
from app.models import Task, TaskStatus, User
from app.worker.celery_app import celery_app


async def telegram_send(chat_id: int, text: str, reply_markup: dict | None = None) -> None:
    if not settings.bot_token:
        return
    payload: dict = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"https://api.telegram.org/bot{settings.bot_token}/sendMessage", json=payload
        )
        response.raise_for_status()


async def _send_due_reminders() -> int:
    now = datetime.now(UTC)
    sent = 0
    async with SessionLocal() as session:
        rows = await session.execute(
            select(Task, User)
            .join(User, User.id == Task.owner_id)
            .where(
                Task.status == TaskStatus.pending,
                Task.remind_at <= now,
                Task.reminder_sent_at.is_(None),
                User.is_active.is_(True),
            )
            .limit(100)
        )
        for task, user in rows:
            language = user.language.value
            prefix = "⏰ <b>Напоминание</b>" if language == "ru" else "⏰ <b>Reminder</b>"
            keyboard = {
                "inline_keyboard": [
                    [
                        {
                            "text": "✅ Выполнить" if language == "ru" else "✅ Complete",
                            "callback_data": f"done:{task.id}",
                        }
                    ]
                ]
            }
            await telegram_send(user.telegram_id, f"{prefix}\n\n{escape(task.title)}", keyboard)
            task.reminder_sent_at = now
            sent += 1
        await session.commit()
    return sent


async def _send_daily_digests() -> int:
    sent = 0
    utc_now = datetime.now(UTC)
    async with SessionLocal() as session:
        users = list(await session.scalars(select(User).where(User.is_active.is_(True))))
        for user in users:
            local_now = utc_now.astimezone(ZoneInfo(user.timezone))
            if (
                local_now.hour != user.daily_digest_hour
                or user.last_digest_date == local_now.date()
            ):
                continue
            start = datetime.combine(local_now.date(), time.min, tzinfo=local_now.tzinfo)
            end = datetime.combine(local_now.date(), time.max, tzinfo=local_now.tzinfo)
            tasks = list(
                await session.scalars(
                    select(Task)
                    .where(
                        Task.owner_id == user.id,
                        Task.status == TaskStatus.pending,
                        Task.due_at >= start,
                        Task.due_at <= end,
                    )
                    .order_by(Task.due_at)
                )
            )
            if tasks:
                heading = msg(user.language.value, "today")
                lines = [f"☀️ <b>{heading}</b>", ""] + [f"• {escape(task.title)}" for task in tasks]
                await telegram_send(user.telegram_id, "\n".join(lines))
                sent += 1
            user.last_digest_date = local_now.date()
        await session.commit()
    return sent


@celery_app.task(name="app.worker.tasks.send_due_reminders")
def send_due_reminders() -> int:
    return asyncio.run(_send_due_reminders())


@celery_app.task(name="app.worker.tasks.send_daily_digests")
def send_daily_digests() -> int:
    return asyncio.run(_send_daily_digests())
