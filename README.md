# TaskPilot

Telegram-first personal task manager with a bilingual web dashboard, smart reminders and productivity statistics.

[Open the bot](https://t.me/ka1zo1_bot) · [Open the Mini App](https://taskpilot-ka1zo.dekaganovich14.chatgpt.site) · [GitHub repository](https://github.com/ka1zo/taskpilot)

> Portfolio project: a production-oriented monorepo that demonstrates backend development, Telegram integrations, background jobs, authentication, database design, testing, containerization and frontend UX.

## What it does

- creates a task from a normal Telegram message;
- understands compact dates in Russian and English (`завтра 14:30`, `tomorrow 14:30`, `2026-12-20 09:15`);
- sends one-time reminders and a personalized daily digest;
- lets users complete tasks directly from Telegram;
- supports Russian and English per user;
- synchronizes tasks with a responsive light/dark web dashboard;
- supports task categories, priorities, filters, profile names and confirmed deletion;
- includes Telegram notification controls, an honest completion streak and a 25-minute focus timer;
- protects web sessions by validating Telegram Mini App signatures;
- includes a focus timer, search, task editor, priority controls and digest settings;
- runs the public demo 24/7 on Cloudflare Workers and D1 without a local computer.

## Stack

| Layer | Technology |
| --- | --- |
| Bot | Python 3.12+, aiogram 3 |
| API | FastAPI, Pydantic, JWT |
| Data | PostgreSQL, SQLAlchemy 2, Alembic |
| Jobs | Celery, Redis |
| Web | React 19, TypeScript, Vinext, Tailwind CSS, shadcn/ui |
| Production | Cloudflare Workers, D1, cron triggers, Telegram webhooks |
| Infrastructure | Docker Compose, Wrangler, OpenAI Sites, GitHub Actions |
| Quality | pytest, Ruff, Oxlint |

## Architecture

```mermaid
flowchart LR
    U[Telegram user] --> T[Telegram Bot API]
    T -->|secure webhook| W[Cloudflare Worker]
    U --> M[TaskPilot Mini App]
    M -->|validated initData| W
    W --> D[(Cloudflare D1)]
    C[Cron trigger] --> W
    W -->|reminders and digests| T
```

## Quick start

Requirements: Docker Desktop and a Telegram bot token from [@BotFather](https://t.me/BotFather).

1. Copy `.env.example` to `.env`.
2. Set `BOT_TOKEN`, `BOT_USERNAME` and a strong `SECRET_KEY`.
3. Start the stack:

   ```bash
   docker compose up --build
   ```

4. Open API documentation at `http://localhost:8000/docs`.
5. Open the dashboard at `http://localhost:3000` when running the web package locally.

For database migrations in a deployed environment:

```bash
docker compose run --rm api alembic upgrade head
```

## Bot commands

| Command | Description |
| --- | --- |
| `/start` | Onboarding and language selection |
| `/new <task>` | Create a task explicitly |
| `/today` | Tasks due today |
| `/tasks` | All active tasks |
| `/done <id>` | Complete a task by ID |
| `/delete <id>` | Delete a task by ID |
| `/app` | Open the TaskPilot Mini App |
| `/language` | Switch Russian/English |
| `/settings` | Current timezone and digest hour |
| `/help` | Usage examples |

Users can also send a plain message such as `Оплатить интернет завтра 19:00`.

## API authentication

The web client sends Telegram Mini App `initData` to `POST /api/v1/auth/telegram`. The backend validates its HMAC signature and age before issuing a short-lived JWT. `X-Telegram-User-Id` is available only when `DEV_AUTH_ENABLED=true` and must be disabled in production.

## Repository layout

```text
taskpilot/
├── apps/
│   ├── api/          # full FastAPI/Docker reference architecture
│   ├── cloudflare/   # production webhook, D1 API, reminders and tests
│   └── web/          # responsive bilingual Telegram Mini App
├── docs/             # ready-to-use portfolio copy
├── .github/workflows # CI for backend and frontend
├── docker-compose.yml
└── .env.example
```

## Tests

```bash
cd apps/api
python -m pip install -e ".[dev]"
ruff check .
pytest
```

The test suite covers natural-language task parsing, Telegram signature validation and the API health endpoint. GitHub Actions runs backend and web checks on every push and pull request.

## Production deployment

- **Bot and API:** Cloudflare Worker using Telegram webhooks.
- **Data:** Cloudflare D1.
- **Reminders and digests:** a Worker cron trigger every minute.
- **Mini App:** OpenAI Sites.
- **CI:** GitHub Actions validates the Python API, web app and Worker.

Set the production web URL in `WEB_APP_URL` and configure the Mini App menu button through BotFather or the Telegram Bot API. Never commit `.env`.

### Free Cloudflare deployment

The production Worker is intentionally dependency-light and complements the full
FastAPI/Docker architecture. It uses Telegram webhooks instead of polling and D1
instead of PostgreSQL so the public demo can run within the free tier.

```bash
cd apps/cloudflare
pnpm install
pnpm test
pnpm run check
pnpm exec wrangler d1 migrations apply taskpilot --remote
pnpm exec wrangler deploy
```

Store `BOT_TOKEN`, `SESSION_SECRET`, and `WEBHOOK_SECRET` with `wrangler secret put`.
They must never be added to `wrangler.jsonc` or committed to Git.

## Roadmap

- recurring-task materialization;
- advanced search and category filters;
- CSV/JSON export;
- rate limiting and observability;
- end-to-end tests for the Telegram Mini App flow.

## License

[MIT](LICENSE)
