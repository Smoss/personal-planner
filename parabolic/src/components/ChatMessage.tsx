"use client";

import { Box, Paper, Typography, Avatar } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/convex";

interface ChatMessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        mb: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: isUser ? "row-reverse" : "row",
          alignItems: "flex-start",
          maxWidth: "80%",
          gap: 1,
        }}
      >
        <Avatar
          sx={{
            bgcolor: isUser ? "primary.main" : "secondary.main",
            width: 32,
            height: 32,
          }}
        >
          {isUser ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
        </Avatar>

        <Paper
          elevation={1}
          sx={{
            p: 2,
            backgroundColor: isUser ? "primary.light" : "background.paper",
            color: isUser ? "primary.contrastText" : "text.primary",
            borderRadius: 2,
            opacity: isStreaming ? 0.8 : 1,
            transition: "opacity 0.2s",
            wordBreak: "break-word",
          }}
        >
          <Typography
            component="div"
            sx={{
              "& p": { margin: "0.5em 0" },
              "& p:first-child": { marginTop: 0 },
              "& p:last-child": { marginBottom: 0 },
              "& ul, & ol": { margin: "0.5em 0", paddingLeft: "1.5em" },
              "& li": { margin: "0.25em 0" },
              "& code": {
                backgroundColor: "rgba(0, 0, 0, 0.08)",
                padding: "0.2em 0.4em",
                borderRadius: "3px",
                fontFamily: "monospace",
                fontSize: "0.9em",
              },
              "& pre": {
                backgroundColor: "rgba(0, 0, 0, 0.08)",
                padding: "1em",
                borderRadius: "4px",
                overflow: "auto",
                margin: "0.5em 0",
              },
              "& pre code": {
                backgroundColor: "transparent",
                padding: 0,
              },
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
