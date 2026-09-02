import hashlib
import hmac
import json
import time
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qsl

import jwt

from app.config import settings


class TelegramAuthError(ValueError):
    pass


def validate_telegram_init_data(init_data: str) -> dict:
    if not settings.bot_token:
        raise TelegramAuthError("BOT_TOKEN is not configured")

    values = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = values.pop("hash", None)
    if not received_hash:
        raise TelegramAuthError("Telegram hash is missing")

    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(values.items()))
    secret_key = hmac.new(b"WebAppData", settings.bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_hash, received_hash):
        raise TelegramAuthError("Invalid Telegram signature")

    auth_date = int(values.get("auth_date", "0"))
    if time.time() - auth_date > settings.telegram_auth_max_age_seconds:
        raise TelegramAuthError("Telegram data has expired")

    try:
        return json.loads(values["user"])
    except (KeyError, json.JSONDecodeError) as exc:
        raise TelegramAuthError("Telegram user is missing") from exc


def create_access_token(telegram_id: int) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(telegram_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_access_token(token: str) -> int:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise ValueError("Invalid access token") from exc
