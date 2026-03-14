"use client";

import { useState, useEffect, useRef } from "react";
import type { Task } from "../page";

interface Props {
  tasks: Task[];
}

const TOTAL = 25 * 60;
const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const MOCK_STEPS = [
  "Gather the materials and context you need",
  "Identify the very first action you can take",
  "Start — even an imperfect start counts",
  "Complete one section or milestone",
  "Note what still needs doing before you close",
];

function SkeletonSteps() {
  return (
    <div className="flex flex-col gap-1.5">
      {[80, 65, 72, 58, 68].map((w, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#13161C]">
          <div className="w-4 h-4 shrink-0 rounded border border-[#A0A8B8]/10 bg-[#0D0F14]" />
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
  const nowTasks = tasks.filter((t) => t.category === "now" && t.status !== "done");
  const activeTask = nowTasks[0] ?? null;

  const [steps, setSteps] = useState<string[] | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(TOTAL);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!activeTask) return;
    setChecked(new Set());
    setSteps(null); 
    fetch("/api/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: activeTask.text }),
    })
      .then((r) => r.json())
      .then((data) => {
        setSteps(Array.isArray(data.steps) && data.steps.length > 0 ? data.steps : MOCK_STEPS);
      })
      .catch(() => setSteps(MOCK_STEPS));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTask?.id]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) { setRunning(false); return 0; }
          return t - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const resetTimer = () => { setRunning(false); setTimeLeft(TOTAL); };

  const toggleStep = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");
  const progress = timeLeft / TOTAL;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const timerColor = timeLeft === 0 ? "#D85A30" : "#1D9E75";

  if (!activeTask) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
        <p className="font-serif italic text-3xl text-[#5DCAA5]">Nothing to focus on.</p>
        <p className="mt-2 font-sans text-sm text-[#A0A8B8]/40">Move something into Do Now first.</p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-10 max-w-2xl mx-auto">
      {/* Active task */}
      <div className="mb-10">
        <p className="text-[10px] font-sans font-medium tracking-widest uppercase text-[#1D9E75] mb-3">
          In focus
        </p>
        <h2 className="font-serif text-3xl sm:text-4xl text-[#E8EAF0] leading-snug">{activeTask.text}</h2>
      </div>

      {/* Pomodoro */}
      <div className="flex flex-col items-center mb-10">
        <div className="relative w-36 h-36">
          <svg width={144} height={144} className="-rotate-90 absolute inset-0">
            <circle cx={72} cy={72} r={RADIUS} fill="none" stroke="#13161C" strokeWidth={5} />
            <circle
              cx={72} cy={72} r={RADIUS}
              fill="none" stroke={timerColor} strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-serif text-5xl text-[#E8EAF0] tabular-nums leading-none">
              {minutes}:{seconds}
            </span>
            <span className="font-sans text-[9px] text-[#A0A8B8]/35 mt-1.5 tracking-widest uppercase">
              {timeLeft === 0 ? "done" : "focus"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={() => setRunning((r) => !r)}
            disabled={timeLeft === 0}
            className="px-6 py-2.5 bg-[#1D9E75] hover:bg-[#5DCAA5] disabled:opacity-40 disabled:cursor-not-allowed text-white font-sans font-medium text-sm rounded-lg transition-colors"
          >
            {running ? "Pause" : timeLeft === TOTAL ? "Start" : "Resume"}
          </button>
          <button
            onClick={resetTimer}
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
                  checked.has(i) ? "opacity-40" : "bg-[#13161C] hover:bg-[#13161C]/60"
                }`}
              >
                <span
                  className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                    checked.has(i) ? "bg-[#1D9E75] border-[#1D9E75]" : "border-[#A0A8B8]/20"
                  }`}
                >
                  {checked.has(i) && (
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </span>
                <span className={`font-sans text-sm leading-snug ${checked.has(i) ? "line-through text-[#A0A8B8]/40" : "text-[#E8EAF0]"}`}>
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
