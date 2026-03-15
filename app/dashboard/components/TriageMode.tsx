"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import type { Task } from "../page";
import { MicIcon } from "@/app/components/ui/mic";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";
import type { DragStartEvent, DragOverEvent, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { generateKeyBetween } from "fractional-indexing";

interface Props {
  tasks: Task[];
  updateTask: (id: string, updates: Partial<Task>) => void;
  addTasks: (tasks: Task[]) => Promise<void>;
  deleteTask: (id: string) => void;
  onOpenLetter: () => void;
}

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

function sortTasks<T extends { sort_order?: string | null; due_date?: string | null }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    // Primary: sort_order ascending, nulls last
    if (a.sort_order && b.sort_order) {
      return a.sort_order < b.sort_order ? -1 : a.sort_order > b.sort_order ? 1 : 0;
    }
    if (a.sort_order && !b.sort_order) return -1;
    if (!a.sort_order && b.sort_order) return 1;
    // Secondary: due_date ascending, nulls last
    return parseDateForSort(a.due_date) - parseDateForSort(b.due_date);
  });
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

// ── Custom date picker ──────────────────────────────────────────────
const PICKER_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const PICKER_MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

function DatePickerPopup({ value, onChange, onClose, anchorRef }: {
  value: string | undefined;
  onChange: (iso: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const initial = value ? new Date(value + "T00:00:00") : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const update = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.right - 260 });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchorRef]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const selectDay = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(iso);
  };

  const selectedKey = value?.slice(0, 10);
  const todayKey = today.toISOString().split("T")[0];

  if (!pos) return null;

  return (
    <>
      {/* Invisible backdrop to catch clicks outside */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <div
        className="fixed z-[9999] rounded-xl p-3 shadow-xl"
        style={{
          top: pos.top,
          left: pos.left,
          background: "#13161C",
          border: "1.5px solid #5DCAA5",
          width: 260,
          fontSize: "13px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Month/year nav */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={prevMonth}
            className="w-6 h-6 flex items-center justify-center rounded-md text-[#A0A8B8]/50 hover:text-[#5DCAA5] hover:bg-[#1D9E75]/10 transition-colors"
          >
            ‹
          </button>
          <span className="font-sans text-[13px] font-medium text-[#E8EAF0]">
            {PICKER_MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            className="w-6 h-6 flex items-center justify-center rounded-md text-[#A0A8B8]/50 hover:text-[#5DCAA5] hover:bg-[#1D9E75]/10 transition-colors"
          >
            ›
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {PICKER_DAYS.map((d) => (
            <div key={d} className="text-center font-sans text-[10px] font-medium tracking-wide uppercase text-[#A0A8B8]/35 py-0.5">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) return <div key={`e-${idx}`} className="h-8" />;

            const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isSelected = iso === selectedKey;
            const isToday = iso === todayKey;

            return (
              <button
                key={iso}
                onClick={() => selectDay(day)}
                className="h-8 w-full flex items-center justify-center rounded-lg font-sans text-[13px] transition-colors"
                style={{
                  color: isSelected ? "#0D0F14" : isToday ? "#5DCAA5" : "#E8EAF0",
                  background: isSelected ? "#5DCAA5" : "transparent",
                  fontWeight: isSelected || isToday ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "rgba(29,158,117,0.12)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Today shortcut */}
        <div className="mt-2 pt-2 flex justify-between items-center" style={{ borderTop: "1px solid rgba(29,158,117,0.12)" }}>
          <button
            onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); selectDay(today.getDate()); }}
            className="font-sans text-[11px] text-[#5DCAA5] hover:text-[#7DDBB8] transition-colors px-2 py-0.5 rounded hover:bg-[#1D9E75]/8"
          >
            Today
          </button>
          <button
            onClick={onClose}
            className="font-sans text-[11px] text-[#A0A8B8]/40 hover:text-[#A0A8B8] transition-colors px-2 py-0.5 rounded hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// ── Draggable task card ──────────────────────────────────────────────
function DraggableTaskCard({
  task,
  allowOverdue,
  isHighlighted,
  isDragActive,
  onMarkDone,
  onDateChange,
  calendarId,
  setCalendarId,
  dateButtonRefs,
}: {
  task: Task;
  allowOverdue?: boolean;
  isHighlighted: boolean;
  isDragActive: boolean;
  onMarkDone: (id: string) => void;
  onDateChange: (id: string, iso: string) => void;
  calendarId: string | null;
  setCalendarId: (id: string | null) => void;
  dateButtonRefs: React.RefObject<Map<string, HTMLButtonElement>>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const [isHovered, setIsHovered] = useState(false);
  const src = SOURCE_STYLE[task.source] ?? SOURCE_STYLE.typed;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 50 : undefined,
    cursor: isDragActive ? (isDragging ? "grabbing" : "grab") : "grab",
    borderColor: isHighlighted ? "#5DCAA5" : "rgba(29,158,117,0.08)",
    boxShadow: isHighlighted ? "0 0 0 1px #5DCAA540" : isDragging ? "0 8px 32px rgba(0,0,0,0.4)" : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative rounded-lg bg-[#13161C] border px-4 py-3.5 outline-none focus-visible:ring-1 focus-visible:ring-[#1D9E75]/50 select-none touch-none"
      style={style}
    >
      <div className="flex items-start gap-1 flex-wrap">
        <p className="font-sans text-sm text-[#E8EAF0] leading-snug flex-1">{task.text}</p>
        {task.due_date && (
          <DeadlineBadge due_date={task.due_date} allowOverdue={allowOverdue} />
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span
          className="text-[9px] font-sans font-medium px-1.5 py-0.5 rounded uppercase tracking-wider"
          style={{ color: src.color, backgroundColor: src.color + "18" }}
        >
          {src.label}
        </span>

        {isHovered && !isDragging && (
          <div
            className="flex items-center gap-1.5"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              ref={(el) => { if (el) dateButtonRefs.current.set(task.id, el); }}
              onClick={() => setCalendarId(calendarId === task.id ? null : task.id)}
              className="text-[10px] font-sans text-[#A0A8B8]/40 hover:text-[#5DCAA5] transition-colors px-1.5 py-0.5 rounded hover:bg-[#1D9E75]/8"
            >
              + date
            </button>
            {calendarId === task.id && (
              <DatePickerPopup
                value={task.due_date}
                onChange={(iso) => {
                  onDateChange(task.id, iso);
                  setCalendarId(null);
                }}
                onClose={() => setCalendarId(null)}
                anchorRef={{ current: dateButtonRefs.current.get(task.id) ?? null }}
              />
            )}
            <button
              onClick={() => onMarkDone(task.id)}
              className="text-[10px] font-sans text-[#A0A8B8]/40 hover:text-[#5DCAA5] transition-colors px-2 py-0.5 rounded hover:bg-[#1D9E75]/8"
            >
              Mark done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ghost card for drag overlay ─────────────────────────────────────
function TaskDragOverlay({ task }: { task: Task }) {
  const src = SOURCE_STYLE[task.source] ?? SOURCE_STYLE.typed;

  return (
    <div
      className="rounded-lg bg-[#13161C] border border-[#5DCAA5]/30 px-4 py-3.5 pointer-events-none"
      style={{
        boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(93,202,165,0.2)",
        transform: "scale(1.03) rotate(-1deg)",
        width: 320,
      }}
    >
      <div className="flex items-start gap-1 flex-wrap">
        <p className="font-sans text-sm text-[#E8EAF0] leading-snug flex-1">{task.text}</p>
        {task.due_date && <DeadlineBadge due_date={task.due_date} />}
      </div>
      <div className="mt-2.5">
        <span
          className="text-[9px] font-sans font-medium px-1.5 py-0.5 rounded uppercase tracking-wider"
          style={{ color: src.color, backgroundColor: src.color + "18" }}
        >
          {src.label}
        </span>
      </div>
    </div>
  );
}

// ── Droppable column ────────────────────────────────────────────────
type ColumnId = "now" | "later";

const COLUMN_CONFIG: Record<ColumnId, { label: string; color: string; dot: string }> = {
  now:   { label: "Do now",   color: "#1D9E75", dot: "bg-[#1D9E75]" },
  later: { label: "Do later", color: "#EF9F27", dot: "bg-[#EF9F27]" },
};

function DroppableColumn({
  id,
  tasks,
  subtitle,
  emptyText,
  allowOverdue,
  isOver,
  isDragActive,
  highlightColor,
  showWarning,
  highlightedIds,
  onMarkDone,
  onDateChange,
  calendarId,
  setCalendarId,
  dateButtonRefs,
}: {
  id: ColumnId;
  tasks: Task[];
  subtitle: string;
  emptyText: string;
  allowOverdue?: boolean;
  isOver: boolean;
  isDragActive: boolean;
  highlightColor: "green" | "red";
  showWarning: boolean;
  highlightedIds: Set<string>;
  onMarkDone: (id: string) => void;
  onDateChange: (id: string, iso: string) => void;
  calendarId: string | null;
  setCalendarId: (id: string | null) => void;
  dateButtonRefs: React.RefObject<Map<string, HTMLButtonElement>>;
}) {
  const { setNodeRef } = useDroppable({ id });
  const config = COLUMN_CONFIG[id];

  const overlayBg =
    highlightColor === "red"
      ? "rgba(239, 68, 68, 0.5)"
      : "rgba(29, 158, 117, 0.5)";

  return (
    <div
      ref={setNodeRef}
      className="relative rounded-xl p-3 transition-all duration-200"
      style={{
        background: isOver ? overlayBg : "transparent",
        outline: isOver
          ? `2px solid ${highlightColor === "red" ? "rgba(239,68,68,0.6)" : "rgba(29,158,117,0.6)"}`
          : "2px solid transparent",
        outlineOffset: -2,
        minHeight: 160,
      }}
    >
      {/* Drop warning */}
      {isOver && showWarning && (
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap font-sans text-[11px] font-semibold tracking-wide px-3 py-1.5 rounded-lg z-10"
          style={{
            background: "rgba(239,68,68,0.85)",
            color: "#fff",
            boxShadow: "0 4px 16px rgba(239,68,68,0.3)",
            animation: "fadeSlideUp 150ms ease-out",
          }}
        >
          {id === "now" ? "Focus list is full — finish one first" : "Procrastination, really?"}
        </div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        <span
          className="font-sans text-[11px] font-semibold tracking-widest uppercase"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
        <span className="ml-auto font-sans text-xs text-[#A0A8B8]/30">{tasks.length}</span>
      </div>
      <p className="font-sans text-[11px] text-[#A0A8B8]/40 mb-3">{subtitle}</p>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 min-h-[80px]">
          {tasks.length === 0 ? (
            <p className="py-8 text-center font-sans text-xs text-[#A0A8B8]/20 italic">{emptyText}</p>
          ) : (
            tasks.map((t) => (
              <DraggableTaskCard
                key={t.id}
                task={t}
                allowOverdue={allowOverdue}
                isHighlighted={highlightedIds.has(t.id)}
                isDragActive={isDragActive}
                onMarkDone={onMarkDone}
                onDateChange={onDateChange}
                calendarId={calendarId}
                setCalendarId={setCalendarId}
                dateButtonRefs={dateButtonRefs}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ── Upcoming task card (read-only, clickable) ───────────────────────
function UpcomingTaskCard({
  task,
  onPromote,
}: {
  task: Task;
  onPromote: (id: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const src = SOURCE_STYLE[task.source] ?? SOURCE_STYLE.typed;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onPromote(task.id)}
      className="relative rounded-lg border px-4 py-3.5 cursor-pointer transition-all duration-150"
      style={{
        background: isHovered ? "rgba(93,202,165,0.06)" : "#13161C",
        borderColor: isHovered ? "rgba(93,202,165,0.25)" : "rgba(29,158,117,0.08)",
        boxShadow: isHovered ? "0 0 0 1px rgba(93,202,165,0.15)" : undefined,
      }}
    >
      <div className="flex items-start gap-1 flex-wrap">
        <p className="font-sans text-sm text-[#E8EAF0]/70 leading-snug flex-1">{task.text}</p>
        {task.due_date && <DeadlineBadge due_date={task.due_date} />}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span
          className="text-[9px] font-sans font-medium px-1.5 py-0.5 rounded uppercase tracking-wider"
          style={{ color: src.color, backgroundColor: src.color + "18" }}
        >
          {src.label}
        </span>

        {isHovered && (
          <span className="text-[10px] font-sans text-[#5DCAA5] font-medium animate-pulse">
            Click to prioritize ↑
          </span>
        )}
      </div>
    </div>
  );
}

// ── Upcoming column (display-only, not droppable) ───────────────────
function UpcomingColumn({
  tasks,
  onPromote,
}: {
  tasks: Task[];
  onPromote: (id: string) => void;
}) {
  return (
    <div
      className="relative rounded-xl p-3"
      style={{ minHeight: 160 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#7C8DA6]" />
        <span
          className="font-sans text-[11px] font-semibold tracking-widest uppercase"
          style={{ color: "#7C8DA6" }}
        >
          Upcoming
        </span>
        <span className="ml-auto font-sans text-xs text-[#A0A8B8]/30">{tasks.length}</span>
      </div>
      <p className="font-sans text-[11px] text-[#A0A8B8]/40 mb-3">Due within 2 days · click to prioritize</p>
      <div className="flex flex-col gap-2 min-h-[80px]">
        {tasks.length === 0 ? (
          <p className="py-8 text-center font-sans text-xs text-[#A0A8B8]/20 italic">Nothing coming up soon.</p>
        ) : (
          tasks.map((t) => (
            <UpcomingTaskCard key={t.id} task={t} onPromote={onPromote} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────
export default function TriageMode({ tasks, updateTask, addTasks, deleteTask, onOpenLetter }: Props) {
  const [exitingIds, setExitingIds]         = useState<Set<string>>(new Set());
  const [calendarId, setCalendarId]         = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const dateButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // ── Drag state ──────────────────────────────────────────────────
  const [activeTask, setActiveTask]     = useState<Task | null>(null);
  const [overColumnId, setOverColumnId] = useState<ColumnId | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const visibleTasks = tasks.filter((t) => t.status !== "done");

  // ── Derived task lists (must be above early return so useEffect always runs) ──
  const DO_NOW_CAP = 3;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoDaysOut = new Date(today);
  twoDaysOut.setDate(twoDaysOut.getDate() + 2);

  // Treat old "drop" category tasks as "later" since we removed the Drop column
  const nowTasks   = sortTasks(visibleTasks.filter((t) => t.category === "now"));
  const laterTasks = sortTasks(visibleTasks.filter((t) => t.category === "later" || t.category === "drop"));

  // Upcoming: copies of tasks (from any column) due within 2 days
  const upcomingTasks = sortTasks(
    visibleTasks.filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date + "T00:00:00");
      return d.getTime() >= today.getTime() && d.getTime() < twoDaysOut.getTime();
    })
  );

  // ── Auto-promote: keep "Do now" filled up to DO_NOW_CAP ──────────
  // When "Do now" drops below the cap and "Do later" has tasks, move
  // the top "Do later" task to the bottom of "Do now".
  useEffect(() => {
    if (nowTasks.length < DO_NOW_CAP && laterTasks.length > 0) {
      const topLater = laterTasks[0];
      const lastNow = nowTasks[nowTasks.length - 1];
      const bottomKey = generateKeyBetween(lastNow?.sort_order ?? null, null);
      updateTask(topLater.id, { category: "now", sort_order: bottomKey });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTasks.length, laterTasks.length]);

  // ── Empty state (after all hooks) ─────────────────────────────────
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

  // ── Which column does a task currently appear in? ─────────────────
  const getDisplayColumn = (taskId: string): ColumnId | null => {
    if (nowTasks.some((t) => t.id === taskId)) return "now";
    if (laterTasks.some((t) => t.id === taskId)) return "later";
    return null;
  };

  // ── Promote an upcoming task to top of "Do later" ─────────────────
  const promoteToLaterTop = (taskId: string) => {
    const firstLater = laterTasks[0];
    const topKey = generateKeyBetween(null, firstLater?.sort_order ?? null);
    const task = visibleTasks.find((t) => t.id === taskId);
    if (!task) return;
    const updates: Partial<Task> = { sort_order: topKey };
    if (task.category !== "later") {
      updates.category = "later";
    }
    updateTask(taskId, updates);
  };

  // ── Drag handlers ─────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const task = (event.active.data.current as { task: Task } | undefined)?.task ?? null;
    setActiveTask(task);
  };

  // Map of column ID → sorted task list for sort_order computation
  const columnTaskMap: Record<ColumnId, Task[]> = { now: nowTasks, later: laterTasks };
  const columnIds = new Set<string>(["now", "later"]);

  const resolveOverColumn = (overId: string): ColumnId | null => {
    if (columnIds.has(overId)) return overId as ColumnId;
    // overId is a task ID — find which column it's in
    return getDisplayColumn(overId);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string | undefined;
    if (!overId) { setOverColumnId(null); return; }
    setOverColumnId(resolveOverColumn(overId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const overId = event.over?.id as string | undefined;
    if (!activeTask || !overId) {
      setActiveTask(null);
      setOverColumnId(null);
      return;
    }

    const currentCol = getDisplayColumn(activeTask.id);
    const targetCol = resolveOverColumn(overId);
    if (!currentCol || !targetCol) {
      setActiveTask(null);
      setOverColumnId(null);
      return;
    }

    // When dropping into "Do now" at capacity, demote the bottom "now" task to top of "later"
    if (targetCol === "now" && currentCol !== "now" && nowTasks.length >= DO_NOW_CAP) {
      const bottomNow = nowTasks[nowTasks.length - 1];
      const firstLater = laterTasks[0];
      const topLaterKey = generateKeyBetween(null, firstLater?.sort_order ?? null);
      updateTask(bottomNow.id, { category: "later", sort_order: topLaterKey });
    }

    const targetList = columnTaskMap[targetCol];
    const updates: Partial<Task> = {};

    // Determine category change
    if (targetCol !== currentCol) {
      updates.category = targetCol;
    }

    // Compute new sort_order based on drop position
    if (columnIds.has(overId)) {
      // Dropped on empty column area — append to end
      const lastTask = targetList[targetList.length - 1];
      updates.sort_order = generateKeyBetween(lastTask?.sort_order ?? null, null);
    } else {
      // Dropped on/near a specific task — insert at that position
      const overIndex = targetList.findIndex((t) => t.id === overId);
      if (overIndex >= 0) {
        const activeIndex = targetList.findIndex((t) => t.id === activeTask.id);
        const isDraggingDown = currentCol === targetCol && activeIndex >= 0 && activeIndex < overIndex;

        const filtered = targetList.filter((t) => t.id !== activeTask.id);
        const filteredOverIndex = filtered.findIndex((t) => t.id === overId);

        let prevKey: string | null;
        let nextKey: string | null;

        if (isDraggingDown) {
          // Insert AFTER the over task
          prevKey = filtered[filteredOverIndex]?.sort_order ?? null;
          nextKey = filteredOverIndex + 1 < filtered.length ? filtered[filteredOverIndex + 1].sort_order ?? null : null;
        } else {
          // Insert BEFORE the over task (correct for upward drags and cross-column)
          prevKey = filteredOverIndex > 0 ? filtered[filteredOverIndex - 1].sort_order ?? null : null;
          nextKey = filtered[filteredOverIndex]?.sort_order ?? null;
        }

        updates.sort_order = generateKeyBetween(prevKey, nextKey);
      }
    }

    if (Object.keys(updates).length > 0) {
      updateTask(activeTask.id, updates);
    }

    setActiveTask(null);
    setOverColumnId(null);
  };

  const handleDragCancel = () => {
    setActiveTask(null);
    setOverColumnId(null);
  };

  // ── Column highlight logic ────────────────────────────────────────
  const getColumnHighlight = (colId: ColumnId) => {
    if (!activeTask || overColumnId !== colId) return { isOver: false, highlightColor: "green" as const, showWarning: false };

    const currentCol = getDisplayColumn(activeTask.id);
    if (colId === currentCol) return { isOver: false, highlightColor: "green" as const, showWarning: false };

    return { isOver: true, highlightColor: "green" as const, showWarning: false };
  };

  return (
    <div className="p-6 sm:p-8">
      {/* Header row */}
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-[#E8EAF0]">Triage</h2>
          <p className="mt-1 font-sans text-xs text-[#A0A8B8]/50">
            Drag to reorder or move between columns · hover to mark done
          </p>
        </div>

        {/* Advisor mic */}
        <AdvisorMicWrapper
          tasks={tasks}
          setHighlightedIds={setHighlightedIds}
          updateTask={updateTask}
          addTasks={addTasks}
          deleteTask={deleteTask}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <DroppableColumn
            id="now"
            tasks={nowTasks}
            subtitle={`${nowTasks.length} task${nowTasks.length !== 1 ? "s" : ""} to focus on`}
            emptyText="All clear here."
            allowOverdue
            {...getColumnHighlight("now")}
            isDragActive={activeTask != null}
            highlightedIds={highlightedIds}
            onMarkDone={markDone}
            onDateChange={(id, iso) => updateTask(id, { due_date: iso })}
            calendarId={calendarId}
            setCalendarId={setCalendarId}
            dateButtonRefs={dateButtonRefs}
          />

          <DroppableColumn
            id="later"
            tasks={laterTasks}
            subtitle={`${laterTasks.length} upcoming${laterTasks.length === 10 ? " (top 10)" : ""}`}
            emptyText="Nothing pending."
            {...getColumnHighlight("later")}
            isDragActive={activeTask != null}
            highlightedIds={highlightedIds}
            onMarkDone={markDone}
            onDateChange={(id, iso) => updateTask(id, { due_date: iso })}
            calendarId={calendarId}
            setCalendarId={setCalendarId}
            dateButtonRefs={dateButtonRefs}
          />

          <UpcomingColumn
            tasks={upcomingTasks}
            onPromote={promoteToLaterTop}
          />
        </div>

        <DragOverlay dropAnimation={{
          duration: 200,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
        }}>
          {activeTask ? <TaskDragOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {tasks.length > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={onOpenLetter}
            className="inline-flex items-center gap-2 font-sans text-sm transition-colors duration-150"
            style={{ color: '#5DCAA5' }}
            onMouseEnter={e =>
              ((e.currentTarget as HTMLElement).style.color = '#7DDBB8')
            }
            onMouseLeave={e =>
              ((e.currentTarget as HTMLElement).style.color = '#5DCAA5')
            }
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.5 5.5A1.5 1.5 0 0 1 4 4h12a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5v-9ZM2.5 7l7.5 5 7.5-5"
              />
            </svg>
            Read your mind letter
          </button>
        </div>
      )}
    </div>
  );
}

// ── Advisor mic wrapper ─────────────────────────────────────────────
function AdvisorMicWrapper({
  tasks,
  setHighlightedIds,
  updateTask,
  addTasks,
  deleteTask,
}: {
  tasks: Task[];
  setHighlightedIds: (ids: Set<string>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  addTasks: (tasks: Task[]) => Promise<void>;
  deleteTask: (id: string) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [summary, setSummary]         = useState<string | null>(null);
  const [isMicHovered, setIsMicHovered] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  // Use minimal interface instead of SpeechRecognition to avoid build-time DOM type issues
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const transcriptRef  = useRef<string>("");
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const shiftRecordingRef = useRef(false);

  const stopPlayback = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  // ── Right Shift keyboard shortcut ─────────────────────────────────
  const startRecordingRef = useRef<() => void>(() => {});
  const stopRecordingRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "ShiftRight" && !e.repeat && !shiftRecordingRef.current) {
        shiftRecordingRef.current = true;
        startRecordingRef.current();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ShiftRight" && shiftRecordingRef.current) {
        shiftRecordingRef.current = false;
        stopRecordingRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const sendToAdvisor = async (userMessage: string) => {
    setIsLoading(true);
    try {
      const advisorRes = await fetch("/api/ai/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage,
          conversationHistory,
          tasks: tasks.map((t) => ({
            name: t.text,
            description: null,
            created_at: null,
            due_date: t.due_date ?? null,
            completed: t.status === "done",
          })),
          currentTime: new Date().toISOString(),
        }),
      });

      console.log("[advisor] fetch status →", advisorRes.status);
      if (!advisorRes.ok) {
        const errText = await advisorRes.text();
        console.error("[advisor] error body →", errText);
        throw new Error(`Advisor ${advisorRes.status}`);
      }
      const advisor = await advisorRes.json();
      console.log("[advisor] response →", JSON.stringify(advisor));

      setConversationHistory((prev) => [
        ...prev,
        { role: "user", content: userMessage },
        { role: "assistant", content: advisor.reply },
      ]);

      setSummary(advisor.displaySummary ?? null);

      // ── Execute actions if AI is confident ──────────────────────────
      const actions = advisor.actions ?? [];
      if (!advisor.needsConfirmation && actions.length > 0) {
        console.log("[advisor] executing actions →", JSON.stringify(actions));
        const tasksToAdd: Task[] = [];

        for (const action of actions) {
          if (action.type === "add") {
            tasksToAdd.push({
              id: crypto.randomUUID(),
              text: action.taskName,
              category: "later",
              status: "pending",
              source: "voice",
              due_date: action.dueDate ?? undefined,
            });
          } else if (action.type === "complete") {
            const match = tasks.find((t) => t.text.toLowerCase() === action.taskName.toLowerCase() && t.status !== "done");
            if (match) updateTask(match.id, { status: "done" });
            else console.warn("[advisor] no match for complete:", action.taskName);
          } else if (action.type === "reschedule") {
            const match = tasks.find((t) => t.text.toLowerCase() === action.taskName.toLowerCase() && t.status !== "done");
            if (match && action.dueDate) updateTask(match.id, { due_date: action.dueDate });
            else console.warn("[advisor] no match for reschedule:", action.taskName);
          } else if (action.type === "delete") {
            const match = tasks.find((t) => t.text.toLowerCase() === action.taskName.toLowerCase());
            if (match) deleteTask(match.id);
            else console.warn("[advisor] no match for delete:", action.taskName);
          }
        }

        if (tasksToAdd.length > 0) await addTasks(tasksToAdd);
      }

      const names = new Set<string>(advisor.referencedTaskNames ?? []);
      const ids = new Set(tasks.filter((t) => names.has(t.text)).map((t) => t.id));
      setHighlightedIds(ids);
      setTimeout(() => setHighlightedIds(new Set()), 6000);

      console.log("[tts] calling /api/tts with text →", advisor.reply?.slice(0, 60));
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: advisor.reply, voiceId: "calm" }),
      });
      console.log("[tts] fetch status →", ttsRes.status);
      if (!ttsRes.ok) {
        const errText = await ttsRes.text();
        console.error("[tts] error body →", errText);
        throw new Error(`TTS ${ttsRes.status}`);
      }
      const ttsData = await ttsRes.json();

      console.log("[tts playback] audioBase64 length →", ttsData.audioBase64?.length ?? 0);
      if (!ttsData.audioBase64) throw new Error("TTS returned no audio data");

      const bytes = atob(ttsData.audioBase64);
      const buf = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;
      setIsPlaying(true);
      audio.onerror = (e) => console.error("[tts playback] audio error →", e);
      audio.onended = () => { setIsPlaying(false); URL.revokeObjectURL(url); };
      await audio.play().catch((e) => {
        console.error("[tts playback] play() rejected →", e);
        setIsPlaying(false);
      });
    } catch (err) {
      console.error("[AdvisorMic]", err);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = () => {
    if (isPlaying) { stopPlayback(); return; }

    const win = window as unknown as Record<string, unknown>;
    const SR = (win.SpeechRecognition ?? win.webkitSpeechRecognition) as (new () => {
      continuous: boolean;
      interimResults: boolean;
      onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
      start: () => void;
      stop: () => void;
    }) | undefined;

    if (!SR) { alert("Speech recognition not supported in this browser."); return; }

    transcriptRef.current = "";
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      transcriptRef.current = Array.from({ length: Object.keys(e.results).length }, (_, i) => e.results[i][0].transcript).join(" ");
    };
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  };

  const stopRecording = async () => {
    if (!recognitionRef.current) return;
    setIsRecording(false);
    setIsLoading(true); // show thinking spinner during buffer

    // Keep recognition alive for 2s to capture trailing speech
    await new Promise((r) => setTimeout(r, 2000));
    recognitionRef.current?.stop();
    // Small grace period for final onresult event
    await new Promise((r) => setTimeout(r, 200));

    const text = transcriptRef.current.trim();
    transcriptRef.current = "";
    console.log("[stt] transcript →", text || "(empty)");
    if (text) {
      await sendToAdvisor(text);
    } else {
      setIsLoading(false); // reset if nothing captured
    }
  };

  // Keep refs in sync so the keyboard listener calls current versions
  startRecordingRef.current = startRecording;
  stopRecordingRef.current = stopRecording;

  const micState = isPlaying ? "playing" : isLoading ? "loading" : isRecording ? "recording" : "idle";
  const micColor = { idle: "#A0A8B8", recording: "#EF4444", loading: "#EF9F27", playing: "#1D9E75" }[micState];
  const micLabel = { idle: "Hold to ask", recording: "Release…", loading: "Thinking…", playing: "Tap to stop" }[micState];

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      {summary && (
        <p className="font-sans text-[10px] text-[#A0A8B8]/50 max-w-[160px] text-right leading-tight">
          {summary}
        </p>
      )}

      <div className="relative">
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
          onClick={isPlaying ? stopPlayback : undefined}
          onMouseEnter={() => setIsMicHovered(true)}
          onMouseLeave={() => setIsMicHovered(false)}
          disabled={isLoading}
          aria-label={micLabel}
          style={{ borderColor: micColor, color: micColor }}
          className="relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-200 hover:opacity-80 disabled:opacity-40 select-none"
        >
          {isRecording && (
            <span className="absolute inset-0 rounded-full animate-ping opacity-25" style={{ backgroundColor: micColor }} />
          )}
          {micState === "loading" ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
              </svg>
          ) : micState === "playing" ? (
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <rect x="4" y="4" width="12" height="12" rx="1" />
            </svg>
          ) : (
            <MicIcon/>
          )}
        </button>

        {/* Keyboard shortcut tooltip */}
        {isMicHovered && micState === "idle" && (
          <div
            className="absolute right-12 top-1/2 -translate-y-1/2 whitespace-nowrap font-sans text-[10px] text-[#A0A8B8]/60 flex items-center gap-1.5 pointer-events-none"
            style={{ animation: "fadeSlideUp 120ms ease-out" }}
          >
            <span>or hold</span>
            <kbd className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium tracking-wide"
              style={{
                background: "rgba(160,168,184,0.08)",
                border: "1px solid rgba(160,168,184,0.15)",
                color: "#A0A8B8",
              }}
            >
              R Shift
            </kbd>
          </div>
        )}
      </div>

      <span className="font-sans text-[9px]" style={{ color: micColor }}>{micLabel}</span>
    </div>
  );
}
