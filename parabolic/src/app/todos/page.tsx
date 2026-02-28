"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  AppBar,
  Toolbar,
  IconButton,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import type { Id } from "convex/values";
import { api } from "../../../convex/_generated/api";
import { TodoList } from "@/components/TodoList";
import type { Todo, TodoCreate, TodoUpdate } from "@/lib/convex";

export default function TodosPage() {
  const [error, setError] = useState<string | null>(null);

  // Convex hooks for data and mutations
  const todos = useQuery(api.todos.getAll) || [];
  const createTodo = useMutation(api.todos.create);
  const updateTodo = useMutation(api.todos.update);
  const removeTodo = useMutation(api.todos.remove);
  const toggleTodo = useMutation(api.todos.toggle);

  // Handlers
  const handleToggle = async (id: string, completed: boolean) => {
    try {
      await toggleTodo({ id: id as Id<"todos"> });
    } catch {
      setError("Failed to update todo");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeTodo({ id: id as Id<"todos"> });
    } catch {
      setError("Failed to delete todo");
    }
  };

  const handleCreate = async (todo: TodoCreate) => {
    try {
      await createTodo(todo);
    } catch {
      setError("Failed to create todo");
    }
  };

  const handleUpdate = async (id: string, todo: TodoUpdate) => {
    try {
      await updateTodo({ id: id as Id<"todos">, ...todo });
    } catch {
      setError("Failed to update todo");
    }
  };

  return (
    <Box>
      {/* Header */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            component={Link}
            href="/"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
            Manage Todos
          </Typography>
          <Button
            color="inherit"
            component={Link}
            href="/"
          >
            Back to Chat
          </Button>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Box sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
        {todos === undefined ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TodoList
            todos={todos}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            loading={false}
          />
        )}
      </Box>

      {/* Error snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
