# AI Day Planner - Implementation Documentation

This document provides a comprehensive overview of the AI Day Planner implementation, covering architecture, design decisions, and technical details.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Database Design](#database-design)
6. [AI Agent Design](#ai-agent-design)
7. [Development Workflow](#development-workflow)
8. [Testing Strategy](#testing-strategy)

---

## Overview

The AI Day Planner is a full-stack application that combines a conversational AI assistant with semantic todo management. The system uses local LLM inference via Ollama, eliminating the need for external API keys while maintaining privacy.

### Key Features

- **Streaming AI Chat**: Real-time conversation with an AI planning assistant
- **Semantic Search**: Find todos by meaning, not just exact matches
- **Smart Suggestions**: AI-proposed todos with accept/reject workflow
- **Day Math**: Date calculations for scheduling and planning
- **Full CRUD**: Complete todo management with check-off functionality

---

## Architecture

### System Architecture

```
┌─────────────────┐      HTTP/SSE      ┌──────────────────┐      SQL      ┌─────────────────┐
│   Next.js       │ ◄────────────────► │   FastAPI        │ ◄───────────► │  PostgreSQL     │
│   Frontend      │   Streaming Chat   │   Backend        │    asyncpg    │  + PGVector     │
│   Port 3000     │                    │   Port 8000      │               │  Port 5439      │
└─────────────────┘                    └──────────────────┘               └─────────────────┘
                                              │
                                              │ HTTP
                                              ▼
                                       ┌──────────────────┐
                                       │   Ollama         │
                                       │   LLM + Embeddings│
                                       │   Port 11434     │
                                       └──────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14 + React 18 | SSR, App Router, modern React patterns |
| UI | Material-UI (MUI) | Component library, theming |
| Styling | Emotion | CSS-in-JS for MUI |
| Markdown | react-markdown + remark-gfm | Chat message rendering |
| Backend | FastAPI | Async Python web framework |
| ORM | SQLAlchemy 2.0 (async) | Database abstraction |
| Vector DB | PGVector (Postgres extension) | Semantic similarity search |
| Migrations | Alembic | Database schema versioning |
| AI Framework | LangChain | Agent orchestration |
| LLM | Ollama (qwen3:latest) | Local LLM inference |
| Embeddings | Ollama (nomic-embed-text-v2-moe) | Text vectorization |
| Package Mgmt | uv | Fast Python package management |
| Linting | ruff | Fast Python linter + formatter |
| Type Checking | mypy | Static type analysis |

---

## Backend Implementation

### Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app, lifespan, middleware
│   ├── config.py            # Pydantic settings, env vars
│   ├── database.py          # SQLAlchemy engine, session, Base
│   ├── models.py            # SQLAlchemy Todo model
│   ├── schemas.py           # Pydantic request/response models
│   ├── agent.py             # LangChain agent, tools, streaming
│   └── routers/
│       ├── __init__.py
│       ├── todos.py         # CRUD endpoints
│       └── chat.py          # SSE streaming, suggestions
├── alembic/
│   ├── env.py               # Async migration environment
│   ├── script.py.mako       # Migration template
│   └── versions/
│       └── 0001_initial.py  # Initial schema with PGVector
├── tests/
│   ├── __init__.py
│   ├── conftest.py          # Pytest fixtures, test DB
│   └── test_todos.py        # Todo endpoint tests
├── pyproject.toml           # Dependencies, tool config
├── alembic.ini              # Alembic configuration
├── Dockerfile               # Container image
└── Makefile                 # Development commands
```

### FastAPI Application (`app/main.py`)

The main application file sets up:

1. **Lifespan Management**: Creates database tables on startup
2. **CORS Middleware**: Allows frontend communication
3. **Router Inclusion**: Mounts todo and chat endpoints
4. **Health Check**: Simple status endpoint for monitoring

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown: Dispose engine
    await engine.dispose()
```

### Database Layer (`app/database.py`, `app/models.py`)

**SQLAlchemy 2.0 Async Setup**:

- `create_async_engine()` with `asyncpg` driver
- `AsyncSessionLocal` for session management
- Dependency injection via `get_db()` for request-scoped sessions

**Todo Model with PGVector**:

```python
class Todo(Base):
    __tablename__ = "todos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    completed = Column(Boolean, default=False, nullable=False)
    embedding = Column(VECTOR(768), nullable=True)  # nomic-embed-text-v2-moe
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
```

The `VECTOR(768)` type comes from PGVector and stores 768-dimensional embeddings for semantic search.

### AI Agent (`app/agent.py`)

The agent is the core AI component, built with LangChain and Ollama.

#### Agent Architecture

```
User Message
     │
     ▼
┌─────────────┐
│   System    │  <- Injected with current date context
│   Prompt    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  ChatOllama │  <- qwen3:latest:latest
│    (LLM)    │
└──────┬──────┘
       │
       ├──► Tool Call? ──► Execute Tool ──► Back to LLM
       │
       ▼
  Final Response
```

#### Current Date Context Injection

Every conversation includes fresh date context:

```python
def get_date_context() -> str:
    now = datetime.now(timezone.utc)
    return f"""Current Context:
- Today's date: {now.strftime('%Y-%m-%d')} ({now.strftime('%A')})
- Week of year: {now.isocalendar()[1]}
- Days remaining in month: ...
- Current time: {now.strftime('%H:%M')}"""
```

This enables the agent to understand relative references like "tomorrow", "next Tuesday", etc.

#### Tool System

Four tools are available to the agent:

1. **`get_todos`** - Retrieves all todos for context
2. **`search_todos`** - Semantic search using PGVector cosine similarity
3. **`day_math`** - Date calculations (add/subtract days, day of week, etc.)
4. **`suggest_todo`** - Creates a pending suggestion (requires user acceptance)

**Tool Execution Flow**:

```python
async def run_agent(messages, db, stream_callback, suggestion_callback):
    llm = create_llm()
    state = AgentState(suggestion_callback=suggestion_callback)
    tools = create_tools(db, state)
    llm_with_tools = llm.bind_tools(tools)

    # Main loop with iteration cap (15 max)
    while state.iteration_count < state.max_iterations:
        response = await llm_with_tools.ainvoke(messages)

        if response.tool_calls:
            for tool_call in response.tool_calls:
                result = await execute_tool(tool_call["name"], tool_call["args"], tools)
                messages.append(ToolMessage(content=str(result), tool_call_id=tool_call["id"]))
        else:
            return response.content  # Final response
```

#### Streaming Implementation

The agent supports streaming via callbacks:

- `stream_callback`: Emits thinking updates, tool calls, tool results, and response chunks
- `suggestion_callback`: Special handler for suggestion events

This allows the frontend to show real-time progress as the agent thinks and acts.

#### Semantic Search Implementation

```python
async def search_todos_semantic(db: AsyncSession, query: str, top_k: int = 5):
    embeddings = create_embeddings()
    query_embedding = await embeddings.aembed_query(query)

    # PGVector cosine similarity using <=> operator
    sql = text("""
        SELECT *, embedding <=> :embedding::vector AS distance
        FROM todos
        ORDER BY embedding <=> :embedding::vector
        LIMIT :limit
    """)

    result = await db.execute(sql, {
        "embedding": f"[{','.join(str(x) for x in query_embedding)}]",
        "limit": top_k
    })
    return result.fetchall()
```

### API Endpoints

#### Todos Router (`app/routers/todos.py`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/todos` | List all todos |
| POST | `/todos` | Create new todo |
| GET | `/todos/{id}` | Get specific todo |
| PATCH | `/todos/{id}` | Update todo |
| DELETE | `/todos/{id}` | Delete todo |

#### Chat Router (`app/routers/chat.py`)

**Streaming Chat Endpoint** (`POST /chat/stream`):

Uses Server-Sent Events (SSE) for unidirectional streaming:

```python
async def event_generator():
    message_queue = asyncio.Queue()

    async def stream_callback(data):
        await message_queue.put(data)

    # Run agent in background
    agent_task = asyncio.create_task(
        run_agent(messages, db, stream_callback)
    )

    # Stream events while agent runs
    while True:
        try:
            data = await asyncio.wait_for(message_queue.get(), timeout=0.1)
            yield f"event: {data['type']}\ndata: {json.dumps(data)}\n\n"
        except asyncio.TimeoutError:
            if agent_task.done():
                yield f"event: done\ndata: {{'status': 'complete'}}\n\n"
                break
```

**Suggestion Endpoints**:

- `GET /chat/suggestions` - List pending suggestions
- `POST /chat/suggestions/{id}/accept` - Create todo from suggestion
- `POST /chat/suggestions/{id}/reject` - Discard suggestion

### Configuration (`app/config.py`)

Uses Pydantic Settings for environment variable management:

```python
class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://..."
    ollama_base_url: str = "http://localhost:11434"
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
```

---

## Frontend Implementation

### Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout with MUI theme
│   │   ├── page.tsx            # Chat page (default route)
   │   └── todos/
│   │       └── page.tsx        # Todo management page
│   ├── components/
│   │   ├── Chat.tsx            # Main chat interface
│   │   ├── ChatMessage.tsx     # Message rendering with markdown
│   │   ├── SuggestionCard.tsx  # Accept/reject UI
│   │   └── TodoList.tsx        # Todo CRUD UI
│   ├── hooks/
│   │   └── useChat.ts          # SSE streaming hook
│   └── lib/
│       ├── api.ts              # API client functions
│       ├── theme.ts            # MUI theme configuration
│       └── utils.ts            # Helper functions
├── package.json
├── next.config.js              # API proxy configuration
├── tsconfig.json
├── Dockerfile
└── Makefile
```

### Streaming Chat Hook (`hooks/useChat.ts`)

The `useChat` hook manages the SSE connection and message state:

```typescript
export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [currentSuggestions, setCurrentSuggestions] = useState<Suggestion[]>([]);

  const sendMessage = useCallback(async (content: string) => {
    // 1. Add user message to state
    // 2. Open SSE connection to /chat/stream
    // 3. Read stream chunks and parse SSE events
    // 4. Update state based on event types:
    //    - 'thinking': Show progress
    //    - 'tool_call': Display tool usage
    //    - 'suggestion': Add to suggestions list
    //    - 'response': Update streaming content
    //    - 'done': Finalize message
  }, []);
}
```

**SSE Event Parsing**:

```typescript
// SSE format: event: <type>\ndata: <json>\n\n
for (const line of lines) {
  if (line.startsWith('event: ')) {
    const eventType = line.slice(7);
    const data = lines[++i]?.slice(6); // Remove 'data: ' prefix
    const event = JSON.parse(data);

    switch (eventType) {
      case 'response': setStreamingContent(event.content); break;
      case 'suggestion': addSuggestion(event.data); break;
    }
  }
}
```

### Chat Components

#### Chat Component (`components/Chat.tsx`)

Main chat interface with:

- Message history display
- Auto-scrolling to bottom
- Input with send button
- Suggestion card rendering
- Scroll-to-bottom FAB when scrolled up

#### ChatMessage Component (`components/ChatMessage.tsx`)

Renders messages with Markdown support:

```typescript
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    p: ({ children }) => <Typography paragraph>{children}</Typography>,
    code: ({ children }) => (
      <Box component="code" sx={{ ...codeStyles }}>
        {children}
      </Box>
    ),
  }}
>
  {message.content}
</ReactMarkdown>
```

#### SuggestionCard Component (`components/SuggestionCard.tsx`)

Displays AI suggestions with:

- Title, description, and reasoning
- Accept button → calls `POST /chat/suggestions/{id}/accept`
- Reject button → calls `POST /chat/suggestions/{id}/reject`
- Loading states during API calls
- Snackbar for error messages

### Todo Management (`app/todos/page.tsx` + `components/TodoList.tsx`)

The todo page provides full CRUD functionality:

1. **List View**: Shows active and completed todos separately
2. **Create**: Form to add new todos
3. **Update**: Edit dialog for title/description
4. **Toggle**: Checkbox to mark complete/incomplete
5. **Delete**: Remove todos with confirmation

**State Management**:

```typescript
const [todos, setTodos] = useState<Todo[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Load todos on mount
useEffect(() => { loadTodos(); }, []);

// Handlers call API and refresh list
const handleToggle = async (id, completed) => {
  await todosApi.update(id, { completed });
  await loadTodos();
};
```

### API Client (`lib/api.ts`)

Centralized API functions using axios:

```typescript
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
});

export const todosApi = {
  getAll: () => api.get<Todo[]>('/todos'),
  create: (todo: TodoCreate) => api.post<Todo>('/todos', todo),
  update: (id: string, todo: TodoUpdate) => api.patch<Todo>(`/todos/${id}`, todo),
  delete: (id: string) => api.delete(`/todos/${id}`),
};

export const suggestionsApi = {
  accept: (id: string) => api.post(`/chat/suggestions/${id}/accept`),
  reject: (id: string) => api.post(`/chat/suggestions/${id}/reject`),
};
```

---

## Database Design

### Schema

```sql
-- Enable PGVector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Todos table
CREATE TABLE todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    embedding VECTOR(768),  -- nomic-embed-text-v2-moe dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HNSW index for fast similarity search
CREATE INDEX idx_todos_embedding ON todos
USING hnsw (embedding vector_cosine_ops);
```

### PGVector Distance Operator

The `<=>` operator computes cosine distance (1 - cosine similarity):

```sql
-- Lower distance = more similar
SELECT title, embedding <=> query_embedding AS distance
FROM todos
ORDER BY distance
LIMIT 5;
```

### Migration Strategy

Alembic manages schema changes:

1. **Initial Migration** (`0001_initial.py`):
   - Enables PGVector extension
   - Creates todos table
   - Adds vector column
   - Creates HNSW index

2. **Future Migrations**:
   ```bash
   make migrate-create msg="add user table"
   make migrate
   ```

---

## AI Agent Design

### Agent Loop with Iteration Cap

To prevent runaway tool calling:

```python
@dataclass
class AgentState:
    iteration_count: int = 0
    max_iterations: int = 15  # Hard limit

# In run_agent()
while state.iteration_count < state.max_iterations:
    state.iteration_count += 1
    response = await llm_with_tools.ainvoke(messages)
    # ... handle response
else:
    # Graceful termination after 15 iterations
    return "Would you like me to continue or wrap up?"
```

### Suggestion Flow

```
Agent decides to suggest a todo
           │
           ▼
   ┌───────────────┐
   │ suggest_todo  │──► Creates pending suggestion
   │   tool call   │    (stored in memory, not DB)
   └───────────────┘
           │
           ▼
   Frontend receives SSE
   'suggestion' event
           │
           ▼
   ┌───────────────┐
   │ SuggestionCard│──► User sees card with
   │   rendered    │    Accept/Reject buttons
   └───────────────┘
           │
      ┌────┴────┐
      ▼         ▼
  [Accept]   [Reject]
      │         │
      ▼         ▼
  POST /      POST /
  accept      reject
      │         │
      ▼         ▼
  Create      Delete from
  todo in       pending
    DB        suggestions
```

### Tool Definitions

**get_todos**:
```python
@tool
async def get_todos() -> str:
    """Retrieve all current todos from the database."""
    todos = await get_todos_from_db(db)
    return formatted_todo_list(todos)
```

**search_todos**:
```python
@tool
async def search_todos(query: str) -> str:
    """Search todos using semantic similarity.
    Good for finding related tasks."""
    todos = await search_todos_semantic(db, query, top_k=5)
    return formatted_results(todos)
```

**day_math**:
```python
@tool
def day_math(operation: str, date: str = None, days: int = 0) -> str:
    """Perform date calculations for planning.
    Operations: add_days, subtract_days, days_between, day_of_week, etc."""
    # ... implementation
```

**suggest_todo**:
```python
@tool
async def suggest_todo(title: str, description: str, reasoning: str) -> str:
    """Suggest a new todo to the user.
    Creates a pending suggestion - user must accept before adding to DB."""
    suggestion_id = generate_id()
    pending_suggestions[suggestion_id] = {...}

    if state.suggestion_callback:
        await state.suggestion_callback({"type": "suggestion", "data": suggestion})

    return "Suggestion created - awaiting user acceptance"
```

---

## Development Workflow

### Make Commands

**Backend** (`backend/Makefile`):

```bash
make install        # Install dependencies with uv
make dev            # Run with hot reload
make run            # Run production server
make format         # Format with ruff
make lint           # Run ruff + mypy
make test           # Run pytest
make migrate        # Run Alembic migrations
make migrate-create # Create new migration
make clean          # Clean cache files
```

**Root** (`Makefile`):

```bash
make install        # Install all dependencies
make up             # Start Docker services
make down           # Stop Docker services
make dev-backend    # Run backend dev server
make dev-frontend   # Run frontend dev server
make format         # Format all code
make lint           # Lint all code
make test           # Run all tests
make db-reset       # Reset database (WARNING: destructive)
```

### Code Quality Tools

**Ruff Configuration** (in `pyproject.toml`):

```toml
[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP", "B", "C4", "SIM", "ASYNC"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

**MyPy Configuration**:

```toml
[tool.mypy]
python_version = "3.11"
disallow_untyped_defs = true
disallow_incomplete_defs = true
no_implicit_optional = true
```

### Type Checking

All functions have type annotations:

```python
async def search_todos_semantic(
    db: AsyncSession,
    query: str,
    top_k: int = 5
) -> List[Todo]:
    ...
```

---

## Testing Strategy

### Backend Tests (`backend/tests/`)

**Test Configuration** (`conftest.py`):

```python
@pytest_asyncio.fixture
async def db_session():
    """Create a fresh database session for each test."""
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        yield session

    # Cleanup after test
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```

**Test Client**:

```python
@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
```

**Example Tests** (`test_todos.py`):

```python
@pytest.mark.asyncio
async def test_create_todo(client):
    response = await client.post("/todos", json={
        "title": "Test Todo",
        "description": "Test description"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Todo"
```

### Running Tests

```bash
# Backend only
cd backend && make test

# All tests
make test
```

---

## Docker Configuration

### Services

**Postgres** (`pgvector/pgvector:pg15`):
- Port: `5439` (host) → `5432` (container)
- Volume: `postgres_data` for persistence
- Health check: `pg_isready`

**Backend**:
- Port: `8000`
- Volume: `./backend:/app` for hot reload
- Depends on: `db` (health check)
- Command: `uv run python -m uvicorn app.main:app --reload`

**Frontend**:
- Port: `3000`
- Volume: `./frontend:/app` + `/app/node_modules` (anonymous)
- Depends on: `backend`
- Command: `npm run dev`

### Ollama Integration

For local development, Ollama runs on `localhost:11434`:

```bash
# Start Ollama server
ollama serve
```

The backend uses `OLLAMA_BASE_URL=http://localhost:11434` by default.

---

## Summary

This implementation provides a production-ready foundation for an AI-powered day planner with:

- **Modern Stack**: FastAPI, Next.js, PostgreSQL + PGVector, LangChain, Ollama
- **Type Safety**: Full TypeScript frontend, mypy-checked Python backend
- **Code Quality**: Ruff for linting/formatting, comprehensive Makefile
- **AI Features**: Streaming chat, semantic search, smart suggestions, day math
- **Developer Experience**: Hot reload, easy commands, clear documentation
- **Testing**: Pytest with async support and test database isolation

The architecture is designed for extensibility - adding new tools, models, or features follows established patterns.
