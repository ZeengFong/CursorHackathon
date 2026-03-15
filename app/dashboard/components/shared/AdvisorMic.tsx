"use client";

import { useState } from "react";
import type { Task } from "../../page";
import { useAdvisorVoice } from "@/lib/hooks/useAdvisorVoice";

interface AdvisorMicProps {
  tasks: Task[];
  updateTask: (id: string, updates: Partial<Task>) => void;
  addTasks: (tasks: Task[]) => Promise<void>;
  deleteTask: (id: string) => void;
  onHighlight?: (ids: Set<string>) => void;
}

export default function AdvisorMic({
  tasks,
  updateTask,
  addTasks,
  deleteTask,
  onHighlight,
}: AdvisorMicProps) {
  const [isHovered, setIsHovered] = useState(false);

  const { state, replyText, typedChars, startRecording, stopRecording, stopPlayback } = useAdvisorVoice({
    tasks,
    updateTask,
    addTasks,
    deleteTask,
    includeDescriptions: true,
    onResponse: (advisor) => {
      if (onHighlight) {
        const names = new Set<string>(advisor.referencedTaskNames ?? []);
        const ids = new Set(tasks.filter((t) => names.has(t.text)).map((t) => t.id));
        onHighlight(ids);
        setTimeout(() => onHighlight(new Set()), 6000);
      }
    },
  });

  return (
    <div className="relative flex flex-col items-center gap-1 shrink-0">
      {/* Floating dialogue bubble */}
      {replyText && (
        <div
          className="absolute bottom-full right-0 mb-3 w-[240px] pointer-events-none"
          style={{ animation: "fadeSlideUp 400ms ease-out" }}
        >
          <div className="rounded-xl bg-[#13161C]/95 backdrop-blur-md border-none px-3 py-2.5 shadow-lg shadow-black/20">
            <p className="font-sans text-[11px] leading-relaxed" style={{
              color: "rgba(232,234,240,0.85)",
              textShadow: "0 0 8px rgba(232,234,240,0.15), 0 0 20px rgba(93,202,165,0.08)",
            }}>
              {replyText.slice(0, typedChars)}
              {typedChars < replyText.length && (
                <span className="inline-block w-[1.5px] h-[0.9em] bg-[#5DCAA5]/60 ml-[1px] align-middle" style={{ animation: "blink 1s step-end infinite" }} />
              )}
            </p>
          </div>
          <div className="flex justify-end mr-4 -mt-1">
            <span className="text-[14px] leading-none" style={{
              color: "rgba(255,255,255,0.7)",
              textShadow: "0 0 10px rgba(255,255,255,0.4), 0 0 25px rgba(93,202,165,0.3)",
            }}>⌄</span>
          </div>
        </div>
      )}

      {/* Padded wrapper */}
      <div className="relative" style={{ width: 75 + 60, height: 75 + 60 }}>
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
          onClick={state === "playing" ? stopPlayback : undefined}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          disabled={state === "loading"}
          aria-label={state === "idle" ? "Hold to speak" : state === "recording" ? "Release to send" : state === "loading" ? "Processing" : "Tap to stop"}
          className="absolute select-none"
          style={{
            top: 30,
            left: 30,
            width: 75,
            height: 75,
            transform: state === "loading" ? "translateY(-6px)" : "translateY(0)",
            transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* Circular glow */}
          <div className="absolute" style={{
            inset: -10,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(45,212,160,0.3) 40%, rgba(29,158,117,0.15) 60%, transparent 78%)",
            filter: state === "loading"
              ? "brightness(2.5)"
              : state === "recording"
              ? "brightness(2)"
              : state === "playing"
              ? "brightness(1.6)"
              : "brightness(1.3)",
            opacity: state === "loading" ? 0.9 : state === "recording" ? 0.8 : 0.6,
            animation: "orbRotate 8s linear infinite",
            animationPlayState: state === "idle" ? "paused" : "running",
            willChange: "transform",
            transition: "filter 0.6s ease, opacity 0.6s ease",
          }} />

          {/* Counter-rotating glow */}
          <div className="absolute" style={{
            inset: -8,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(93,202,165,0.2) 42%, rgba(19,78,58,0.1) 62%, transparent 80%)",
            filter: state === "loading"
              ? "brightness(2.5)"
              : "brightness(1.2)",
            opacity: state === "loading" ? 0.85 : 0.5,
            animation: "orbRotate 12s linear infinite reverse",
            animationPlayState: state === "idle" ? "paused" : "running",
            willChange: "transform",
            transition: "filter 0.6s ease, opacity 0.6s ease",
          }} />

          {/* Main orb body */}
          <div className="absolute inset-0 rounded-full overflow-hidden" style={{
            transform: state === "recording" ? "scale(1.075)" : "scale(1)",
            transition: "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.6s ease",
            boxShadow: state === "loading"
              ? "0 0 20px rgba(29,158,117,0.4), 0 0 40px rgba(93,202,165,0.15)"
              : state === "recording"
              ? "0 0 16px rgba(29,158,117,0.4), 0 0 30px rgba(29,158,117,0.15), inset 0 0 12px rgba(93,202,165,0.3)"
              : state === "playing"
              ? "0 0 14px rgba(29,158,117,0.35), 0 0 24px rgba(29,158,117,0.1)"
              : "0 0 6px rgba(29,158,117,0.12), 0 0 12px rgba(29,158,117,0.05)",
          }}>
            <div className="absolute inset-0" style={{
              background: "radial-gradient(ellipse at 30% 20%, #2DD4A0 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, #0F7A5C 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, #1D9E75 0%, #134E3A 100%)",
              animation: "orbRotate 8s linear infinite",
              willChange: "transform",
            }} />
            <div className="absolute inset-0" style={{
              background: "radial-gradient(ellipse at 60% 30%, rgba(93,202,165,0.6) 0%, transparent 40%), radial-gradient(ellipse at 20% 70%, rgba(15,122,92,0.8) 0%, transparent 50%)",
              animation: "orbRotate 12s linear infinite reverse",
              willChange: "transform",
            }} />
            <div className="absolute inset-0" style={{
              background: "radial-gradient(ellipse at 40% 60%, rgba(45,212,160,0.3) 0%, transparent 35%), radial-gradient(ellipse at 80% 20%, rgba(19,78,58,0.5) 0%, transparent 40%)",
              animation: "orbDrift 6s ease-in-out infinite",
              willChange: "transform",
            }} />
            <div className="absolute inset-0" style={{
              background: "radial-gradient(ellipse at 35% 25%, rgba(255,255,255,0.15) 0%, transparent 50%)",
            }} />

            {state === "playing" && (
              <div className="absolute inset-0 flex items-center justify-center gap-[2.5px]">
                {[0, 150, 300, 150].map((d, i) => (
                  <span key={i} className="w-[2px] rounded-full bg-white/50" style={{
                    animation: `wave-bar 0.85s ease-in-out infinite ${d}ms`,
                    height: "12px",
                  }} />
                ))}
              </div>
            )}

            {isHovered && state === "idle" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <kbd className="font-sans text-[8px] font-medium px-1.5 py-0.5 rounded-md bg-black/30 backdrop-blur-sm border-2 border-white/10 text-white/50">
                  R Shift
                </kbd>
              </div>
            )}
          </div>
        </button>
      </div>

      <span className="font-sans text-[9px] text-[#1D9E75]">
        {{ idle: "Hold to ask", recording: "Release\u2026", loading: "Thinking\u2026", playing: "Tap to stop" }[state]}
      </span>
    </div>
  );
}
