/** Parse a date string to a sortable timestamp, Infinity for nulls */
function parseDateForSort(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? Infinity : d.getTime();
}

/** Sort tasks by sort_order ascending (nulls last), then due_date ascending (nulls last) */
export function sortTasks<T extends { sort_order?: string | null; due_date?: string | null }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.sort_order && b.sort_order) {
      return a.sort_order < b.sort_order ? -1 : a.sort_order > b.sort_order ? 1 : 0;
    }
    if (a.sort_order && !b.sort_order) return -1;
    if (!a.sort_order && b.sort_order) return 1;
    return parseDateForSort(a.due_date) - parseDateForSort(b.due_date);
  });
}
