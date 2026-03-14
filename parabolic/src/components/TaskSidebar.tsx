"use client";

import { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  IconButton,
  Divider,
  Chip,
  Stack,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

type Todo = Doc<"todos">;

interface GroupedTodos {
  date: string | null;
  label: string;
  isOverdue: boolean;
  isToday: boolean;
  activeTodos: Todo[];
  completedTodos: Todo[];
}

function groupTodosByDate(todos: Todo[]): GroupedTodos[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Group by doBy date
  const groups = new Map<string | null, Todo[]>();

  for (const todo of todos) {
    const key = todo.doBy || null;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(todo);
  }

  // Convert to array and sort dates (null goes last, then by date)
  const sortedEntries = Array.from(groups.entries()).sort((a, b) => {
    if (a[0] === null) return 1;
    if (b[0] === null) return -1;
    return a[0].localeCompare(b[0]);
  });

  return sortedEntries.map(([date, todos]) => {
    const dateObj = date ? new Date(date) : null;
    if (dateObj) {
      dateObj.setHours(0, 0, 0, 0);
    }

    const isOverdue = dateObj !== null && dateObj < today;
    const isToday = dateObj !== null && dateObj.getTime() === today.getTime();

    let label: string;
    if (date === null) {
      label = "No Date";
    } else if (isToday) {
      label = "Today";
    } else {
      label = new Date(date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }

    return {
      date,
      label,
      isOverdue,
      isToday,
      activeTodos: todos.filter((t) => !t.completed),
      completedTodos: todos.filter((t) => t.completed),
    };
  });
}

export function TaskSidebar() {
  const todos = useQuery(api.todos.getAllByDoByDate) || [];
  const toggleTodo = useMutation(api.todos.toggle);
  const removeTodo = useMutation(api.todos.remove);

  const groupedTodos = groupTodosByDate(todos);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        borderRight: 1,
        borderColor: "divider",
      }}
    >
      {/* Task List */}
      <Box sx={{ flex: 1, overflow: "auto", p: 0 }}>
        {groupedTodos.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              No tasks
            </Typography>
          </Box>
        ) : (
          groupedTodos.map((group, groupIndex) => (
            <Box key={group.date || "no-date"}>
              {/* Date Header */}
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  px: 2,
                  borderRadius: 0,
                  bgcolor: group.isOverdue
                    ? "error.main"
                    : group.isToday
                      ? "primary.main"
                      : "background.default",
                  color: group.isOverdue || group.isToday
                    ? "primary.contrastText"
                    : "text.primary",
                  borderBottom: 1,
                  borderColor: "divider",
                }}
              >
                <Typography
                  variant="subtitle2"
                  component="h3"
                  sx={{
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  {group.label}
                  {group.isOverdue && (
                    <Chip
                      label="Overdue"
                      size="small"
                      sx={{
                        bgcolor: "rgba(255,255,255,0.2)",
                        color: "inherit",
                        fontSize: "0.7rem",
                        height: 20,
                      }}
                    />
                  )}
                </Typography>
              </Paper>

              <Box sx={{ p: 2, pt: 1.5 }}>
                {/* Active Tasks */}
                {group.activeTodos.length === 0 ? (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1, fontStyle: "italic" }}
                  >
                    No active tasks
                  </Typography>
                ) : (
                  <List dense disablePadding>
                    {group.activeTodos.map((todo) => (
                      <ListItem
                        key={todo._id}
                        disablePadding
                        sx={{ mb: 0.5, pr: 1 }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Checkbox
                            edge="start"
                            checked={todo.completed}
                            onChange={() => toggleTodo({ id: todo._id })}
                            size="small"
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={todo.title}
                          secondary={todo.description}
                          primaryTypographyProps={{ variant: "body2", noWrap: true }}
                          secondaryTypographyProps={{ variant: "caption", noWrap: true }}
                        />
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                          sx={{ ml: 1 }}
                        >
                          <IconButton
                            size="small"
                            onClick={() => removeTodo({ id: todo._id })}
                            sx={{ p: 0.5 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </ListItem>
                    ))}
                  </List>
                )}

                {/* Completed Tasks */}
                {group.completedTodos.length > 0 && (
                  <>
                    <Divider sx={{ my: 1.5 }} />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        mb: 0.5,
                        display: "block",
                        fontWeight: 500,
                      }}
                    >
                      Completed ({group.completedTodos.length})
                    </Typography>
                    <List dense disablePadding>
                      {group.completedTodos.map((todo) => (
                        <ListItem
                          key={todo._id}
                          disablePadding
                          sx={{ mb: 0.5, pr: 1, opacity: 0.7 }}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Checkbox
                              edge="start"
                              checked={todo.completed}
                              onChange={() => toggleTodo({ id: todo._id })}
                              size="small"
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={todo.title}
                            secondary={todo.description}
                            primaryTypographyProps={{
                              variant: "body2",
                              noWrap: true,
                              sx: {
                                textDecoration: "line-through",
                              },
                            }}
                            secondaryTypographyProps={{
                              variant: "caption",
                              noWrap: true,
                              sx: {
                                textDecoration: "line-through",
                              },
                            }}
                          />
                          <Stack
                            direction="row"
                            spacing={0.5}
                            alignItems="center"
                            sx={{ ml: 1 }}
                          >
                            <IconButton
                              size="small"
                              onClick={() => removeTodo({ id: todo._id })}
                              sx={{ p: 0.5 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </Box>

              {/* Divider between date groups */}
              {groupIndex < groupedTodos.length - 1 && (
                <Divider sx={{ borderWidth: 2, borderColor: "divider" }} />
              )}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
