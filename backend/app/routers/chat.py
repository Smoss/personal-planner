import json
import asyncio
from typing import AsyncGenerator
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.agent import run_agent, pending_suggestions
from app.schemas import ChatRequest

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/stream")
async def chat_stream(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Streaming chat endpoint using Server-Sent Events.
    Streams: thinking updates, tool calls, tool results, and final response.
    Also emits suggestion events when the agent suggests new todos.
    """

    async def event_generator() -> AsyncGenerator[str, None]:
        message_queue = asyncio.Queue()
        suggestion_queue = asyncio.Queue()

        async def stream_callback(data: dict):
            await message_queue.put(data)

        async def suggestion_callback(data: dict):
            await suggestion_queue.put(data)
            await message_queue.put(data)  # Also add to main stream

        # Run agent in background
        agent_task = asyncio.create_task(
            run_agent(
                messages=[{"role": m.role, "content": m.content} for m in request.messages],
                db=db,
                stream_callback=stream_callback,
                suggestion_callback=suggestion_callback,
            )
        )

        # Stream events while agent runs
        while True:
            try:
                # Wait for messages with timeout
                data = await asyncio.wait_for(message_queue.get(), timeout=0.1)

                # Format as SSE
                event_type = data.get("type", "message")
                event_data = json.dumps(data)
                yield f"event: {event_type}\ndata: {event_data}\n\n"

            except asyncio.TimeoutError:
                # Check if agent is done
                if agent_task.done():
                    # Get any remaining messages
                    while not message_queue.empty():
                        data = message_queue.get_nowait()
                        event_type = data.get("type", "message")
                        event_data = json.dumps(data)
                        yield f"event: {event_type}\ndata: {event_data}\n\n"

                    # Send completion event
                    yield f"event: done\ndata: {json.dumps({'status': 'complete'})}\n\n"
                    break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@router.get("/suggestions")
async def get_pending_suggestions():
    """Get all pending suggestions."""
    return {"suggestions": list(pending_suggestions.values())}


@router.post("/suggestions/{suggestion_id}/accept")
async def accept_suggestion(suggestion_id: str, db: AsyncSession = Depends(get_db)):
    """Accept a suggestion and create the todo."""
    from app.models import Todo
    from app.agent import pending_suggestions

    if suggestion_id not in pending_suggestions:
        return {"error": "Suggestion not found"}, 404

    suggestion = pending_suggestions[suggestion_id]

    # Create the todo
    todo = Todo(
        title=suggestion["title"],
        description=suggestion["description"],
        completed=False,
    )
    db.add(todo)
    await db.commit()
    await db.refresh(todo)

    # Remove from pending
    del pending_suggestions[suggestion_id]

    return {
        "status": "accepted",
        "todo": {
            "id": str(todo.id),
            "title": todo.title,
            "description": todo.description,
            "completed": todo.completed,
        }
    }


@router.post("/suggestions/{suggestion_id}/reject")
async def reject_suggestion(suggestion_id: str):
    """Reject a suggestion without creating a todo."""
    from app.agent import pending_suggestions

    if suggestion_id not in pending_suggestions:
        return {"error": "Suggestion not found"}, 404

    del pending_suggestions[suggestion_id]

    return {"status": "rejected"}
