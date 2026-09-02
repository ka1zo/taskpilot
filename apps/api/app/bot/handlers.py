from datetime import datetime, time
from html import escape
from zoneinfo import ZoneInfo

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, Message
from sqlalchemy import select

from app.bot.keyboards import language_keyboard, task_keyboard
from app.bot.messages import msg
from app.database import SessionLocal
from app.models import Language, Task, TaskStatus, User
from app.services.task_parser import parse_task_text

router = Router()


async def get_or_create_user(telegram_user) -> User:
    async with SessionLocal() as session:
        user = await session.scalar(select(User).where(User.telegram_id == telegram_user.id))
        if user is None:
            preferred = Language.en if telegram_user.language_code == "en" else Language.ru
            user = User(
                telegram_id=telegram_user.id,
                username=telegram_user.username,
                first_name=telegram_user.first_name,
                language=preferred,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
        return user


@router.message(CommandStart())
async def start(message: Message) -> None:
    user = await get_or_create_user(message.from_user)
    language = user.language.value
    await message.answer(
        msg(language, "welcome", name=escape(user.first_name or "friend")),
        reply_markup=language_keyboard(),
    )


@router.message(Command("language"))
async def choose_language(message: Message) -> None:
    user = await get_or_create_user(message.from_user)
    await message.answer(msg(user.language.value, "language"), reply_markup=language_keyboard())


@router.callback_query(F.data.startswith("lang:"))
async def set_language(callback: CallbackQuery) -> None:
    value = callback.data.split(":", 1)[1]
    if value not in {"ru", "en"}:
        await callback.answer()
        return
    async with SessionLocal() as session:
        user = await session.scalar(select(User).where(User.telegram_id == callback.from_user.id))
        if user is None:
            user = User(telegram_id=callback.from_user.id, language=Language(value))
            session.add(user)
        else:
            user.language = Language(value)
        await session.commit()
    await callback.message.edit_text(msg(value, "language_saved"))
    await callback.answer()


async def create_from_text(message: Message, raw_text: str) -> None:
    user = await get_or_create_user(message.from_user)
    parsed = parse_task_text(raw_text, user.timezone)
    async with SessionLocal() as session:
        owner = await session.scalar(select(User).where(User.id == user.id))
        task = Task(owner_id=owner.id, title=parsed.title, due_at=parsed.due_at)
        if parsed.due_at:
            task.remind_at = parsed.due_at
        session.add(task)
        await session.commit()
        await session.refresh(task)
    due = (
        msg(user.language.value, "due", value=parsed.due_at.strftime("%d.%m %H:%M"))
        if parsed.due_at
        else ""
    )
    await message.answer(
        msg(user.language.value, "created", title=escape(parsed.title), due=due),
        reply_markup=task_keyboard(task.id, user.language.value),
    )


@router.message(Command("new"))
async def new_task(message: Message) -> None:
    text = (message.text or "").partition(" ")[2].strip()
    if not text:
        user = await get_or_create_user(message.from_user)
        hint = (
            "Напиши задачу после /new"
            if user.language == Language.ru
            else "Write a task after /new"
        )
        await message.answer(hint)
        return
    await create_from_text(message, text)


async def send_task_list(message: Message, today_only: bool) -> None:
    user = await get_or_create_user(message.from_user)
    async with SessionLocal() as session:
        query = select(Task).where(Task.owner_id == user.id, Task.status == TaskStatus.pending)
        if today_only:
            tz = ZoneInfo(user.timezone)
            now = datetime.now(tz)
            start = datetime.combine(now.date(), time.min, tzinfo=tz)
            end = datetime.combine(now.date(), time.max, tzinfo=tz)
            query = query.where(Task.due_at >= start, Task.due_at <= end)
        result = list(
            await session.scalars(query.order_by(Task.due_at.asc().nullslast()).limit(15))
        )
    if not result:
        await message.answer(msg(user.language.value, "empty"))
        return
    heading = msg(user.language.value, "today" if today_only else "all")
    lines = [f"<b>{heading}</b>", ""]
    for index, task in enumerate(result, 1):
        due = task.due_at.strftime(" · %d.%m %H:%M") if task.due_at else ""
        lines.append(f"{index}. {escape(task.title)}{due}")
    await message.answer("\n".join(lines))


@router.message(Command("today"))
async def today(message: Message) -> None:
    await send_task_list(message, today_only=True)


@router.message(Command("tasks"))
async def tasks(message: Message) -> None:
    await send_task_list(message, today_only=False)


@router.message(Command("settings"))
async def user_settings(message: Message) -> None:
    user = await get_or_create_user(message.from_user)
    await message.answer(
        msg(user.language.value, "settings", timezone=user.timezone, hour=user.daily_digest_hour)
    )


@router.message(Command("help"))
async def help_command(message: Message) -> None:
    user = await get_or_create_user(message.from_user)
    await message.answer(msg(user.language.value, "help"))


@router.callback_query(F.data.startswith("done:"))
async def complete_task(callback: CallbackQuery) -> None:
    task_id = int(callback.data.split(":", 1)[1])
    async with SessionLocal() as session:
        task = await session.scalar(
            select(Task)
            .join(User)
            .where(Task.id == task_id, User.telegram_id == callback.from_user.id)
        )
        user = await session.scalar(select(User).where(User.telegram_id == callback.from_user.id))
        if task is None or user is None:
            await callback.answer("Task not found", show_alert=True)
            return
        task.status = TaskStatus.completed
        task.completed_at = datetime.now(ZoneInfo("UTC"))
        await session.commit()
    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.answer(msg(user.language.value, "done"))


@router.message(F.text)
async def plain_text_task(message: Message) -> None:
    await create_from_text(message, message.text)
