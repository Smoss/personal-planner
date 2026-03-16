interface StreamEvent {
  type: "thinking" | "tool_call" | "tool_result" | "response" | "suggestion" | "error";
  content?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: string;
  data?: unknown;
}

export interface ParsedEvent {
  eventType: string;
  event: StreamEvent;
}

export interface ParseSSEResult {
  events: ParsedEvent[];
  pendingEventType: string | null;
}

/**
 * Parse SSE lines into typed events.
 * Handles event/data line pairs and resets on empty lines.
 */
export function parseSSELines(
  lines: string[],
  pendingEventType: string | null = null
): ParseSSEResult {
  const events: ParsedEvent[] = [];
  let currentEventType = pendingEventType;

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      currentEventType = line.slice(7);
    } else if (line.startsWith("data: ") && currentEventType) {
      const data = line.slice(6);
      try {
        const event: StreamEvent = JSON.parse(data);
        events.push({ eventType: currentEventType, event });
      } catch (e) {
        console.warn("[parseSSE] Failed to parse SSE data:", data, e);
      }
      currentEventType = null;
    } else if (line === "") {
      // Empty line marks end of event, reset pending
      currentEventType = null;
    }
  }

  return { events, pendingEventType: currentEventType };
}
