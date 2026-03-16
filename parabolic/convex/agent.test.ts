import { describe, it, expect, vi } from "vitest";

// Mock Convex generated modules before importing agent
vi.mock("./_generated/api", () => ({ api: {} }));
vi.mock("./_generated/server", () => ({}));

import { getDateContext, convertToLangChainMessages } from "./agent";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

describe("getDateContext", () => {
  it("contains date in yyyy-MM-dd format", () => {
    const ctx = getDateContext();
    expect(ctx).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("contains day of week name", () => {
    const ctx = getDateContext();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    expect(dayNames.some((day) => ctx.includes(day))).toBe(true);
  });

  it("contains week of year", () => {
    const ctx = getDateContext();
    expect(ctx).toContain("Week of year:");
  });

  it("contains days remaining in month", () => {
    const ctx = getDateContext();
    expect(ctx).toContain("Days remaining in month:");
  });

  it("contains current time in HH:mm format", () => {
    const ctx = getDateContext();
    expect(ctx).toMatch(/Current time: \d{2}:\d{2}/);
  });
});

describe("convertToLangChainMessages", () => {
  it("returns empty array for empty input", () => {
    expect(convertToLangChainMessages([])).toEqual([]);
  });

  it("converts user message to HumanMessage", () => {
    const result = convertToLangChainMessages([{ role: "user", content: "hello" }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(HumanMessage);
    expect(result[0].content).toBe("hello");
  });

  it("converts assistant message to AIMessage", () => {
    const result = convertToLangChainMessages([{ role: "assistant", content: "hi" }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(AIMessage);
    expect(result[0].content).toBe("hi");
  });

  it("converts system message to SystemMessage", () => {
    const result = convertToLangChainMessages([{ role: "system", content: "you are helpful" }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(SystemMessage);
    expect(result[0].content).toBe("you are helpful");
  });

  it("preserves order for mixed messages", () => {
    const messages = [
      { role: "system" as const, content: "sys" },
      { role: "user" as const, content: "hi" },
      { role: "assistant" as const, content: "hello" },
      { role: "user" as const, content: "bye" },
    ];
    const result = convertToLangChainMessages(messages);
    expect(result).toHaveLength(4);
    expect(result[0]).toBeInstanceOf(SystemMessage);
    expect(result[1]).toBeInstanceOf(HumanMessage);
    expect(result[2]).toBeInstanceOf(AIMessage);
    expect(result[3]).toBeInstanceOf(HumanMessage);
  });

  it("handles messages with empty content", () => {
    const result = convertToLangChainMessages([{ role: "user", content: "" }]);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("");
  });
});
