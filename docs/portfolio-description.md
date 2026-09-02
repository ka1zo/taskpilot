# Portfolio description

## Short version

TaskPilot is a bilingual Telegram-first task manager. Users create tasks in natural language, receive reminders and daily digests, complete tasks from inline buttons, and manage everything from a responsive web dashboard.

## CV version

Built a production-oriented task management platform with FastAPI, aiogram, PostgreSQL, Redis, Celery and React/TypeScript. Implemented Telegram Mini App authentication with server-side HMAC verification, asynchronous background reminders, per-user localization and timezone-aware scheduling. Containerized the multi-service system and added database migrations, automated tests and GitHub Actions CI.

## Highlights to discuss in an interview

- Why Telegram is the primary capture interface and the web app is the planning surface.
- How ownership checks prevent one user from accessing another user's tasks.
- Why reminders run in a background queue instead of inside the bot process.
- How Telegram `initData` is verified before issuing an application JWT.
- How timestamps are stored in UTC and converted using each user's IANA timezone.
- How Docker Compose mirrors the production service boundaries locally.

