import { format, addDays, subDays, differenceInDays, getDay, getWeek, endOfMonth } from "date-fns";

export type DayMathOperation =
  | "add_days"
  | "subtract_days"
  | "days_between"
  | "day_of_week"
  | "week_of_year"
  | "days_until_month_end";

/**
 * Perform date math operations for planning.
 * Pure function (given a fixed `today`) for testability.
 */
export function performDayMath(
  operation: string,
  date?: string,
  days?: number,
  today: Date = new Date()
): string {
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
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return dayNames[getDay(targetDate)];
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
}
