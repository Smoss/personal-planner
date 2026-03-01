"use client";

import { useState, useRef, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  IconButton,
  Fab,
  Zoom,
  Avatar,
  Skeleton,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { SuggestionCard } from "./SuggestionCard";
import { TaskSidebar } from "./TaskSidebar";

export function Chat() {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const {
    messages,
    isStreaming,
    streamingContent,
    streamingThoughts,
    activeToolCall,
    currentSuggestions,
    sendMessage,
    clearChat,
  } = useChat();

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, isStreaming]);

  // Show/hide scroll button based on scroll position
  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const message = input;
    setInput("");
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "row", height: "100vh" }}>
      {/* Sidebar - Left 25% */}
      <Box sx={{ flex: "0 0 25%", minWidth: 250, maxWidth: 350 }}>
        <TaskSidebar />
      </Box>

      {/* Chat Area - Right 75% */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <Paper
          elevation={2}
          sx={{
            p: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h5" component="h1">
            AI Day Planner
          </Typography>
          <IconButton onClick={clearChat} disabled={isStreaming || messages.length === 0}>
            <DeleteSweepIcon />
          </IconButton>
        </Paper>

        {/* Messages */}
        <Box
          ref={chatContainerRef}
          onScroll={handleScroll}
          sx={{
            flex: 1,
            overflow: "auto",
            p: 2,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {messages.length === 0 ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                textAlign: "center",
              }}
            >
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Welcome to your AI Day Planner!
              </Typography>
              <Typography color="text.secondary">
                Ask me about your day, get suggestions, or manage your todos.
                <br />
                Try: "What should I do today?" or "Help me plan my week"
              </Typography>
            </Box>
          ) : (
            <>
              {messages.map((message, index) => (
                <ChatMessage key={index} message={message} />
              ))}

              {/* Suggestion cards */}
              {currentSuggestions.length > 0 && (
                <Box sx={{ my: 2 }}>
                  {currentSuggestions.map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                    />
                  ))}
                </Box>
              )}

              {/* Thinking indicator - shown when streaming but no content yet */}
              {isStreaming && !streamingContent && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "flex-start",
                    mb: 2,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "flex-start",
                      maxWidth: "80%",
                      gap: 1,
                    }}
                  >
                    <Avatar
                      sx={{
                        bgcolor: "secondary.main",
                        width: 32,
                        height: 32,
                      }}
                    >
                      <SmartToyIcon fontSize="small" />
                    </Avatar>
                    <Paper
                      elevation={1}
                      sx={{
                        p: 2,
                        backgroundColor: "background.paper",
                        borderRadius: 2,
                        minWidth: 120,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          Thinking
                        </Typography>
                        <Box
                          component="span"
                          sx={{
                            display: "inline-flex",
                            gap: 0.3,
                            ml: 0.5,
                          }}
                        >
                          {[0, 1, 2].map((i) => (
                            <Box
                              key={i}
                              component="span"
                              sx={{
                                width: 4,
                                height: 4,
                                borderRadius: "50%",
                                backgroundColor: "text.secondary",
                                animation: "pulse 1.4s ease-in-out infinite",
                                animationDelay: `${i * 0.2}s`,
                                "@keyframes pulse": {
                                  "0%, 60%, 100%": { opacity: 0.3, transform: "scale(0.8)" },
                                  "30%": { opacity: 1, transform: "scale(1)" },
                                },
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    </Paper>
                  </Box>
                </Box>
              )}

              {/* Streaming message with thoughts */}
              {isStreaming && streamingContent && (
                <ChatMessage
                  message={{ role: "assistant", content: streamingContent }}
                  isStreaming
                  streamingThoughts={streamingThoughts}
                />
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </Box>

        {/* Scroll to bottom button */}
        <Zoom in={showScrollButton}>
          <Fab
            size="small"
            color="primary"
            onClick={scrollToBottom}
            sx={{
              position: "absolute",
              bottom: 100,
              right: 24,
            }}
          >
            <ArrowDownwardIcon />
          </Fab>
        </Zoom>

        {/* Input */}
        <Paper
          elevation={3}
          sx={{
            p: 2,
            display: "flex",
            gap: 1,
            alignItems: "flex-end",
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder="Ask about your day or plans..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isStreaming}
            sx={{
              "& .MuiInputBase-root": {
                borderRadius: 3,
              },
            }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            endIcon={<SendIcon />}
            sx={{
              height: 56,
              borderRadius: 3,
              px: 3,
            }}
          >
            Send
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}
