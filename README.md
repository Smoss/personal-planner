# AI Day Planner

AI-powered day planning with semantic todo search. Built with FastAPI, LangChain, Ollama, and Next.js.

## Features

- **AI Chat Assistant**: Conversational AI that helps you plan your day using Ollama's `qwen3:latest` model
- **Semantic Todo Search**: Find related todos using vector similarity search with PGVector
- **Smart Suggestions**: AI suggests new todos that you can accept or reject
- **Day Math Tool**: Calculate dates, time between events, and scheduling
- **Real-time Streaming**: Chat responses stream in real-time using SSE
- **Full Todo Management**: Create, edit, complete, and delete todos

## Architecture

```
Frontend (Next.js + React + MUI)  <--->  Backend (FastAPI + LangChain)  <--->  Postgres + PGVector
     |                                              |
     +---------------- SSE Stream -------------------+
```

## Prerequisites

- Docker and Docker Compose
- [Ollama](https://ollama.com) installed locally
- Node.js 20+ (for local frontend development)
- Python 3.11+ with [uv](https://github.com/astral-sh/uv) (for local backend development)

## Quick Start

### 1. Setup Ollama

Install and pull the required models:

```bash
# Install Ollama from https://ollama.com

# Pull required models
ollama pull qwen3:latest
ollama pull nomic-embed-text-v2-moe:latest
```

### 2. Start Services

```bash
# Start Postgres (port 5439), backend (port 8000), and frontend (port 3000)
docker-compose up -d

# Run database migrations
cd backend
uv sync
uv run alembic upgrade head
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Development

### Backend Development

```bash
cd backend

# Install dependencies
uv sync

# Run with hot reload
uv run python -m uvicorn app.main:app --reload

# Run migrations
uv run alembic upgrade head

# Create new migration
uv run alembic revision --autogenerate -m "description"

# Run tests
uv run pytest
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run with hot reload
npm run dev

# Generate OpenAPI client from backend
npm run generate-client
```

## API Endpoints

### Todos

- `GET /todos` - List all todos
- `POST /todos` - Create a new todo
- `GET /todos/{id}` - Get a specific todo
- `PATCH /todos/{id}` - Update a todo
- `DELETE /todos/{id}` - Delete a todo

### Chat

- `POST /chat/stream` - Streaming chat endpoint (SSE)
- `GET /chat/suggestions` - Get pending suggestions
- `POST /chat/suggestions/{id}/accept` - Accept a suggestion
- `POST /chat/suggestions/{id}/reject` - Reject a suggestion

## Environment Variables

Create `.env` files in both `backend/` and `frontend/` directories:

### Backend (.env)

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5439/planner
OLLAMA_BASE_URL=http://localhost:11434
CORS_ORIGINS=http://localhost:3000
DEBUG=false
```

### Frontend (.env.local)

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## How It Works

### Semantic Search

Todos are automatically embedded using `nomic-embed-text-v2-moe:latest` when created/updated. The agent can search semantically:

- "Find my gym-related tasks" → Matches "workout", "exercise", "fitness"
- "What about project X?" → Finds contextually related tasks
- "Any errands to run?" → Matches "grocery", "shopping", "dry cleaning"

### Day Math

The agent uses the `day_math` tool for date calculations:

- "3 days from now" → Future date calculation
- "Days until Friday" → Countdown calculation
- "Last Monday's date" → Past date lookup

### Suggestion Flow

1. Agent calls `suggest_todo()` with title, description, and reasoning
2. Suggestion appears as a card in the chat UI
3. User clicks **Accept** → Todo is created
4. User clicks **Reject** → Suggestion is removed

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app
│   │   ├── agent.py         # LangChain agent with tools
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── database.py      # Database connection
│   │   ├── config.py        # Settings
│   │   └── routers/
│   │       ├── todos.py     # Todo CRUD endpoints
│   │       └── chat.py      # Streaming chat endpoints
│   ├── alembic/             # Database migrations
│   ├── pyproject.toml       # uv dependencies
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   │   ├── page.tsx     # Chat page
│   │   │   └── todos/
│   │   │       └── page.tsx
│   │   ├── components/
│   │   │   ├── Chat.tsx     # Main chat interface
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── SuggestionCard.tsx
│   │   │   └── TodoList.tsx
│   │   ├── hooks/
│   │   │   └── useChat.ts   # SSE streaming hook
│   │   └── lib/
│   │       ├── api.ts       # API client
│   │       └── theme.ts     # MUI theme
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

## Troubleshooting

### Ollama Connection Issues

If the backend can't connect to Ollama:

1. Ensure Ollama is running: `ollama serve`
2. For Docker, use `host.docker.internal:11434` in the backend config
3. On Linux, you may need to add `--add-host=host.docker.internal:host-gateway` to Docker commands

### Database Issues

To reset the database:

```bash
docker-compose down -v
docker-compose up -d db
cd backend
uv run alembic upgrade head
```

### Port Conflicts

- Postgres: `5439` (configured to avoid conflict with local Postgres)
- Backend: `8000`
- Frontend: `3000`

## License

MIT
