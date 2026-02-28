.PHONY: install dev build lint format test clean help

.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "Frontend - Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies with npm
	npm install

dev: ## Run development server with hot reload
	npm run dev

build: ## Build production bundle
	npm run build

start: ## Start production server (requires build first)
	npm start

lint: ## Run ESLint
	npx next lint

format: ## Run ESLint with fix
	npx next lint --fix

test: ## Run tests (if configured)
	npm test 2>/dev/null || echo "No tests configured"

generate-client: ## Generate TypeScript client from backend OpenAPI spec (requires backend running)
	npm run generate-client

clean: ## Clean build artifacts and cache
	rm -rf .next
	rm -rf node_modules
	@echo "Cleaned frontend build artifacts"
