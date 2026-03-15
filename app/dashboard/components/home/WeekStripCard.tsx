"use client";

import { useMemo } from "react";
import type { Task } from "../../page";

interface Props {
  tasks: Task[];
  weekStart: Date;
  delay?: number;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const CATEGORY_COLOR: Record<string, string> = {
  now: "#1D9E75",
  later: "#EF9F27",
  drop: "#A0A8B8",
};

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function WeekStripCard({ tasks, weekStart, delay = 0 }: Props) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toISO(d);
  }, []);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return {
        name: DAY_NAMES[i],
        date: d.getDate(),
        iso: toISO(d),
        isToday: toISO(d) === today,
      };
    });
  }, [weekStart, today]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = t.due_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tasks]);

  return (
    <div
      className="rounded-2xl border border-[#1D9E75]/8 bg-[#13161C] p-5 sm:p-6 transition-all duration-300 hover:border-[#1D9E75]/20 hover:shadow-[0_0_20px_rgba(29,158,117,0.08)]"
      style={{ animation: `fadeSlideUp 600ms ease-out ${delay}ms both` }}
    >
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const dayTasks = tasksByDay.get(day.iso) ?? [];
          const pending = dayTasks.filter((t) => t.status !== "done");
          const done = dayTasks.filter((t) => t.status === "done");
          const shownPending = pending.slice(0, 3);
          const shownDone = done.slice(0, 2);

          return (
            <div
              key={day.iso}
              className={`flex flex-col items-center rounded-xl transition-colors min-h-[140px] py-3 px-1 ${
                day.isToday
                  ? "bg-[#1D9E75]/8 border border-[#1D9E75]/20"
                  : "hover:bg-[#0D0F14]/40"
              }`}
              style={{ animation: `slideInLeft 400ms ease-out ${delay + i * 60}ms both` }}
            >
              {/* Day name */}
              <span className={`font-sans text-[10px] sm:text-[11px] font-medium tracking-wide ${
                day.isToday ? "text-[#5DCAA5]" : "text-[#A0A8B8]/35"
              }`}>
                {day.name.slice(0, 3)}
              </span>

              {/* Date number */}
              <span className={`font-sans text-xl sm:text-2xl font-semibold mt-1 ${
                day.isToday ? "text-[#E8EAF0]" : "text-[#A0A8B8]/50"
              }`} style={{ fontVariantNumeric: "tabular-nums" }}>
                {day.date}
              </span>

              {day.isToday && (
                <span className="font-sans text-[8px] text-[#5DCAA5] font-medium">
                  Today
                </span>
              )}

              {/* Task list area */}
              <div className="flex flex-col items-center gap-1 mt-auto w-full pt-2">
                {/* Task dots */}
                <div className="flex flex-wrap justify-center gap-[3px]">
                  {shownPending.map((t) => (
                    <span
                      key={t.id}
                      className="w-[6px] h-[6px] rounded-full"
                      style={{ backgroundColor: CATEGORY_COLOR[t.category] ?? "#A0A8B8" }}
                      title={t.text}
                    />
                  ))}
                  {shownDone.map((t) => (
                    <span
                      key={t.id}
                      className="w-[6px] h-[6px] rounded-full opacity-40"
                      style={{ backgroundColor: "#A0A8B8" }}
                      title={`Done: ${t.text}`}
                    />
                  ))}
                </div>
                {/* Task name previews */}
                {shownPending.slice(0, 2).map((t) => (
                  <span
                    key={t.id}
                    className="font-sans text-[8px] sm:text-[9px] text-[#A0A8B8]/40 truncate w-full text-center leading-tight"
                    title={t.text}
                  >
                    {t.text}
                  </span>
                ))}
                {dayTasks.length > 5 && (
                  <span className="font-sans text-[7px] text-[#A0A8B8]/30">
                    +{dayTasks.length - 5}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
