'use client';

import { useState, useEffect } from 'react';
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
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Link from 'next/link';
import { TodoList } from '@/components/TodoList';
import { Todo, TodoCreate, TodoUpdate, todosApi } from '@/lib/api';

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load todos
  const loadTodos = async () => {
    try {
      setLoading(true);
      const response = await todosApi.getAll();
      setTodos(response.data);
    } catch {
      setError('Failed to load todos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodos();
  }, []);

  // Handlers
  const handleToggle = async (id: string, completed: boolean) => {
    setActionLoading(true);
    try {
      await todosApi.update(id, { completed });
      await loadTodos();
    } catch {
      setError('Failed to update todo');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(true);
    try {
      await todosApi.delete(id);
      await loadTodos();
    } catch {
      setError('Failed to delete todo');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async (todo: TodoCreate) => {
    setActionLoading(true);
    try {
      await todosApi.create(todo);
      await loadTodos();
    } catch {
      setError('Failed to create todo');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async (id: string, todo: TodoUpdate) => {
    setActionLoading(true);
    try {
      await todosApi.update(id, todo);
      await loadTodos();
    } catch {
      setError('Failed to update todo');
    } finally {
      setActionLoading(false);
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
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TodoList
            todos={todos}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            loading={actionLoading}
          />
        )}
      </Box>

      {/* Error snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
