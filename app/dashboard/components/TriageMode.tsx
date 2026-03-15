"use client";

import { useState } from "react";
import type { Task } from "../page";

interface Props {
  tasks: Task[];
  updateTask: (id: string, updates: Partial<Task>) => void;
}

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

// ── Sort utilities ────────────────────────────────────────────────────
function parseDateForSort(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? Infinity : d.getTime();
}

function sortByDueDate<T extends { due_date?: string | null }>(tasks: T[]): T[] {
  return [...tasks].sort(
    (a, b) => parseDateForSort(a.due_date) - parseDateForSort(b.due_date)
  );
}

// ── Deadline badge ────────────────────────────────────────────────────
function DeadlineBadge({ due_date, allowOverdue }: { due_date: string; allowOverdue?: boolean }) {
  const due = new Date(due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const label =
    diffDays === 0 ? "Today"
    : diffDays === 1 ? "Tomorrow"
    : allowOverdue && diffDays < 0 ? `${Math.abs(diffDays)}d overdue`
    : `${diffDays}d`;

  const color =
    allowOverdue && diffDays <= 0
      ? "bg-[#FAECE7] text-[#D85A30]"
      : diffDays <= 1
      ? "bg-[#FAEEDA] text-[#854F0B]"
      : "bg-[#E1F5EE] text-[#085041]";

  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ml-2 ${color}`}>
      {label}
    </span>
  );
}

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

  // ── Derived task lists ────────────────────────────────────────────
  const allNowSorted   = sortByDueDate(visibleTasks.filter((t) => t.category === "now"));
  const allLaterSorted = sortByDueDate(visibleTasks.filter((t) => t.category === "later"));

  const nowTasks    = allNowSorted.slice(0, 3);
  const nowOverflow = allNowSorted.slice(3);
  const laterTasks  = [...nowOverflow, ...allLaterSorted].slice(0, 10);
  const dropTasks   = visibleTasks.filter((t) => t.category === "drop");

  // ── Task card renderer ────────────────────────────────────────────
  const renderTask = (task: Task, allowOverdue = false) => {
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
          <div className="flex items-start gap-1 flex-wrap">
            <p className="font-sans text-sm text-[#E8EAF0] leading-snug flex-1">{task.text}</p>
            {task.due_date && (
              <DeadlineBadge due_date={task.due_date} allowOverdue={allowOverdue} />
            )}
          </div>

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
        </div>
      </div>
    );
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

        {/* ── Do now ───────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]" />
            <span className="font-sans text-[11px] font-semibold tracking-widest uppercase text-[#1D9E75]">
              Do now
            </span>
            <span className="ml-auto font-sans text-xs text-[#A0A8B8]/30">{nowTasks.length}</span>
          </div>
          <p className="font-sans text-[11px] text-[#A0A8B8]/40 mb-3">
            {nowTasks.length} closest deadline{nowTasks.length !== 1 ? "s" : ""}
            {allNowSorted.length > 3 ? ` · ${allNowSorted.length - 3} more in Later` : ""}
          </p>
          <div className="flex flex-col gap-2 min-h-[80px]">
            {nowTasks.length === 0 ? (
              <p className="py-8 text-center font-sans text-xs text-[#A0A8B8]/20 italic">All clear here.</p>
            ) : (
              nowTasks.map((t) => renderTask(t, true))
            )}
          </div>
        </div>

        {/* ── Do later ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF9F27]" />
            <span className="font-sans text-[11px] font-semibold tracking-widest uppercase text-[#EF9F27]">
              Do later
            </span>
            <span className="ml-auto font-sans text-xs text-[#A0A8B8]/30">{laterTasks.length}</span>
          </div>
          <p className="font-sans text-[11px] text-[#A0A8B8]/40 mb-3">
            {laterTasks.length} upcoming{laterTasks.length === 10 ? " (top 10)" : ""}
          </p>
          <div className="flex flex-col gap-2 min-h-[80px]">
            {laterTasks.length === 0 ? (
              <p className="py-8 text-center font-sans text-xs text-[#A0A8B8]/20 italic">Nothing pending.</p>
            ) : (
              laterTasks.map((t) => renderTask(t, false))
            )}
          </div>
        </div>

        {/* ── Drop ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A0A8B8]" />
            <span className="font-sans text-[11px] font-semibold tracking-widest uppercase text-[#A0A8B8]">
              Drop
            </span>
            <span className="ml-auto font-sans text-xs text-[#A0A8B8]/30">{dropTasks.length}</span>
          </div>
          <p className="font-sans text-[11px] text-[#A0A8B8]/40 mb-3">&nbsp;</p>
          <div className="flex flex-col gap-2 min-h-[80px]">
            {dropTasks.length === 0 ? (
              <p className="py-8 text-center font-sans text-xs text-[#A0A8B8]/20 italic">Nothing to let go of yet.</p>
            ) : (
              dropTasks.map((t) => renderTask(t, false))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
