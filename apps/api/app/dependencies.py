from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import decode_access_token
from app.database import get_session
from app.models import User

bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    session: Annotated[AsyncSession, Depends(get_session)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    x_telegram_user_id: Annotated[int | None, Header()] = None,
) -> User:
    telegram_id: int | None = None
    if credentials:
        try:
            telegram_id = decode_access_token(credentials.credentials)
        except ValueError as exc:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid access token") from exc
    elif settings.dev_auth_enabled and x_telegram_user_id:
        telegram_id = x_telegram_user_id

    if telegram_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")

    user = await session.scalar(select(User).where(User.telegram_id == telegram_id))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


SessionDep = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]
