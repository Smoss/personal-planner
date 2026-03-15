/**
 * Sort comparator for todos by doBy date.
 * Items with doBy come first (chronological), items without doBy come last (by createdAt desc).
 */
export function sortTodosByDoByDate(
  a: { doBy?: string; createdAt: number },
  b: { doBy?: string; createdAt: number }
): number {
  // If neither has doBy, maintain order by createdAt descending
  if (!a.doBy && !b.doBy) {
    return b.createdAt - a.createdAt;
  }
  // Tasks without doBy go to the end
  if (!a.doBy) return 1;
  if (!b.doBy) return -1;
  // Both have doBy, sort chronologically
  return a.doBy.localeCompare(b.doBy);
}
