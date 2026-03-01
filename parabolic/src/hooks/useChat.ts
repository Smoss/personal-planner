"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatMessage, Suggestion } from "@/lib/convex";

interface ToolCallState {
  tool: string;
  args: Record<string, unknown>;
  result?: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  thinkingContent: string;
  activeToolCall: ToolCallState | null;
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
  const [thinkingContent, setThinkingContent] = useState("");
  const [activeToolCall, setActiveToolCall] = useState<ToolCallState | null>(null);
  const [currentSuggestions, setCurrentSuggestions] = useState<Suggestion[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Add user message
      const userMessage: ChatMessage = { role: "user", content };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setIsStreaming(true);
      setStreamingContent("");
      setThinkingContent("");
      setActiveToolCall(null);

      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Call Convex HTTP action directly
        const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.replace(/\/+$/, "") || "";
        console.log("[useChat] Sending message to", `${siteUrl}/chat/streamChat`);
        const response = await fetch(`${siteUrl}/chat/streamChat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newMessages }),
          signal: abortController.signal,
        });
        console.log("[useChat] Response status:", response.status);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let fullResponse = "";
        const suggestions: Suggestion[] = [];
        let pendingEventType: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log("[useChat] Stream complete, full response length:", fullResponse.length);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          console.log("[useChat] Raw SSE chunk:", buffer);

          // Process SSE events - buffer eventType across lines to handle chunk boundaries
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              pendingEventType = line.slice(7);
            } else if (line.startsWith("data: ") && pendingEventType) {
              const data = line.slice(6);
              console.log("[useChat] Parsed event:", pendingEventType, "data:", data.substring(0, 100));

              try {
                const event: StreamEvent = JSON.parse(data);

                if (pendingEventType === "response" && event.content) {
                  fullResponse = event.content;
                  setStreamingContent(fullResponse);
                  // Clear thinking/tool state once we have a response
                  setThinkingContent("");
                  setActiveToolCall(null);
                } else if (pendingEventType === "suggestion" && event.data) {
                  suggestions.push(event.data);
                  setCurrentSuggestions([...suggestions]);
                } else if (pendingEventType === "thinking" && event.content) {
                  setThinkingContent(event.content);
                  setActiveToolCall(null);
                } else if (pendingEventType === "tool_call" && event.tool) {
                  setActiveToolCall({ tool: event.tool, args: event.args || {} });
                  setThinkingContent(`Using tool: ${event.tool}...`);
                } else if (pendingEventType === "tool_result" && event.tool) {
                  setActiveToolCall((prev) =>
                    prev?.tool === event.tool ? { ...prev, result: event.result } : prev
                  );
                  setThinkingContent(`Tool ${event.tool} completed`);
                }
              } catch {
                // Ignore parse errors
              }
              pendingEventType = null;
            } else if (line === "") {
              // Empty line marks end of event, reset pending
              pendingEventType = null;
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
        setThinkingContent("");
        setActiveToolCall(null);
        abortControllerRef.current = null;
      }
    },
    [messages]
  );

  const clearChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setStreamingContent("");
    setThinkingContent("");
    setActiveToolCall(null);
    setCurrentSuggestions([]);
    setIsStreaming(false);
  }, []);

  return {
    messages,
    isStreaming,
    streamingContent,
    thinkingContent,
    activeToolCall,
    currentSuggestions,
    sendMessage,
    clearChat,
  };
}
