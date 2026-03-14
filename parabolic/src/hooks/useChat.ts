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
  streamingThoughts: string;
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
  const [streamingThoughts, setStreamingThoughts] = useState("");
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
      setStreamingThoughts("");
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
        let accumulatedThoughts = "";
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
                  // Append incremental content (chunks) rather than replacing
                  fullResponse += event.content;
                  setStreamingContent(fullResponse);
                } else if (pendingEventType === "suggestion" && event.data) {
                  suggestions.push(event.data);
                  setCurrentSuggestions([...suggestions]);
                } else if (pendingEventType === "thinking" && event.content) {
                  accumulatedThoughts += event.content + "\n";
                  setStreamingThoughts(accumulatedThoughts);
                  setActiveToolCall(null);
                } else if (pendingEventType === "tool_call" && event.tool) {
                  setActiveToolCall({ tool: event.tool, args: event.args || {} });
                  accumulatedThoughts += `Using tool: ${event.tool}...\n`;
                  setStreamingThoughts(accumulatedThoughts);
                } else if (pendingEventType === "tool_result" && event.tool) {
                  setActiveToolCall((prev) => {
                    if (prev?.tool === event.tool && event.tool && prev) {
                      return { tool: event.tool, args: prev.args, result: event.result };
                    }
                    return prev;
                  });
                  accumulatedThoughts += `Tool ${event.tool} completed: ${event.result?.substring(0, 100) || "Done"}\n`;
                  setStreamingThoughts(accumulatedThoughts);
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

        // Add assistant message with accumulated thoughts
        if (fullResponse) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: fullResponse, thoughts: accumulatedThoughts.trim() || undefined },
          ]);
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
        setStreamingThoughts("");
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
    setStreamingThoughts("");
    setActiveToolCall(null);
    setCurrentSuggestions([]);
    setIsStreaming(false);
  }, []);

  return {
    messages,
    isStreaming,
    streamingContent,
    streamingThoughts,
    activeToolCall,
    currentSuggestions,
    sendMessage,
    clearChat,
  };
}
