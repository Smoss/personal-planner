.PHONY: install run dev format lint test migrate help

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies using uv
	uv sync

run: ## Run the production server
	uv run python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

dev: ## Run the development server with hot reload
	uv run python -m uvicorn app.main:app --reload

format: ## Format code with ruff
	uv run ruff format .
	uv run ruff check . --fix

lint: ## Run linting with ruff and type checking with mypy
	uv run ruff check .
	uv run mypy app/

test: ## Run pytest
	uv run pytest -v

migrate: ## Run database migrations
	uv run alembic upgrade head

migrate-create: ## Create a new migration (use: make migrate-create msg="description")
	uv run alembic revision --autogenerate -m "$(msg)"

shell: ## Open an interactive Python shell with the app context
	uv run python -c "from app.database import AsyncSessionLocal; from app.models import Todo; import asyncio; print('Database session available as db, Todo model imported')"

clean: ## Clean cache files
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
