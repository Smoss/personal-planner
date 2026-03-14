"use client";

import { useState } from "react";
import {
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  IconButton,
  Typography,
  Box,
  TextField,
  Button,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import type { Todo, TodoCreate, TodoUpdate } from "@/lib/convex";

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onCreate: (todo: TodoCreate) => void;
  onUpdate: (id: string, todo: TodoUpdate) => void;
  loading?: boolean;
}

export function TodoList({
  todos,
  onToggle,
  onDelete,
  onCreate,
  onUpdate,
  loading,
}: TodoListProps) {
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoDescription, setNewTodoDescription] = useState("");
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const handleCreate = () => {
    if (!newTodoTitle.trim()) return;
    onCreate({
      title: newTodoTitle,
      description: newTodoDescription || undefined,
      completed: false,
    });
    setNewTodoTitle("");
    setNewTodoDescription("");
  };

  const handleEditOpen = (todo: Todo) => {
    setEditingTodo(todo);
    setEditTitle(todo.title);
    setEditDescription(todo.description || "");
  };

  const handleEditClose = () => {
    setEditingTodo(null);
    setEditTitle("");
    setEditDescription("");
  };

  const handleEditSave = () => {
    if (editingTodo && editTitle.trim()) {
      onUpdate(editingTodo._id, {
        title: editTitle,
        description: editDescription || undefined,
      });
      handleEditClose();
    }
  };

  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);

  return (
    <Box>
      {/* Create new todo */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Add New Task
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Task title"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            fullWidth
            size="small"
            disabled={loading}
            onKeyPress={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <TextField
            label="Description (optional)"
            value={newTodoDescription}
            onChange={(e) => setNewTodoDescription(e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={2}
            disabled={loading}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
            disabled={!newTodoTitle.trim() || loading}
          >
            Add Task
          </Button>
        </Box>
      </Paper>

      {/* Active todos */}
      <Typography variant="h6" gutterBottom>
        Active Tasks ({activeTodos.length})
      </Typography>
      <Paper>
        <List>
          {activeTodos.length === 0 ? (
            <ListItem>
              <ListItemText
                secondary="No active tasks. Add one above or ask the AI for suggestions!"
              />
            </ListItem>
          ) : (
            activeTodos.map((todo) => (
              <ListItem
                key={todo._id}
                secondaryAction={
                  <Box>
                    <IconButton
                      edge="end"
                      onClick={() => handleEditOpen(todo)}
                      disabled={loading}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      onClick={() => onDelete(todo._id)}
                      disabled={loading}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={todo.completed}
                    onChange={(e) => onToggle(todo._id, e.target.checked)}
                    disabled={loading}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={todo.title}
                  secondary={todo.description}
                />
              </ListItem>
            ))
          )}
        </List>
      </Paper>

      {/* Completed todos */}
      {completedTodos.length > 0 && (
        <>
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Completed ({completedTodos.length})
          </Typography>
          <Paper>
            <List>
              {completedTodos.map((todo) => (
                <ListItem
                  key={todo._id}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={() => onDelete(todo._id)}
                      disabled={loading}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={todo.completed}
                      onChange={(e) => onToggle(todo._id, e.target.checked)}
                      disabled={loading}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={todo.title}
                    secondary={todo.description}
                    sx={{
                      textDecoration: "line-through",
                      opacity: 0.6,
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingTodo} onClose={handleEditClose} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Task</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              label="Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              fullWidth
            />
            <TextField
              label="Description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose}>Cancel</Button>
          <Button onClick={handleEditSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
