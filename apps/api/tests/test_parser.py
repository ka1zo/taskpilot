from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.services.task_parser import parse_task_text


def test_parses_russian_tomorrow_with_time() -> None:
    parsed = parse_task_text("Позвонить Анне завтра 14:30")
    tomorrow = datetime.now(ZoneInfo("Europe/Moscow")).date() + timedelta(days=1)
    assert parsed.title == "Позвонить Анне"
    assert parsed.due_at is not None
    assert parsed.due_at.date() == tomorrow
    assert (parsed.due_at.hour, parsed.due_at.minute) == (14, 30)


def test_parses_english_iso_date() -> None:
    parsed = parse_task_text("Ship portfolio 2026-12-20 09:15", "UTC")
    assert parsed.title == "Ship portfolio"
    assert parsed.due_at is not None
    assert parsed.due_at.isoformat() == "2026-12-20T09:15:00+00:00"


def test_plain_text_has_no_deadline() -> None:
    parsed = parse_task_text("Read Clean Architecture")
    assert parsed.title == "Read Clean Architecture"
    assert parsed.due_at is None
