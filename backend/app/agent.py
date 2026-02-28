import json
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Callable
from uuid import UUID
import asyncio
from dataclasses import dataclass

from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.models import Todo
from app.config import get_settings

settings = get_settings()

# Global state for pending suggestions (in production, use Redis or similar)
pending_suggestions: Dict[str, Dict[str, Any]] = {}


def get_date_context() -> str:
    """Generate current date context for the agent."""
    now = datetime.now(timezone.utc)
    return f"""Current Context:
- Today's date: {now.strftime('%Y-%m-%d')} ({now.strftime('%A')})
- Week of year: {now.isocalendar()[1]}
- Days remaining in month: {(now.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1) - now}
- Current time: {now.strftime('%H:%M')}
"""


@dataclass
class AgentState:
    """Tracks agent execution state including iteration count."""
    iteration_count: int = 0
    max_iterations: int = 15
    suggestion_callback: Optional[Callable] = None


def create_embeddings():
    """Create Ollama embeddings client."""
    return OllamaEmbeddings(
        model="nomic-embed-text-v2-moe:latest",
        base_url=settings.ollama_base_url,
    )


def create_llm():
    """Create ChatOllama instance."""
    return ChatOllama(
        model="lfm2.5-thinking:latest",
        base_url=settings.ollama_base_url,
        temperature=0.7,
        streaming=True,
    )


async def get_todos_from_db(db: AsyncSession) -> List[Todo]:
    """Fetch all todos from database."""
    result = await db.execute(select(Todo).order_by(Todo.created_at.desc()))
    return list(result.scalars().all())


async def search_todos_semantic(db: AsyncSession, query: str, top_k: int = 5) -> List[Todo]:
    """Search todos using semantic similarity."""
    embeddings = create_embeddings()
    query_embedding = await embeddings.aembed_query(query)

    # Convert embedding to string format for SQL
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    # Use pgvector for similarity search
    sql = text("""
        SELECT id, title, description, completed, created_at, updated_at,
               embedding <=> :embedding::vector AS distance
        FROM todos
        ORDER BY embedding <=> :embedding::vector
        LIMIT :limit
    """)

    result = await db.execute(sql, {"embedding": embedding_str, "limit": top_k})
    rows = result.fetchall()

    todos = []
    for row in rows:
        todo = Todo(
            id=row.id,
            title=row.title,
            description=row.description,
            completed=row.completed,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        todos.append(todo)
    return todos


async def generate_embedding(text: str) -> List[float]:
    """Generate embedding for text using Ollama."""
    embeddings = create_embeddings()
    return await embeddings.aembed_query(text)


# Tool definitions for LangChain
@tool
def day_math(operation: str, date: str = None, days: int = 0) -> str:
    """
    Perform date calculations for planning.

    Args:
        operation: One of: 'add_days', 'subtract_days', 'days_between', 'day_of_week', 'week_of_year', 'days_until_month_end'
        date: ISO format date string (YYYY-MM-DD), required for most operations
        days: Number of days, required for add/subtract operations

    Examples:
        - day_math('add_days', '2026-02-28', 3) -> '2026-03-03 (Tuesday)'
        - day_math('subtract_days', '2026-02-28', 7) -> '2026-02-21 (Saturday)'
        - day_math('days_between', '2026-02-28', days='2026-03-15') -> '15 days'
        - day_math('day_of_week', '2026-03-15') -> 'Sunday'
        - day_math('days_until_month_end') -> '0 days'
    """
    today = datetime.now(timezone.utc)

    if operation == 'add_days':
        if not date:
            start = today
        else:
            start = datetime.strptime(date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        result = start + timedelta(days=days)
        return f"{result.strftime('%Y-%m-%d')} ({result.strftime('%A')})"

    elif operation == 'subtract_days':
        if not date:
            start = today
        else:
            start = datetime.strptime(date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        result = start - timedelta(days=days)
        return f"{result.strftime('%Y-%m-%d')} ({result.strftime('%A')})"

    elif operation == 'days_between':
        if not date:
            return "Error: start date required"
        start = datetime.strptime(date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        end = today if days == 0 else datetime.strptime(str(days), '%Y-%m-%d').replace(tzinfo=timezone.utc)
        diff = (end - start).days
        return f"{abs(diff)} days {'until' if diff > 0 else 'since'}"

    elif operation == 'day_of_week':
        if not date:
            date = today.strftime('%Y-%m-%d')
        dt = datetime.strptime(date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        return dt.strftime('%A')

    elif operation == 'week_of_year':
        if not date:
            date = today.strftime('%Y-%m-%d')
        dt = datetime.strptime(date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        return str(dt.isocalendar()[1])

    elif operation == 'days_until_month_end':
        if date:
            current = datetime.strptime(date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        else:
            current = today
        # Get last day of current month
        if current.month == 12:
            next_month = current.replace(year=current.year + 1, month=1, day=1)
        else:
            next_month = current.replace(month=current.month + 1, day=1)
        last_day = next_month - timedelta(days=1)
        diff = (last_day - current).days
        return str(diff)

    return f"Unknown operation: {operation}"


def create_tools(db: AsyncSession, state: AgentState) -> List:
    """Create tool instances bound to database session."""

    @tool
    async def get_todos() -> str:
        """Retrieve all current todos from the database."""
        todos = await get_todos_from_db(db)
        if not todos:
            return "No todos found."
        result = "Current todos:\n"
        for todo in todos:
            status = "✓" if todo.completed else "○"
            result += f"  {status} {todo.title}"
            if todo.description:
                result += f" - {todo.description}"
            result += "\n"
        return result

    @tool
    async def search_todos(query: str) -> str:
        """Search todos using semantic similarity. Good for finding related tasks."""
        todos = await search_todos_semantic(db, query, top_k=5)
        if not todos:
            return f"No todos found matching '{query}'."
        result = f"Todos matching '{query}':\n"
        for todo in todos:
            status = "✓" if todo.completed else "○"
            result += f"  {status} {todo.title}"
            if todo.description:
                result += f" - {todo.description}"
            result += "\n"
        return result

    @tool
    async def suggest_todo(title: str, description: str, reasoning: str) -> str:
        """
        Suggest a new todo to the user. This creates a pending suggestion
        that the user can accept or reject. Does NOT add to database directly.
        """
        suggestion_id = f"sugg_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
        suggestion = {
            "id": suggestion_id,
            "title": title,
            "description": description,
            "reasoning": reasoning,
        }
        pending_suggestions[suggestion_id] = suggestion

        # Notify via callback if provided (for streaming)
        if state.suggestion_callback:
            await state.suggestion_callback({
                "type": "suggestion",
                "data": suggestion
            })

        return f"Suggestion created: '{title}'. User can accept or reject this suggestion."

    return [get_todos, search_todos, day_math, suggest_todo]


async def run_agent(
    messages: List[Dict[str, str]],
    db: AsyncSession,
    stream_callback: Optional[Callable] = None,
    suggestion_callback: Optional[Callable] = None,
) -> str:
    """
    Run the LangChain agent with tools and streaming support.
    Returns the final response text.
    """
    llm = create_llm()
    state = AgentState(suggestion_callback=suggestion_callback)
    tools = create_tools(db, state)

    # Bind tools to LLM
    llm_with_tools = llm.bind_tools(tools)

    # Build system prompt with date context
    system_prompt = f"""You are a helpful day planning assistant.

{get_date_context()}

Your goal is to help users organize their day and manage their todo list effectively.

Guidelines:
- You can retrieve current todos using get_todos
- You can search todos semantically using search_todos for finding related tasks
- You can calculate dates using day_math for scheduling
- When suggesting new todos, use suggest_todo - the user must explicitly accept before it gets added
- Be concise but helpful in your responses
- If the user asks about their day or plans, first check their current todos
- After 15 iterations, you will gracefully wrap up the conversation
"""

    # Convert messages to LangChain format
    lc_messages = [SystemMessage(content=system_prompt)]
    for msg in messages:
        if msg["role"] == "user":
            lc_messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            lc_messages.append(AIMessage(content=msg["content"]))

    # Main agent loop with iteration cap
    final_response = ""
    while state.iteration_count < state.max_iterations:
        state.iteration_count += 1

        # Get response from LLM
        response = await llm_with_tools.ainvoke(lc_messages)

        # Stream thinking if callback provided
        if stream_callback:
            await stream_callback({
                "type": "thinking",
                "content": f"Iteration {state.iteration_count}: Processing..."
            })

        # Check for tool calls
        if response.tool_calls:
            lc_messages.append(response)

            for tool_call in response.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]
                tool_id = tool_call["id"]

                # Stream tool call
                if stream_callback:
                    await stream_callback({
                        "type": "tool_call",
                        "tool": tool_name,
                        "args": tool_args
                    })

                # Execute the tool
                tool_result = await execute_tool(tool_name, tool_args, tools)

                # Add tool result to messages
                lc_messages.append(ToolMessage(
                    content=str(tool_result),
                    tool_call_id=tool_id
                ))

                # Stream tool result
                if stream_callback:
                    await stream_callback({
                        "type": "tool_result",
                        "tool": tool_name,
                        "result": str(tool_result)[:200]  # Truncate for display
                    })
        else:
            # No tool calls, we have the final response
            final_response = response.content

            # Stream final response chunks
            if stream_callback:
                await stream_callback({
                    "type": "response",
                    "content": final_response
                })
            break
    else:
        # Hit iteration limit
        final_response = "I've made several suggestions and explored your todos. Would you like me to continue with anything specific, or shall we wrap up?"
        if stream_callback:
            await stream_callback({
                "type": "response",
                "content": final_response
            })

    return final_response


async def execute_tool(tool_name: str, args: Dict, tools: List) -> str:
    """Execute a tool by name."""
    for tool in tools:
        if tool.name == tool_name:
            if tool_name in ['get_todos', 'search_todos', 'suggest_todo']:
                return await tool.ainvoke(args)
            else:
                return tool.invoke(args)
    return f"Tool {tool_name} not found"
