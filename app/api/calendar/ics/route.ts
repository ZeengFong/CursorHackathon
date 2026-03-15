import { NextRequest } from "next/server";

interface TaskPayload {
  name: string;
  description?: string | null;
  due_date: string; // YYYY-MM-DD
}

function escapeIcs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function POST(req: NextRequest) {
  try {
    const { tasks } = (await req.json()) as { tasks: TaskPayload[] };

    const datedTasks = (tasks || []).filter((t) => t.due_date);

    if (datedTasks.length === 0) {
      return new Response("No dated tasks to export", { status: 400 });
    }

    const now = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");

    const events = datedTasks.map((task, i) => {
      const dateClean = task.due_date.replace(/-/g, "");
      const desc = task.description ? `\\n${escapeIcs(task.description)}` : "";
      return [
        "BEGIN:VEVENT",
        `UID:braindump-${dateClean}-${i}@braindump.app`,
        `DTSTAMP:${now}`,
        `DTSTART:${dateClean}T210000`,
        `DTEND:${dateClean}T235900`,
        `SUMMARY:${escapeIcs(task.name)}`,
        `DESCRIPTION:BrainDump task${desc}`,
        "END:VEVENT",
      ].join("\r\n");
    });

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BrainDump//Tasks//EN",
      "CALSCALE:GREGORIAN",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "attachment; filename=braindump-tasks.ics",
      },
    });
  } catch (error) {
    console.error("[/api/calendar/ics]", error);
    return new Response("Failed to generate ICS", { status: 500 });
  }
}
