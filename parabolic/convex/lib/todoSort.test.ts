import { describe, it, expect } from "vitest";
import { sortTodosByDoByDate } from "./todoSort";

describe("sortTodosByDoByDate", () => {
  it("puts items with doBy before items without", () => {
    const a = { doBy: "2025-03-15", createdAt: 100 };
    const b = { createdAt: 200 };
    expect(sortTodosByDoByDate(a, b)).toBeLessThan(0);
  });

  it("puts items without doBy after items with doBy", () => {
    const a = { createdAt: 200 };
    const b = { doBy: "2025-03-15", createdAt: 100 };
    expect(sortTodosByDoByDate(a, b)).toBeGreaterThan(0);
  });

  it("sorts chronologically when both have doBy", () => {
    const a = { doBy: "2025-01-01", createdAt: 100 };
    const b = { doBy: "2025-12-31", createdAt: 200 };
    expect(sortTodosByDoByDate(a, b)).toBeLessThan(0);
  });

  it("sorts by createdAt descending when neither has doBy", () => {
    const a = { createdAt: 100 };
    const b = { createdAt: 200 };
    // b.createdAt - a.createdAt = 100 > 0, so b comes first
    expect(sortTodosByDoByDate(a, b)).toBeGreaterThan(0);
  });

  it("returns 0 for identical items without doBy", () => {
    const a = { createdAt: 100 };
    const b = { createdAt: 100 };
    expect(sortTodosByDoByDate(a, b)).toBe(0);
  });

  it("returns 0 for identical doBy dates", () => {
    const a = { doBy: "2025-06-01", createdAt: 100 };
    const b = { doBy: "2025-06-01", createdAt: 200 };
    expect(sortTodosByDoByDate(a, b)).toBe(0);
  });
});
