import { v } from "convex/values";
import { action, httpAction } from "./_generated/server";
import { runAgentStream, acceptSuggestion, type StreamEvent } from "./agent";
import type { Suggestion } from "./agent";

/**
 * HTTP Action for streaming chat
 * This uses Convex's HTTP action support to stream responses to the client
 */
export const streamChat = httpAction(async (ctx, request) => {
  console.log(`[streamChat] ${request.method} request received`);

  // Handle CORS preflight request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const body = await request.json();
  const messages = body.messages;
  console.log("[streamChat] Messages received:", messages.length);
  console.log("[streamChat] Last message:", messages[messages.length - 1]?.content?.substring(0, 100));
  // Create a stream for the response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      console.log("[streamChat] Starting agent stream...");
      try {
        // Run the agent and stream results
        for await (const event of runAgentStream({ messages, ctx })) {
          console.log("[streamChat] Streaming event:", event.type);
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`event: ${event.type}\n`));
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
      } catch (error) {
        console.error("[streamChat] Stream error:", error);
        const errorEvent: StreamEvent = {
          type: "response",
          content: error instanceof Error ? error.message : "Unknown error occurred",
        };
        const data = JSON.stringify(errorEvent);
        controller.enqueue(encoder.encode(`event: error\n`));
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      } finally {
        console.log("[streamChat] Stream closed");
        controller.close();
      }
    },
  });

  // Return the stream response with CORS headers
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
});

/**
 * Action to accept a suggestion and create a todo
 */
export const acceptSuggestionAction = action({
  args: {
    suggestion: v.object({
      id: v.string(),
      title: v.string(),
      description: v.string(),
      reasoning: v.string(),
    }),
  },
  handler: async (ctx, { suggestion }) => {
    const todoId = await acceptSuggestion(ctx, suggestion);
    return { success: true, todoId };
  },
});

/**
 * Action to reject a suggestion
 */
export const rejectSuggestionAction = action({
  args: {
    suggestionId: v.string(),
  },
  handler: async (_ctx, { suggestionId }) => {
    // In-memory suggestions are cleared after each chat session
    // This action exists for API completeness
    console.log(`Suggestion ${suggestionId} rejected`);
    return { success: true };
  },
});
