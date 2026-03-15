import { NextRequest, NextResponse } from "next/server";

interface TaskPayload {
  name: string;
  description?: string | null;
  due_date: string; // YYYY-MM-DD
}

export async function POST(req: NextRequest) {
  try {
    const { providerToken, tasks } = (await req.json()) as {
      providerToken: string;
      tasks: TaskPayload[];
    };

    if (!providerToken) {
      return NextResponse.json(
        { error: "No Google token. Please sign in with Google again." },
        { status: 401 },
      );
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ synced: 0 });
    }

    const results: { name: string; ok: boolean; error?: string }[] = [];

    for (const task of tasks) {
      if (!task.due_date) continue;

      const event = {
        summary: task.name,
        description: task.description || undefined,
        start: {
          dateTime: `${task.due_date}T21:00:00`,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        },
        end: {
          dateTime: `${task.due_date}T23:59:00`,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        },
      };

      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${providerToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        },
      );

      if (res.ok) {
        results.push({ name: task.name, ok: true });
      } else {
        const err = await res.text();
        results.push({ name: task.name, ok: false, error: err });
      }
    }

    const synced = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    return NextResponse.json({ synced, failed });
  } catch (error) {
    console.error("[/api/calendar/sync]", error);
    return NextResponse.json(
      { error: "Failed to sync to Google Calendar" },
      { status: 500 },
    );
  }
}
