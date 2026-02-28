.PHONY: help install dev build up down logs test lint format

.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "AI Day Planner - Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# Installation & Setup
install: ## Install all dependencies (backend + frontend)
	cd backend && uv sync
	cd frontend && npm install

install-backend: ## Install backend dependencies only
	cd backend && uv sync

install-frontend: ## Install frontend dependencies only
	cd frontend && npm install

# Development
up: ## Start all services with Docker Compose
	docker-compose up -d

down: ## Stop all services
	docker-compose down

logs: ## View logs from all services
	docker-compose logs -f

dev-backend: ## Run backend development server with hot reload
	cd backend && uv run python -m uvicorn app.main:app --reload

dev-frontend: ## Run frontend development server
	cd frontend && npm run dev

dev: ## Start the database and run both backend and frontend (requires two terminals)
	@echo "Starting database..."
	docker-compose up -d db
	@echo "Database started on port 5439"
	@echo "Run 'make dev-backend' and 'make dev-frontend' in separate terminals"

# Code Quality
format: ## Format all code (backend + frontend)
	cd backend && uv run ruff format . && uv run ruff check . --fix
	cd frontend && npx next lint --fix 2>/dev/null || echo "Frontend linting requires npm install"

lint: ## Run linting on all code
	cd backend && uv run ruff check . && uv run mypy app/
	cd frontend && npx next lint 2>/dev/null || echo "Frontend linting requires npm install"

# Testing
test: ## Run all tests
	cd backend && uv run pytest -v

# Database
migrate: ## Run database migrations
	cd backend && uv run alembic upgrade head

migrate-create: ## Create a new migration (use: make migrate-create msg="description")
	cd backend && uv run alembic revision --autogenerate -m "$(msg)"

db-reset: ## Reset the database (WARNING: deletes all data)
	docker-compose down -v
	docker-compose up -d db
	@echo "Waiting for database to be ready..."
	@sleep 3
	cd backend && uv run alembic upgrade head

# Build
build: ## Build all Docker images
	docker-compose build

# Clean
clean: ## Clean all cache files and node_modules
	cd backend && make clean 2>/dev/null || true
	cd frontend && rm -rf node_modules .next
	@echo "Cleaned up cache files"

# API Client Generation
generate-client: ## Generate TypeScript API client from OpenAPI spec (requires backend to be running)
	cd frontend && npm run generate-client
