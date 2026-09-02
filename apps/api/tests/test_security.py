import hashlib
import hmac
import json
import time
from urllib.parse import urlencode

from app.config import settings
from app.core.security import validate_telegram_init_data


def test_validates_telegram_signature(monkeypatch) -> None:
    token = "123456:test-token"
    monkeypatch.setattr(settings, "bot_token", token)
    values = {
        "auth_date": str(int(time.time())),
        "query_id": "AAExample",
        "user": json.dumps({"id": 42, "first_name": "Alex"}, separators=(",", ":")),
    }
    check = "\n".join(f"{key}={value}" for key, value in sorted(values.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    values["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()

    result = validate_telegram_init_data(urlencode(values))
    assert result["id"] == 42
