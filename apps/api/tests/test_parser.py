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


def test_parses_time_without_explicit_day() -> None:
    reference = datetime(2026, 9, 3, 17, 0, tzinfo=ZoneInfo("Europe/Moscow"))
    parsed = parse_task_text("Купить молоко в 18:00", reference_time=reference)

    assert parsed.title == "Купить молоко"
    assert parsed.due_at is not None
    assert parsed.due_at.isoformat() == "2026-09-03T18:00:00+03:00"


def test_rolls_time_without_day_to_tomorrow_when_needed() -> None:
    reference = datetime(2026, 9, 3, 19, 0, tzinfo=ZoneInfo("Europe/Moscow"))
    parsed = parse_task_text("Buy milk at 18:00", reference_time=reference)

    assert parsed.title == "Buy milk"
    assert parsed.due_at is not None
    assert parsed.due_at.isoformat() == "2026-09-04T18:00:00+03:00"
