import { describe, it, expect, vi } from "vitest";
import { parseSSELines } from "./parseSSE";

describe("parseSSELines", () => {
  it("parses a complete event (event + data lines)", () => {
    const lines = [
      'event: response',
      'data: {"type":"response","content":"hello"}',
    ];
    const { events, pendingEventType } = parseSSELines(lines);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("response");
    expect(events[0].event.content).toBe("hello");
    expect(pendingEventType).toBeNull();
  });

  it("handles multiple events in one buffer", () => {
    const lines = [
      'event: thinking',
      'data: {"type":"thinking","content":"hmm"}',
      'event: response',
      'data: {"type":"response","content":"done"}',
    ];
    const { events } = parseSSELines(lines);
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe("thinking");
    expect(events[1].eventType).toBe("response");
  });

  it("preserves pending event type when data line not yet received", () => {
    const lines = ['event: response'];
    const { events, pendingEventType } = parseSSELines(lines);
    expect(events).toHaveLength(0);
    expect(pendingEventType).toBe("response");
  });

  it("uses initial pending event type for first data line", () => {
    const lines = ['data: {"type":"response","content":"hi"}'];
    const { events } = parseSSELines(lines, "response");
    expect(events).toHaveLength(1);
    expect(events[0].event.content).toBe("hi");
  });

  it("resets pending event type on empty line", () => {
    const lines = ['event: response', ''];
    const { events, pendingEventType } = parseSSELines(lines);
    expect(events).toHaveLength(0);
    expect(pendingEventType).toBeNull();
  });

  it("logs warning for malformed JSON and continues", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const lines = [
      'event: response',
      'data: not-json',
      'event: response',
      'data: {"type":"response","content":"ok"}',
    ];
    const { events } = parseSSELines(lines);
    expect(events).toHaveLength(1);
    expect(events[0].event.content).toBe("ok");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[parseSSE] Failed to parse SSE data:"),
      "not-json",
      expect.anything()
    );
    warnSpy.mockRestore();
  });

  it("ignores data lines without a pending event type", () => {
    const lines = ['data: {"type":"response","content":"orphan"}'];
    const { events } = parseSSELines(lines);
    expect(events).toHaveLength(0);
  });

  it("returns empty events for empty input", () => {
    const { events, pendingEventType } = parseSSELines([]);
    expect(events).toHaveLength(0);
    expect(pendingEventType).toBeNull();
  });

  it("parses tool_call events", () => {
    const lines = [
      'event: tool_call',
      'data: {"type":"tool_call","tool":"get_todos","args":{}}',
    ];
    const { events } = parseSSELines(lines);
    expect(events).toHaveLength(1);
    expect(events[0].event.tool).toBe("get_todos");
  });

  it("parses suggestion events with data field", () => {
    const lines = [
      'event: suggestion',
      'data: {"type":"suggestion","data":{"id":"s1","title":"Buy milk","description":"From store","reasoning":"You mentioned groceries"}}',
    ];
    const { events } = parseSSELines(lines);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("suggestion");
    expect((events[0].event.data as any).title).toBe("Buy milk");
  });
});
