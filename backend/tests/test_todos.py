import pytest


@pytest.mark.asyncio
async def test_create_todo(client):
    """Test creating a new todo."""
    response = await client.post(
        "/todos",
        json={"title": "Test Todo", "description": "Test description"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Todo"
    assert data["description"] == "Test description"
    assert data["completed"] is False


@pytest.mark.asyncio
async def test_get_todos(client):
    """Test listing todos."""
    # Create a todo first
    await client.post("/todos", json={"title": "Test Todo"})

    response = await client.get("/todos")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["title"] == "Test Todo"


@pytest.mark.asyncio
async def test_update_todo(client):
    """Test updating a todo."""
    # Create a todo
    create_response = await client.post("/todos", json={"title": "Original Title"})
    todo_id = create_response.json()["id"]

    # Update it
    response = await client.patch(
        f"/todos/{todo_id}",
        json={"title": "Updated Title", "completed": True}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["completed"] is True


@pytest.mark.asyncio
async def test_delete_todo(client):
    """Test deleting a todo."""
    # Create a todo
    create_response = await client.post("/todos", json={"title": "To Delete"})
    todo_id = create_response.json()["id"]

    # Delete it
    response = await client.delete(f"/todos/{todo_id}")
    assert response.status_code == 204

    # Verify it's gone
    get_response = await client.get(f"/todos/{todo_id}")
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_health_check(client):
    """Test health endpoint."""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
