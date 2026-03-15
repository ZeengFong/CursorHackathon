import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

function escapeIcs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  // Use anon client — the RPC function is SECURITY DEFINER so it bypasses RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase.rpc("get_tasks_by_calendar_token", {
    token,
  });

  if (error) {
    console.error("[calendar/feed]", error);
    return new Response("Invalid token or server error", { status: 403 });
  }

  if (!data || data.length === 0) {
    // Return empty but valid calendar
    const empty = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BrainDump//Tasks//EN",
      "CALSCALE:GREGORIAN",
      "X-WR-CALNAME:BrainDump Tasks",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
      "X-PUBLISHED-TTL:PT1H",
      "END:VCALENDAR",
    ].join("\r\n");

    return new Response(empty, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const events = data.map(
    (
      task: { Name: string; Description: string | null; due_date: string },
      i: number,
    ) => {
      const dateClean = task.due_date.split("T")[0].replace(/-/g, "");
      const desc = task.Description
        ? `\\n${escapeIcs(task.Description)}`
        : "";
      return [
        "BEGIN:VEVENT",
        `UID:braindump-${dateClean}-${i}-${token.slice(0, 8)}@braindump.app`,
        `DTSTAMP:${now}`,
        `DTSTART:${dateClean}T210000`,
        `DTEND:${dateClean}T235900`,
        `SUMMARY:${escapeIcs(task.Name)}`,
        `DESCRIPTION:BrainDump task${desc}`,
        "END:VEVENT",
      ].join("\r\n");
    },
  );

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BrainDump//Tasks//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:BrainDump Tasks",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
