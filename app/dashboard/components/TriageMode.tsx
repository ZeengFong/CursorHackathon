"use client";

import { useState } from "react";
import type { Task } from "../page";

interface Props {
  tasks: Task[];
  updateTask: (id: string, updates: Partial<Task>) => void;
}

const COLUMNS: {
  id: Task["category"];
  label: string;
  color: string;
  emptyText: string;
}[] = [
  { id: "now",   label: "Do now",   color: "#1D9E75", emptyText: "All clear here." },
  { id: "later", label: "Do later", color: "#EF9F27", emptyText: "Nothing pending." },
  { id: "drop",  label: "Drop",     color: "#A0A8B8", emptyText: "Nothing to let go of yet." },
];

const CYCLE: Record<Task["category"], Task["category"]> = {
  now: "later",
  later: "drop",
  drop: "now",
};

const SOURCE_STYLE: Record<string, { label: string; color: string }> = {
  voice: { label: "voice", color: "#5DCAA5" },
  file:  { label: "file",  color: "#EF9F27" },
  typed: { label: "typed", color: "#A0A8B8" },
};

export default function TriageMode({ tasks, updateTask }: Props) {
  const [hoveredId, setHoveredId]   = useState<string | null>(null);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [calendarId, setCalendarId] = useState<string | null>(null);

  const visibleTasks = tasks.filter((t) => t.status !== "done");

  if (visibleTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
        <p className="font-serif italic text-3xl text-[#5DCAA5]">You&apos;ve cleared everything.</p>
        <p className="mt-2 font-sans text-sm text-[#A0A8B8]/40">Rare.</p>
      </div>
    );
  }

  const markDone = (id: string) => {
    setExitingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      updateTask(id, { status: "done" });
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 280);
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-7">
        <h2 className="font-serif text-2xl text-[#E8EAF0]">Triage</h2>
        <p className="mt-1 font-sans text-xs text-[#A0A8B8]/50">
          Click a card to cycle it · hover to mark done
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {COLUMNS.map((col) => {
          const colTasks = visibleTasks.filter((t) => t.category === col.id);

          return (
            <div key={col.id}>
              {/* Column header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                <span
                  className="font-sans text-[11px] font-semibold tracking-widest uppercase"
                  style={{ color: col.color }}
                >
                  {col.label}
                </span>
                <span className="ml-auto font-sans text-xs text-[#A0A8B8]/30">{colTasks.length}</span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 min-h-[80px]">
                {colTasks.length === 0 ? (
                  <p className="py-8 text-center font-sans text-xs text-[#A0A8B8]/20 italic">
                    {col.emptyText}
                  </p>
                ) : (
                  colTasks.map((task) => {
                    const isExiting = exitingIds.has(task.id);
                    const src = SOURCE_STYLE[task.source] ?? SOURCE_STYLE.typed;

                    return (
                      <div
                        key={task.id}
                        style={{
                          maxHeight: isExiting ? "0px" : "200px",
                          opacity: isExiting ? 0 : 1,
                          overflow: "hidden",
                          transition: "max-height 280ms ease, opacity 200ms ease",
                          marginBottom: isExiting ? 0 : undefined,
                        }}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => updateTask(task.id, { category: CYCLE[task.category] })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ")
                              updateTask(task.id, { category: CYCLE[task.category] });
                          }}
                          onMouseEnter={() => setHoveredId(task.id)}
                          onMouseLeave={() => { setHoveredId(null); setCalendarId(null); }}
                          className="relative cursor-pointer rounded-lg bg-[#13161C] border border-[#1D9E75]/8 hover:border-[#1D9E75]/20 px-4 py-3.5 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#1D9E75]/50"
                        >
                          <p className="font-sans text-sm text-[#E8EAF0] leading-snug">{task.text}</p>

                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            {/* Source badge */}
                            <span
                              className="text-[9px] font-sans font-medium px-1.5 py-0.5 rounded uppercase tracking-wider"
                              style={{ color: src.color, backgroundColor: src.color + "18" }}
                            >
                              {src.label}
                            </span>

                            {hoveredId === task.id && (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {/* Add to calendar */}
                                <div className="relative">
                                  <button
                                    onClick={() => setCalendarId(calendarId === task.id ? null : task.id)}
                                    className="text-[10px] font-sans text-[#A0A8B8]/40 hover:text-[#5DCAA5] transition-colors px-1.5 py-0.5 rounded hover:bg-[#1D9E75]/8"
                                  >
                                    + date
                                  </button>
                                  {calendarId === task.id && (
                                    <input
                                      type="date"
                                      value={task.due_date ?? ""}
                                      onChange={(e) => {
                                        updateTask(task.id, { due_date: e.target.value });
                                        setCalendarId(null);
                                      }}
                                      className="absolute bottom-full right-0 mb-1 bg-[#13161C] border border-[#1D9E75]/30 text-[#E8EAF0] font-sans text-xs rounded-lg px-2 py-1 outline-none z-10"
                                    />
                                  )}
                                </div>

                                <button
                                  onClick={() => markDone(task.id)}
                                  className="text-[10px] font-sans text-[#A0A8B8]/40 hover:text-[#5DCAA5] transition-colors px-2 py-0.5 rounded hover:bg-[#1D9E75]/8"
                                >
                                  Mark done
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Due date chip */}
                          {task.due_date && (
                            <p className="mt-1 font-sans text-[9px] text-[#A0A8B8]/35 tabular-nums">
                              due {task.due_date.slice(5)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
