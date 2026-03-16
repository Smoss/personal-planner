import { describe, it, expect } from "vitest";
import { performDayMath } from "./datemath";

// Use a fixed date for deterministic tests — use noon UTC to avoid timezone issues
const today = new Date("2025-03-15T12:00:00Z");

describe("performDayMath", () => {
  describe("add_days", () => {
    it("adds days to today", () => {
      const result = performDayMath("add_days", undefined, 5, today);
      expect(result).toMatch(/^2025-03-20/);
    });

    it("handles adding 0 days", () => {
      const result = performDayMath("add_days", undefined, 0, today);
      expect(result).toMatch(/^2025-03-15/);
    });

    it("includes day-of-week name in result", () => {
      const result = performDayMath("add_days", undefined, 0, today);
      expect(result).toMatch(/\(.+day\)$/);
    });
  });

  describe("subtract_days", () => {
    it("subtracts days from today", () => {
      const result = performDayMath("subtract_days", undefined, 3, today);
      expect(result).toMatch(/^2025-03-12/);
    });
  });

  describe("days_between", () => {
    it("calculates days since a past date", () => {
      const result = performDayMath("days_between", "2025-03-10", undefined, today);
      expect(result).toMatch(/\d+ days since/);
    });

    it("calculates days until a future date", () => {
      const result = performDayMath("days_between", "2025-03-25", undefined, today);
      expect(result).toMatch(/\d+ days until/);
    });

    it("returns error when no date provided", () => {
      expect(performDayMath("days_between", undefined, undefined, today)).toBe(
        "Error: start date required"
      );
    });
  });

  describe("day_of_week", () => {
    it("returns a valid day name", () => {
      const validDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const result = performDayMath("day_of_week", undefined, undefined, today);
      expect(validDays).toContain(result);
    });
  });

  describe("week_of_year", () => {
    it("returns a numeric string", () => {
      const result = performDayMath("week_of_year", undefined, undefined, today);
      expect(Number(result)).toBeGreaterThan(0);
      expect(Number(result)).toBeLessThanOrEqual(53);
    });
  });

  describe("days_until_month_end", () => {
    it("returns a non-negative number", () => {
      const result = performDayMath("days_until_month_end", undefined, undefined, today);
      expect(Number(result)).toBeGreaterThanOrEqual(0);
    });
  });

  describe("unknown operation", () => {
    it("returns error string for invalid operation", () => {
      expect(performDayMath("foobar", undefined, undefined, today)).toBe(
        "Unknown operation: foobar"
      );
    });
  });
});
