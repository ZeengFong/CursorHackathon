export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildDateContext(currentTime: string): string {
  const now = new Date(currentTime);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const lines: string[] = [`Today is ${dayNames[now.getDay()]}, ${toLocalDateStr(now)}.`];
  lines.push("Upcoming days:");
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    lines.push(`  ${dayNames[d.getDay()]} = ${toLocalDateStr(d)}`);
  }
  return lines.join("\n");
}
