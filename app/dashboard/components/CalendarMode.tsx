"use client";

import { useState, useMemo } from "react";
import type { Task } from "../page";

interface Props {
  tasks: Task[];
  updateTask: (id: string, updates: Partial<Task>) => void;
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Date parsing from task text ───────────────────────────────────────
function parseDueDate(text: string): string | undefined {
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
    if (d < today) { d.setMonth(d.getMonth() + 1); }
    return toISO(d);
  }

  return undefined;
}

const CATEGORY_COLOR: Record<Task["category"], string> = {
  now: "#1D9E75",
  later: "#EF9F27",
  drop: "#A0A8B8",
};

// ── Component ─────────────────────────────────────────────────────────
export default function CalendarMode({ tasks, updateTask }: Props) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [tooltipTaskId, setTooltipTaskId] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build cells array (nulls = empty padding, numbers = day-of-month)
  const cells = useMemo(() => {
    const arr: (number | null)[] = Array(firstDayIndex).fill(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [firstDayIndex, daysInMonth]);

  // Only show pending tasks; enrich with auto-parsed dates
  const enrichedTasks = useMemo(() =>
    tasks
      .filter((t) => t.status !== "done")
      .map((t) => ({
        ...t,
        due_date: t.due_date ?? parseDueDate(t.text),
      })),
    [tasks]
  );

  // Map ISO date string → tasks for that day
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    enrichedTasks.forEach((t) => {
      if (!t.due_date) return;
      const key = t.due_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [enrichedTasks]);

  const prevMonth = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const cellKey = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const isToday = (day: number) => {
    const t = today;
    return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day;
  };

  // Upcoming tasks (with dates, not done) for the list below the grid
  const upcomingTasks = useMemo(() =>
    enrichedTasks
      .filter((t) => t.due_date && t.status !== "done")
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
      .slice(0, 8),
    [enrichedTasks]
  );

  return (
    <div className="p-6 sm:p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h2 className="font-serif text-2xl text-[#E8EAF0]">Calendar</h2>
          <p className="mt-0.5 font-sans text-xs text-[#A0A8B8]/50">
            Dates parsed automatically from task text
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A0A8B8]/50 hover:text-[#E8EAF0] hover:bg-[#13161C] transition-colors"
          >
            ‹
          </button>
          <span className="font-sans text-sm font-medium text-[#E8EAF0] w-32 text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A0A8B8]/50 hover:text-[#E8EAF0] hover:bg-[#13161C] transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      {/* Day-name row */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center font-sans text-[10px] font-medium tracking-widest uppercase text-[#A0A8B8]/35 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-[#1D9E75]/6 rounded-xl overflow-hidden border border-[#1D9E75]/8">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="bg-[#0D0F14] h-16 sm:h-20" />;
          }
          const key = cellKey(day);
          const dayTasks = tasksByDate.get(key) ?? [];
          const today_ = isToday(day);

          return (
            <div
              key={key}
              className={`bg-[#0D0F14] h-16 sm:h-20 p-1.5 flex flex-col relative ${
                today_ ? "ring-1 ring-inset ring-[#1D9E75]/50" : ""
              }`}
            >
              {/* Day number */}
              <span
                className={`font-sans text-[11px] leading-none ${
                  today_ ? "text-[#5DCAA5] font-semibold" : "text-[#A0A8B8]/40"
                }`}
              >
                {day}
              </span>

              {/* Task dots */}
              <div className="flex flex-wrap gap-0.5 mt-1">
                {dayTasks.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    className="relative"
                    onMouseEnter={() => setTooltipTaskId(t.id)}
                    onMouseLeave={() => setTooltipTaskId(null)}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLOR[t.category] }}
                    />
                    {/* Tooltip */}
                    {tooltipTaskId === t.id && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 w-44 bg-[#13161C] border border-[#1D9E75]/25 rounded-lg px-2.5 py-2 shadow-lg pointer-events-none">
                        <p className="font-sans text-[11px] text-[#E8EAF0] leading-snug">
                          {t.text}
                        </p>
                        <div
                          className="mt-1 text-[9px] font-sans font-semibold uppercase tracking-wider"
                          style={{ color: CATEGORY_COLOR[t.category] }}
                        >
                          {t.category}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {dayTasks.length > 4 && (
                  <span className="font-sans text-[9px] text-[#A0A8B8]/40">+{dayTasks.length - 4}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming list */}
      {upcomingTasks.length > 0 && (
        <div className="mt-8">
          <p className="text-[10px] font-sans font-medium tracking-widest uppercase text-[#A0A8B8]/35 mb-3">
            Upcoming
          </p>
          <div className="flex flex-col gap-2">
            {upcomingTasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#13161C] border border-[#1D9E75]/8"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: CATEGORY_COLOR[t.category] }}
                />
                <span className="font-sans text-sm text-[#E8EAF0] leading-snug flex-1 truncate">
                  {t.text}
                </span>
                <span className="font-sans text-[11px] text-[#A0A8B8]/40 shrink-0 tabular-nums">
                  {t.due_date?.slice(5)}
                </span>
                {/* Editable date */}
                <input
                  type="date"
                  value={t.due_date ?? ""}
                  onChange={(e) => updateTask(t.id, { due_date: e.target.value })}
                  className="w-[1px] h-[1px] opacity-0 absolute"
                  aria-hidden
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {upcomingTasks.length === 0 && (
        <div className="mt-8 text-center">
          <p className="font-sans text-sm text-[#A0A8B8]/35 italic">
            No dated tasks yet. Add dates in Triage to see them here.
          </p>
        </div>
      )}
    </div>
  );
}
