/**
 * Parse natural-language date references from task text into ISO date strings.
 * Shared across CalendarMode, HomeMode, and any future consumers.
 */
export function parseDueDate(text: string): string | undefined {
  const lower = text.toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toISO = (d: Date) => d.toISOString().split("T")[0];

  if (/\btonight\b|\btoday\b/.test(lower)) return toISO(today);

  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(today); d.setDate(d.getDate() + 1); return toISO(d);
  }
  if (/\bnext week\b/.test(lower)) {
    const d = new Date(today); d.setDate(d.getDate() + 7); return toISO(d);
  }

  const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  for (let i = 0; i < days.length; i++) {
    if (lower.includes(days[i])) {
      const d = new Date(today);
      const diff = ((i - today.getDay()) + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      return toISO(d);
    }
  }

  const monthAbbrs = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  for (let i = 0; i < monthAbbrs.length; i++) {
    const match = new RegExp(`${monthAbbrs[i]}[a-z]* (\\d{1,2})`).exec(lower);
    if (match) {
      const d = new Date(today.getFullYear(), i, parseInt(match[1]));
      if (d < today) d.setFullYear(d.getFullYear() + 1);
      return toISO(d);
    }
  }

  // "due 15th / by the 3rd" etc.
  const ordinal = /(?:due|by)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?/.exec(lower);
  if (ordinal) {
    const day = parseInt(ordinal[1]);
    const d = new Date(today.getFullYear(), today.getMonth(), day);
    if (d < today) d.setMonth(d.getMonth() + 1);
    return toISO(d);
  }

  return undefined;
}
