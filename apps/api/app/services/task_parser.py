import re
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

TIME_PATTERN = re.compile(r"(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)")
DATE_PATTERN = re.compile(r"(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)")


@dataclass(frozen=True)
class ParsedTask:
    title: str
    due_at: datetime | None


def parse_task_text(
    text: str,
    timezone_name: str = "Europe/Moscow",
    *,
    reference_time: datetime | None = None,
) -> ParsedTask:
    """Parse compact input such as `Call Anna tomorrow 14:30` or its Russian equivalent."""
    tz = ZoneInfo(timezone_name)
    now = reference_time.astimezone(tz) if reference_time else datetime.now(tz)
    normalized = text.strip()
    lower = normalized.lower()
    day = None

    keywords = {
        "сегодня": now.date(),
        "today": now.date(),
        "завтра": now.date() + timedelta(days=1),
        "tomorrow": now.date() + timedelta(days=1),
    }
    for keyword, value in keywords.items():
        if re.search(rf"(?<!\w){keyword}(?!\w)", lower):
            day = value
            normalized = re.sub(rf"(?<!\w){keyword}(?!\w)", "", normalized, flags=re.IGNORECASE)
            break

    date_match = DATE_PATTERN.search(normalized)
    if date_match:
        try:
            day = datetime.strptime(date_match.group(0), "%Y-%m-%d").date()
            normalized = DATE_PATTERN.sub("", normalized, count=1)
        except ValueError:
            pass

    time_match = TIME_PATTERN.search(normalized)
    clock = None
    if time_match:
        clock = time(int(time_match.group(1)), int(time_match.group(2)))
        normalized = TIME_PATTERN.sub("", normalized, count=1)

    if clock and day is None:
        day = now.date()
        if datetime.combine(day, clock, tzinfo=tz) <= now:
            day += timedelta(days=1)

    if clock:
        # Remove a dangling preposition left by phrases such as "в 18:00" or "at 18:00".
        normalized = re.sub(r"\s+(?:в|at)\s*$", "", normalized, flags=re.IGNORECASE)

    due_at = datetime.combine(day, clock or time(9), tzinfo=tz) if day else None
    title = re.sub(r"\s{2,}", " ", normalized).strip(" |,.-")
    return ParsedTask(title=title or text.strip(), due_at=due_at)
