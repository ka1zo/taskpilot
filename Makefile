.PHONY: up down logs test lint migrate

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f api bot worker beat

test:
	docker compose run --rm api pytest

lint:
	docker compose run --rm api ruff check .

migrate:
	docker compose run --rm api alembic upgrade head

