"use client";

import type { Task } from "../../page";

interface Props {
  tasks: Task[];
  delay?: number;
}

import { SOURCE_STYLE } from "@/lib/constants";

export default function CompletedCard({ tasks, delay = 0 }: Props) {
  return (
    <div
      className="rounded-2xl border-2 border-[#1D9E75]/8 bg-[#13161C] p-6 transition-all duration-300 hover:border-[#1D9E75]/20 hover:shadow-[0_0_20px_rgba(29,158,117,0.08)] flex flex-col min-h-[180px]"
      style={{ animation: `fadeSlideUp 600ms ease-out ${delay}ms both` }}
    >
      <h3 className="font-sans text-xs font-medium text-[#A0A8B8]/50 uppercase tracking-wider mb-3">
        Completed
      </h3>

      {tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-sans text-sm text-[#A0A8B8]/30 text-center">
            Nothing yet — you&apos;ve got this!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto max-h-[200px] scrollbar-thin">
          {tasks.slice(0, 10).map((task, i) => (
            <div
              key={task.id}
              className="flex items-center gap-2.5 py-1.5"
              style={{ animation: `checkPop 400ms ease-out ${delay + i * 80}ms both` }}
            >
              {/* Checkmark */}
              <span className="w-5 h-5 rounded-full bg-[#1D9E75]/15 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                  <path
                    d="M2.5 6.5L5 9l4.5-6"
                    stroke="#1D9E75"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>

              {/* Task text */}
              <span className="font-sans text-sm text-[#A0A8B8]/70 truncate flex-1 line-through decoration-[#A0A8B8]/20">
                {task.text}
              </span>

              {/* Source badge */}
              <span
                className="font-sans text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                style={{
                  color: (SOURCE_STYLE[task.source] ?? SOURCE_STYLE.typed).color,
                  backgroundColor: `${(SOURCE_STYLE[task.source] ?? SOURCE_STYLE.typed).color}12`,
                }}
              >
                {(SOURCE_STYLE[task.source] ?? SOURCE_STYLE.typed).label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
