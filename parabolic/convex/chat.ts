import { v } from "convex/values";
import { action } from "./_generated/server";
import { runAgentStream, acceptSuggestion, type StreamEvent } from "./agent";
import type { Suggestion } from "./agent";

/**
 * HTTP Action for streaming chat
 * This uses Convex's HTTP action support to stream responses to the client
 */
export const streamChat = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, { messages }) => {
    // Create a stream for the response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Run the agent and stream results
          for await (const event of runAgentStream({ messages, ctx })) {
            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`event: ${event.type}\n`));
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        } catch (error) {
          const errorEvent: StreamEvent = {
            type: "response",
            content: error instanceof Error ? error.message : "Unknown error occurred",
          };
          const data = JSON.stringify(errorEvent);
          controller.enqueue(encoder.encode(`event: error\n`));
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    // Return the stream response
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  },
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
