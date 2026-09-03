import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import BotCommand

from app.bot.handlers import router
from app.config import settings


async def configure_bot_profile(bot: Bot) -> None:
    commands_en = [
        BotCommand(command="new", description="Create a task"),
        BotCommand(command="today", description="Today's tasks"),
        BotCommand(command="tasks", description="All active tasks"),
        BotCommand(command="language", description="Change language"),
        BotCommand(command="settings", description="Settings"),
        BotCommand(command="help", description="Help"),
    ]
    commands_ru = [
        BotCommand(command="new", description="Создать задачу"),
        BotCommand(command="today", description="Задачи на сегодня"),
        BotCommand(command="tasks", description="Все активные задачи"),
        BotCommand(command="language", description="Сменить язык"),
        BotCommand(command="settings", description="Настройки"),
        BotCommand(command="help", description="Помощь"),
    ]
    await bot.set_my_commands(commands_en)
    await bot.set_my_commands(commands_ru, language_code="ru")
    await bot.set_my_short_description("A bilingual personal task manager.")
    await bot.set_my_short_description(
        "Персональный менеджер задач на русском и английском.", language_code="ru"
    )
    await bot.set_my_description(
        "Send a task as a normal message. TaskPilot will save its due date, remind you, "
        "and keep your task list organized. English and Russian are supported."
    )
    await bot.set_my_description(
        "Отправь задачу обычным сообщением — TaskPilot сохранит срок, напомнит о деле "
        "и поможет управлять списком задач. Поддерживаются русский и английский языки.",
        language_code="ru",
    )


async def main() -> None:
    if not settings.bot_token:
        raise RuntimeError("BOT_TOKEN is required")
    logging.basicConfig(level=logging.INFO)
    bot = Bot(settings.bot_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dispatcher = Dispatcher()
    dispatcher.include_router(router)
    await bot.delete_webhook(drop_pending_updates=False)
    await configure_bot_profile(bot)
    await dispatcher.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
