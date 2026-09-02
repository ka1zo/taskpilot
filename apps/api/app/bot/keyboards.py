from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from app.config import settings


def language_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🇷🇺 Русский", callback_data="lang:ru"),
                InlineKeyboardButton(text="🇬🇧 English", callback_data="lang:en"),
            ]
        ]
    )


def task_keyboard(task_id: int, language: str) -> InlineKeyboardMarkup:
    done = "✅ Выполнить" if language == "ru" else "✅ Complete"
    buttons = [[InlineKeyboardButton(text=done, callback_data=f"done:{task_id}")]]
    if settings.web_app_url:
        label = "Открыть панель ↗" if language == "ru" else "Open dashboard ↗"
        buttons.append(
            [InlineKeyboardButton(text=label, web_app=WebAppInfo(url=settings.web_app_url))]
        )
    return InlineKeyboardMarkup(inline_keyboard=buttons)
