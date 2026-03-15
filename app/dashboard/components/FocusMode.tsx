"use client";

import { useState, useEffect, useMemo } from "react";
import type { Task } from "../page";
import { sortTasks } from "@/lib/sort-tasks";

interface Props {
  tasks: Task[];
}

const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Cache steps per task ID so re-mounting the component doesn't re-fetch
const stepsCache = new Map<string, string[]>();

function SkeletonSteps() {
  return (
    <div className="flex flex-col gap-1.5">
      {[80, 65, 72, 58, 68].map((w, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#13161C]"
          style={{ animation: `fadeSlideUp 500ms ease-out ${i * 60}ms both` }}
        >
          <div className="w-4 h-4 shrink-0 rounded border-2 border-[#A0A8B8]/10 bg-[#0D0F14]" />
          <div
            className="h-3 rounded-full bg-[#A0A8B8]/8 animate-pulse"
            style={{ width: `${w}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export default function FocusMode({ tasks }: Props) {
  const nowTasks = useMemo(
    () => sortTasks(tasks.filter((t) => t.category === "now" && t.status !== "done")),
    [tasks]
  );

  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
  const [steps, setSteps] = useState<string[] | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  // Timer state
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [timerStarted, setTimerStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(5 * 60);
  const [sessionCount, setSessionCount] = useState(0);

  // Derived active task — falls back to first task if index is out of range
  const activeTask = nowTasks[selectedTaskIndex] ?? nowTasks[0] ?? null;

  useEffect(() => {
    if (!activeTask) return;
    setChecked(new Set());

    const cached = stepsCache.get(activeTask.id);
    if (cached) {
      setSteps(cached);
      return;
    }

    setSteps(null);
    fetch("/api/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: activeTask.text, description: activeTask.description }),
    })
      .then((r) => r.json())
      .then((data) => {
        const result =
          Array.isArray(data.steps) && data.steps.length > 0
            ? data.steps
            : [];
        stepsCache.set(activeTask.id, result);
        setSteps(result);
      })
      .catch(() => {
        stepsCache.set(activeTask.id, []);
        setSteps([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTask?.id]);

  // Timer countdown
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (isBreak) {
        setBreakTimeLeft((prev) => {
          if (prev <= 1) {
            setIsBreak(false);
            setSessionCount((c) => c + 1);
            setTimeLeft(selectedMinutes > 60 ? 30 * 60 : selectedMinutes * 60);
            return 5 * 60;
          }
          return prev - 1;
        });
      } else {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (selectedMinutes > 60) {
              setIsBreak(true);
              setIsRunning(false);
              return 0;
            } else {
              setIsRunning(false);
              setTimerStarted(false);
              setSessionCount(0);
              return 0;
            }
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isBreak, selectedMinutes]);

  const handleStartPause = () => {
    if (!timerStarted) {
      setTimerStarted(true);
      setTimeLeft(selectedMinutes * 60);
    }
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimerStarted(false);
    setIsBreak(false);
    setBreakTimeLeft(5 * 60);
    setSessionCount(0);
    setTimeLeft(selectedMinutes * 60);
    setSelectedTaskIndex(0);
  };

  const toggleStep = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  // Timer display
  const displaySeconds = isBreak ? breakTimeLeft : timeLeft;
  const displayMins = Math.floor(displaySeconds / 60);
  const displaySecs = displaySeconds % 60;

  // Ring progress
  const totalSeconds = isBreak
    ? 5 * 60
    : selectedMinutes > 60
    ? 30 * 60
    : selectedMinutes * 60;
  const progress = isBreak
    ? (5 * 60 - breakTimeLeft) / (5 * 60)
    : 1 - timeLeft / totalSeconds;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const timerColor = isBreak ? "#EF9F27" : timeLeft === 0 ? "#D85A30" : "#1D9E75";

  if (!activeTask) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
        <p className="font-serif italic text-3xl text-[#5DCAA5]">
          Nothing to focus on.
        </p>
        <p className="mt-2 font-sans text-sm text-[#A0A8B8]/40">
          Move something into Do Now first.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 sm:pl-10 sm:pr-20 max-w-2xl mx-auto" style={{ animation: "fadeSlideUp 600ms ease-out both" }}>
      {/* Active task */}
      <div className="mb-10" style={{ animation: "fadeSlideUp 600ms ease-out both" }}>
        <p className="text-[10px] font-sans font-medium tracking-widest uppercase text-[#1D9E75] mb-3">
          In focus
        </p>
        <h2 className="font-serif text-3xl sm:text-4xl lg:text-[2.5rem] text-[#E8EAF0] leading-snug">
          {activeTask.text}
        </h2>
      </div>

      {/* Pomodoro */}
      <div className="flex flex-col items-center mb-10" style={{ animation: "fadeSlideUp 600ms ease-out 100ms both" }}>

        {/* Pre-timer controls — hidden once timer starts */}
        {!timerStarted && (
          <div className="flex flex-col items-center gap-3 mb-6 w-full">

            {/* Task selector — only when there are multiple now tasks */}
            {nowTasks.length > 1 && (
              <div className="flex flex-col items-center gap-3 mb-5 w-full">
                <p className="font-sans text-[10px] uppercase tracking-widest text-muted/40">
                  What are you focusing on?
                </p>
                <div className="flex flex-col gap-2 w-full max-w-sm">
                  {nowTasks.map((task, index) => {
                    const taskText = task.text || "Untitled task";
                    const isSelected = selectedTaskIndex === index;
                    return (
                      <button
                        key={task.id}
                        onClick={() => {
                          setSelectedTaskIndex(index);
                          setSteps(null);
                          setChecked(new Set());
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                          isSelected
                            ? "bg-teal/12 border-teal/40 text-[#E8EAF0]"
                            : "bg-transparent border-muted/10 text-muted/50 hover:border-muted/25 hover:text-muted/75"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Selection indicator */}
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 transition-all duration-200 ${
                              isSelected ? "bg-teal" : "bg-muted/20"
                            }`}
                          />
                          {/* Task text */}
                          <span className="font-sans text-sm leading-snug flex-1">
                            {taskText}
                          </span>
                          {/* Due date badge */}
                          {task.due_date && (() => {
                            const due = new Date(task.due_date);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const diffDays = Math.ceil(
                              (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                            );
                            const label =
                              diffDays === 0 ? "Today"
                              : diffDays === 1 ? "Tomorrow"
                              : diffDays < 0 ? `${Math.abs(diffDays)}d overdue`
                              : `${diffDays}d`;
                            const color =
                              diffDays <= 0
                                ? "bg-[#D85A30]/15 text-[#D85A30]"
                                : diffDays <= 1
                                ? "bg-[#EF9F27]/15 text-[#EF9F27]"
                                : "bg-teal/12 text-[#5DCAA5]";
                            return (
                              <span
                                className={`ml-auto shrink-0 font-sans text-[10px] font-medium px-2 py-0.5 rounded-full ${color}`}
                              >
                                {label}
                              </span>
                            );
                          })()}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Duration picker */}
            <p className="font-sans text-[10px] uppercase tracking-widest text-[#A0A8B8]/40">
              Focus duration
            </p>
            <div className="flex items-center gap-2">
              {[15, 25, 45, 60, 90].map((mins) => (
                <button
                  key={mins}
                  onClick={() => {
                    setSelectedMinutes(mins);
                    setTimeLeft(mins * 60);
                  }}
                  className={`font-sans text-sm px-3 py-1.5 rounded-lg border-2 transition-all duration-150 ${
                    selectedMinutes === mins
                      ? "bg-[#1D9E75]/15 border-[#1D9E75]/40 text-[#5DCAA5]"
                      : "bg-transparent border-[#A0A8B8]/10 text-[#A0A8B8]/40 hover:border-[#A0A8B8]/20 hover:text-[#A0A8B8]/60"
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
            {selectedMinutes > 60 && (
              <p className="font-sans text-[10px] text-[#EF9F27]/70 text-center max-w-xs">
                Sessions over 60 min include a 5-minute break every 30 minutes
              </p>
            )}
          </div>
        )}

        {timerStarted && (
          <p className="font-sans text-[10px] uppercase tracking-widest text-[#A0A8B8]/40 mb-6 text-center">
            {isBreak
              ? "Break time"
              : `${selectedMinutes} min focus · session ${sessionCount + 1}`}
          </p>
        )}

        <div className="relative w-[120px] h-[120px] sm:w-36 sm:h-36">
          <svg viewBox="0 0 144 144" className="-rotate-90 absolute inset-0 w-full h-full">
            <circle
              cx={72}
              cy={72}
              r={RADIUS}
              fill="none"
              stroke="#13161C"
              strokeWidth={5}
            />
            <circle
              cx={72}
              cy={72}
              r={RADIUS}
              fill="none"
              stroke={timerColor}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              role="timer"
              aria-label={
                isBreak
                  ? `Break: ${String(displayMins).padStart(2, "0")}:${String(displaySecs).padStart(2, "0")} remaining`
                  : `Focus: ${String(displayMins).padStart(2, "0")}:${String(displaySecs).padStart(2, "0")} remaining`
              }
              className="font-serif text-5xl text-[#E8EAF0] tabular-nums leading-none"
            >
              {String(displayMins).padStart(2, "0")}:{String(displaySecs).padStart(2, "0")}
            </span>
            <span className="font-sans text-[9px] text-[#A0A8B8]/35 mt-1.5 tracking-widest uppercase">
              {isBreak ? "break" : timeLeft === 0 ? "done" : "focus"}
            </span>
          </div>
        </div>

        {/* Break overlay banners */}
        {isBreak && !isRunning && (
          <div
            className="mt-4 px-4 py-3 rounded-xl border-2 border-[#EF9F27]/20 bg-[#EF9F27]/8 text-center"
            style={{ animation: "fadeSlideUp 400ms ease-out both" }}
          >
            <p className="font-serif italic text-[#EF9F27] text-base">
              30 minutes done. Take a breath.
            </p>
            <p className="font-sans text-[11px] text-[#EF9F27]/50 mt-1">
              5 minute break — step away from the screen
            </p>
            <button
              onClick={() => setIsRunning(true)}
              className="mt-3 font-sans text-xs px-4 py-1.5 rounded-lg bg-[#EF9F27]/10 hover:bg-[#EF9F27]/20 border-2 border-[#EF9F27]/20 text-[#EF9F27] transition-colors duration-150"
            >
              Start break timer
            </button>
          </div>
        )}

        {isBreak && isRunning && (
          <div
            className="mt-4 px-4 py-2 rounded-xl text-center"
            style={{ background: "rgba(239,159,39,0.06)" }}
          >
            <p className="font-sans text-[11px] text-[#EF9F27]/60">
              Break in progress — back soon
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 mt-5" style={{ animation: "fadeSlideUp 600ms ease-out 200ms both" }}>
          <button
            onClick={handleStartPause}
            disabled={timeLeft === 0 && !isBreak}
            aria-label={
              isRunning
                ? "Pause timer"
                : !timerStarted
                ? "Start timer"
                : "Resume timer"
            }
            className="px-6 py-2.5 bg-[#1D9E75] hover:bg-[#5DCAA5] disabled:opacity-40 disabled:cursor-not-allowed text-white font-sans font-medium text-sm rounded-lg transition-colors"
          >
            {isRunning ? "Pause" : !timerStarted ? "Start" : "Resume"}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2.5 font-sans text-sm text-[#A0A8B8]/40 hover:text-[#A0A8B8] hover:bg-[#13161C] rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Micro-steps */}
      <div>
        <p className="text-[10px] font-sans font-medium tracking-widest uppercase text-[#A0A8B8]/35 mb-3">
          Micro-steps
        </p>
        {steps === null ? (
          <SkeletonSteps />
        ) : (
          <div className="flex flex-col gap-1.5">
            {steps.map((step, i) => (
              <button
                key={i}
                onClick={() => toggleStep(i)}
                className={`flex items-start gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  checked.has(i)
                    ? "bg-[#13161C] opacity-40"
                    : "bg-[#13161C] hover:bg-[#13161C]/60"
                }`}
              >
                <span
                  className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                    checked.has(i)
                      ? "bg-[#1D9E75] border-[#1D9E75]"
                      : "border-[#A0A8B8]/20"
                  }`}
                >
                  {checked.has(i) && (
                    <svg
                      viewBox="0 0 12 12"
                      className="w-2.5 h-2.5 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2 6l3 3 5-5"
                      />
                    </svg>
                  )}
                </span>
                <span
                  className={`font-sans text-sm leading-snug ${
                    checked.has(i)
                      ? "line-through text-[#A0A8B8]/40"
                      : "text-[#E8EAF0]"
                  }`}
                >
                  {step}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
