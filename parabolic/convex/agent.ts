import { tool } from "@langchain/core/tools";
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod";
import { format, addDays, subDays, differenceInDays, getDay, getWeek, endOfMonth } from "date-fns";
import type { ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";

// Agent state for tracking iterations and pending suggestions
interface AgentState {
  iterationCount: number;
  maxIterations: number;
  pendingSuggestions: Suggestion[];
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  reasoning: string;
}

// Stream event types
export interface StreamEvent {
  type: "thinking" | "tool_call" | "tool_result" | "response" | "suggestion";
  content?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: string;
  data?: Suggestion;
}

/**
 * Generate current date context for the agent
 */
function getDateContext(): string {
  const now = new Date();
  const daysUntilMonthEnd = differenceInDays(endOfMonth(now), now);

  return `Current Context:
- Today's date: ${format(now, "yyyy-MM-dd")} (${format(now, "EEEE")})
- Week of year: ${getWeek(now)}
- Days remaining in month: ${daysUntilMonthEnd}
- Current time: ${format(now, "HH:mm")}
`;
}

/**
 * Create tool instances bound to the Convex context
 */
function createTools(ctx: ActionCtx, state: AgentState) {
  // Get todos tool
  const getTodosTool = tool(
    async () => {
      console.log("[Tool:get_todos] Fetching todos...");
      const todos = await ctx.runQuery(api.todos.getAll, {});
      console.log("[Tool:get_todos] Found", todos?.length || 0, "todos");
      if (!todos || todos.length === 0) {
        return "No todos found.";
      }
      let result = "Current todos:\n";
      for (const todo of todos) {
        const status = todo.completed ? "✓" : "○";
        result += `  ${status} ${todo.title}`;
        if (todo.description) {
          result += ` - ${todo.description}`;
        }
        result += "\n";
      }
      return result;
    },
    {
      name: "get_todos",
      description: "Retrieve all current todos from the database",
      schema: z.object({}),
    }
  );

  // Search todos tool
  const searchTodosTool = tool(
    async ({ query }: { query: string }) => {
      console.log("[Tool:search_todos] Query:", query);
      const todos = await ctx.runQuery(api.todos.search, { query, limit: 5 });
      if (!todos || todos.length === 0) {
        return `No todos found matching '${query}'.`;
      }
      let result = `Todos matching '${query}':\n`;
      for (const todo of todos) {
        const status = todo.completed ? "✓" : "○";
        result += `  ${status} ${todo.title}`;
        if (todo.description) {
          result += ` - ${todo.description}`;
        }
        result += "\n";
      }
      return result;
    },
    {
      name: "search_todos",
      description: "Search todos using semantic similarity. Good for finding related tasks.",
      schema: z.object({
        query: z.string().describe("The search query to find related todos"),
      }),
    }
  );

  // Day math tool
  const dayMathTool = tool(
    async ({
      operation,
      date,
      days,
    }: {
      operation: string;
      date?: string;
      days?: number;
    }) => {
      console.log("[Tool:day_math] Operation:", operation, "date:", date, "days:", days);
      const today = new Date();

      switch (operation) {
        case "add_days": {
          const start = date ? new Date(date) : today;
          const result = addDays(start, days || 0);
          return `${format(result, "yyyy-MM-dd")} (${format(result, "EEEE")})`;
        }
        case "subtract_days": {
          const start = date ? new Date(date) : today;
          const result = subDays(start, days || 0);
          return `${format(result, "yyyy-MM-dd")} (${format(result, "EEEE")})`;
        }
        case "days_between": {
          if (!date) return "Error: start date required";
          const start = new Date(date);
          const diff = differenceInDays(today, start);
          return `${Math.abs(diff)} days ${diff > 0 ? "since" : "until"}`;
        }
        case "day_of_week": {
          const targetDate = date ? new Date(date) : today;
          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          return days[getDay(targetDate)];
        }
        case "week_of_year": {
          const targetDate = date ? new Date(date) : today;
          return String(getWeek(targetDate));
        }
        case "days_until_month_end": {
          const current = date ? new Date(date) : today;
          const daysRemaining = differenceInDays(endOfMonth(current), current);
          return String(daysRemaining);
        }
        default:
          return `Unknown operation: ${operation}`;
      }
    },
    {
      name: "day_math",
      description: "Perform date calculations for planning",
      schema: z.object({
        operation: z.enum([
          "add_days",
          "subtract_days",
          "days_between",
          "day_of_week",
          "week_of_year",
          "days_until_month_end",
        ]),
        date: z.string().optional().describe("ISO format date string (YYYY-MM-DD)"),
        days: z.number().optional().describe("Number of days for add/subtract operations"),
      }),
    }
  );

  // Suggest todo tool
  const suggestTodoTool = tool(
    async ({
      title,
      description,
      reasoning,
    }: {
      title: string;
      description: string;
      reasoning: string;
    }) => {
      console.log("[Tool:suggest_todo] Creating suggestion:", title);
      const suggestion: Suggestion = {
        id: `sugg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        description,
        reasoning,
      };
      state.pendingSuggestions.push(suggestion);
      return `Suggestion created: '${title}'. User can accept or reject this suggestion.`;
    },
    {
      name: "suggest_todo",
      description: "Suggest a new todo to the user. Creates a pending suggestion that the user can accept or reject. Does NOT add to database directly.",
      schema: z.object({
        title: z.string().describe("The title of the suggested todo"),
        description: z.string().describe("A detailed description of the suggested todo"),
        reasoning: z.string().describe("Explanation of why this todo is being suggested"),
      }),
    }
  );

  return [getTodosTool, searchTodosTool, dayMathTool, suggestTodoTool];
}

/**
 * Convert message format to LangChain messages
 */
function convertToLangChainMessages(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>
): (HumanMessage | AIMessage | SystemMessage)[] {
  const lcMessages: (HumanMessage | AIMessage | SystemMessage)[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      lcMessages.push(new HumanMessage(msg.content));
    } else if (msg.role === "assistant") {
      lcMessages.push(new AIMessage(msg.content));
    } else if (msg.role === "system") {
      lcMessages.push(new SystemMessage(msg.content));
    }
  }

  return lcMessages;
}

/**
 * Execute a tool by name
 */
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  tools: ReturnType<typeof createTools>
): Promise<string> {
  const toolInstance = tools.find((t) => t.name === toolName);
  if (!toolInstance) {
    return `Tool ${toolName} not found`;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (toolInstance as any).invoke(args);
    return String(result);
  } catch (error) {
    return `Error executing tool ${toolName}: ${error}`;
  }
}

/**
 * Run the agent with streaming support
 */
export async function* runAgentStream({
  messages,
  ctx,
}: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  ctx: ActionCtx;
}): AsyncGenerator<StreamEvent, void, unknown> {
  console.log("[runAgentStream] Starting with", messages.length, "messages");
  console.log("[runAgentStream] LLM config:", {
    model: "qwen3:latest",
    baseUrl: process.env.OLLAMA_BASE_URL,
  });

  // Initialize agent state
  const state: AgentState = {
    iterationCount: 0,
    maxIterations: 15,
    pendingSuggestions: [],
  };

  // Create LLM instance
  const llm = new ChatOllama({
    model: "qwen3:latest",
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    temperature: 0.7,
    streaming: true,
  });

  // Create tools bound to context
  const tools = createTools(ctx, state);
  const llmWithTools = llm.bindTools(tools);

  // Build system prompt
  const systemPrompt = `You are a helpful day planning assistant.

${getDateContext()}

Your goal is to help users organize their day and manage their todo list effectively.

Guidelines:
- You can retrieve current todos using get_todos
- You can search todos semantically using search_todos for finding related tasks
- You can calculate dates using day_math for scheduling
- When suggesting new todos, use suggest_todo - the user must explicitly accept before it gets added
- Be concise but helpful in your responses
- If the user asks about their day or plans, first check their current todos
- After 15 iterations, you will gracefully wrap up the conversation`;

  // Convert messages to LangChain format
  const lcMessages = [new SystemMessage(systemPrompt), ...convertToLangChainMessages(messages)];

  // Main agent loop
  while (state.iterationCount < state.maxIterations) {
    state.iterationCount++;
    console.log(`[runAgentStream] --- Iteration ${state.iterationCount}/${state.maxIterations} ---`);

    yield { type: "thinking", content: `Iteration ${state.iterationCount}: Processing...` };

    // Stream from LLM
    const stream = await llmWithTools.stream(lcMessages);
    let fullContent = "";
    let pendingToolCalls: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }> = [];

    for await (const chunk of stream) {
      // Accumulate content
      const content = chunk.content as string;
      if (content) {
        fullContent += content;
        // Stream content chunks as they arrive
        yield { type: "response", content: fullContent };
      }

      // Check for tool calls in the chunk
      if (chunk.tool_calls && chunk.tool_calls.length > 0) {
        for (const tc of chunk.tool_calls) {
          const existing = pendingToolCalls.find((p) => p.id === tc.id);
          if (!existing && tc.id && tc.name) {
            pendingToolCalls.push({
              id: tc.id,
              name: tc.name,
              args: tc.args as Record<string, unknown>,
            });
          }
        }
      }
    }

    console.log("[runAgentStream] Stream complete, content length:", fullContent.length);

    // Create the final AI message for the conversation history
    const finalMessage = new AIMessage({
      content: fullContent,
      tool_calls: pendingToolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        args: tc.args,
      })),
    });

    // Check for tool calls
    if (pendingToolCalls.length > 0) {
      lcMessages.push(finalMessage);

      for (const toolCall of pendingToolCalls) {
        const toolName = toolCall.name;
        const toolArgs = toolCall.args;
        console.log("[runAgentStream] Executing tool:", toolName, "args:", toolArgs);

        yield {
          type: "tool_call",
          tool: toolName,
          args: toolArgs,
        };

        // Execute the tool
        const toolResult = await executeTool(toolName, toolArgs, tools);
        console.log("[runAgentStream] Tool result:", toolResult.substring(0, 150));

        yield {
          type: "tool_result",
          tool: toolName,
          result: toolResult.substring(0, 200),
        };

        // Add tool result to messages
        lcMessages.push(
          new ToolMessage({
            content: toolResult,
            tool_call_id: toolCall.id,
          })
        );
      }
    } else {
      // No tool calls, we have the final response
      console.log("[runAgentStream] Final response, pending suggestions:", state.pendingSuggestions.length);

      // Yield final suggestions
      for (const suggestion of state.pendingSuggestions) {
        yield { type: "suggestion", data: suggestion };
      }

      return;
    }
  }

  // Hit iteration limit
  const wrapUpMessage =
    "I've made several suggestions and explored your todos. Would you like me to continue with anything specific, or shall we wrap up?";
  yield { type: "response", content: wrapUpMessage };
}

/**
 * Accept a suggestion and create a todo
 */
export async function acceptSuggestion(
  ctx: ActionCtx,
  suggestion: Suggestion
): Promise<string> {
  const todoId = await ctx.runMutation(api.todos.create, {
    title: suggestion.title,
    description: suggestion.description,
    completed: false,
  });
  return todoId;
}

/**
 * Reject a suggestion (just removes from pending)
 */
export function rejectSuggestion(suggestionId: string): void {
  // In a real implementation with persistent state, this would remove from storage
  // For now, suggestions are in-memory only during the agent run
  console.log(`Suggestion ${suggestionId} rejected`);
}
