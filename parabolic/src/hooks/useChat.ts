"use client";

import { useState, useCallback, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { ChatMessage, Suggestion } from "@/lib/convex";

interface UseChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  currentSuggestions: Suggestion[];
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
}

interface StreamEvent {
  type: "thinking" | "tool_call" | "tool_result" | "response" | "suggestion" | "error";
  content?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: string;
  data?: Suggestion;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentSuggestions, setCurrentSuggestions] = useState<Suggestion[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamChat = useAction(api.chat.streamChat);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Add user message
      const userMessage: ChatMessage = { role: "user", content };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setIsStreaming(true);
      setStreamingContent("");

      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Call Convex streaming action
        const response = await streamChat({ messages: newMessages });

        if (!(response instanceof Response)) {
          throw new Error("Expected Response from streamChat");
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let fullResponse = "";
        const suggestions: Suggestion[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process SSE events
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith("event: ")) {
              const eventType = line.slice(7);
              const dataLine = lines[++i];

              if (dataLine?.startsWith("data: ")) {
                const data = dataLine.slice(6);

                try {
                  const event: StreamEvent = JSON.parse(data);

                  if (eventType === "response" && event.content) {
                    fullResponse = event.content;
                    setStreamingContent(fullResponse);
                  } else if (eventType === "suggestion" && event.data) {
                    suggestions.push(event.data);
                    setCurrentSuggestions([...suggestions]);
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }
          }
        }

        // Add assistant message
        if (fullResponse) {
          setMessages((prev) => [...prev, { role: "assistant", content: fullResponse }]);
        }

        setCurrentSuggestions(suggestions);
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Chat error:", error);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Sorry, there was an error processing your message." },
          ]);
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        abortControllerRef.current = null;
      }
    },
    [messages, streamChat]
  );

  const clearChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setStreamingContent("");
    setCurrentSuggestions([]);
    setIsStreaming(false);
  }, []);

  return {
    messages,
    isStreaming,
    streamingContent,
    currentSuggestions,
    sendMessage,
    clearChat,
  };
}
