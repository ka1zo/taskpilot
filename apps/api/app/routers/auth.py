from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.security import TelegramAuthError, create_access_token, validate_telegram_init_data
from app.dependencies import SessionDep
from app.models import Language, User
from app.schemas import TelegramAuthRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/telegram", response_model=TokenResponse)
async def telegram_auth(payload: TelegramAuthRequest, session: SessionDep) -> TokenResponse:
    try:
        telegram_user = validate_telegram_init_data(payload.init_data)
    except TelegramAuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc

    telegram_id = int(telegram_user["id"])
    user = await session.scalar(select(User).where(User.telegram_id == telegram_id))
    if user is None:
        language = Language.en if telegram_user.get("language_code") == "en" else Language.ru
        user = User(
            telegram_id=telegram_id,
            username=telegram_user.get("username"),
            first_name=telegram_user.get("first_name"),
            language=language,
        )
        session.add(user)
    else:
        user.username = telegram_user.get("username")
        user.first_name = telegram_user.get("first_name")
    await session.commit()
    return TokenResponse(access_token=create_access_token(telegram_id))
