'use client';

import { Box, Paper, Typography } from '@mui/material';
import { ChatMessage as ChatMessageType } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 2,
      }}
    >
      <Paper
        elevation={1}
        sx={{
          p: 2,
          maxWidth: '80%',
          backgroundColor: isUser ? 'primary.main' : 'background.paper',
          color: isUser ? 'primary.contrastText' : 'text.primary',
          borderRadius: 2,
          ...(isStreaming && {
            border: '2px dashed',
            borderColor: 'primary.main',
          }),
        }}
      >
        <Typography variant="body1" component="div">
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <Typography paragraph>{children}</Typography>,
                code: ({ children, className }) => (
                  <Box
                    component="code"
                    sx={{
                      display: 'block',
                      backgroundColor: 'rgba(0,0,0,0.05)',
                      p: 1,
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                    }}
                  >
                    {children}
                  </Box>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </Typography>
        {isStreaming && (
          <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.7 }}>
            Thinking...
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
