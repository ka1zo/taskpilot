# LinkedIn launch post

I built **TaskPilot**, a Telegram-first personal task manager.

The idea was simple: capturing a task should take no longer than sending a message. A user can write “Call Anna tomorrow 14:30”, and TaskPilot creates the task, schedules the reminder, and synchronizes it with a web dashboard.

What I implemented:

- a bilingual Telegram bot with aiogram;
- a FastAPI REST API and Telegram Mini App authentication;
- PostgreSQL models and Alembic migrations;
- Celery + Redis reminders and daily digests;
- a responsive React/TypeScript dashboard with light and dark themes;
- Docker Compose, automated tests and GitHub Actions CI.

The most interesting parts were securely validating Telegram session data, designing timezone-aware reminders, and separating the bot, API and background workers into independently deployable services.

Tech: Python, FastAPI, aiogram, SQLAlchemy, PostgreSQL, Redis, Celery, React, TypeScript, Docker.

GitHub: https://github.com/ka1zo/taskpilot
Telegram bot: https://t.me/ka1zo1_bot
Demo: add the deployed dashboard URL before publishing this post.

#python #fastapi #telegrambot #react #typescript #postgresql #docker #petproject
