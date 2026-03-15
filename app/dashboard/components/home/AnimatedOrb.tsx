"use client";

import type { Task } from "../../page";
import { useAdvisorVoice } from "@/lib/hooks/useAdvisorVoice";

interface Props {
  tasks: Task[];
  updateTask: (id: string, updates: Partial<Task>) => void;
  addTasks: (tasks: Task[]) => Promise<void>;
  deleteTask: (id: string) => void;
  timesPondered: number;
  onPondered: () => void;
  delay?: number;
}

export default function AnimatedOrb({ tasks, updateTask, addTasks, deleteTask, timesPondered, onPondered, delay = 0 }: Props) {
  const { state, replyText, typedChars, startRecording, stopRecording, stopPlayback } = useAdvisorVoice({
    tasks,
    updateTask,
    addTasks,
    deleteTask,
    includeDescriptions: false,
    onResponse: () => onPondered(),
  });

  const showHint = timesPondered < 3 && state === "idle";

  return (
    <div
      className="relative"
      style={{ animation: `fadeSlideUp 600ms ease-out ${delay}ms both` }}
    >
      {/* Floating dialogue bubble */}
      {replyText && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-[280px] pointer-events-none"
          style={{ animation: "fadeSlideUp 400ms ease-out" }}
        >
          <div className="rounded-xl bg-[#13161C]/95 backdrop-blur-md border-none px-4 py-3 shadow-lg shadow-black/20">
            <p className="font-sans text-[13px] leading-relaxed" style={{
              color: "rgba(232,234,240,0.85)",
              textShadow: "0 0 8px rgba(232,234,240,0.15), 0 0 20px rgba(93,202,165,0.08)",
            }}>
              {replyText.slice(0, typedChars)}
              {typedChars < replyText.length && (
                <span className="inline-block w-[1.5px] h-[0.9em] bg-[#5DCAA5]/60 ml-[1px] align-middle" style={{ animation: "blink 1s step-end infinite" }} />
              )}
            </p>
          </div>
          <div className="flex justify-center -mt-1">
            <span className="text-[18px] leading-none" style={{
              color: "rgba(255,255,255,0.7)",
              textShadow: "0 0 10px rgba(255,255,255,0.4), 0 0 25px rgba(93,202,165,0.3), 0 0 40px rgba(29,158,117,0.15)",
            }}>⌄</span>
          </div>
        </div>
      )}

      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
        onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
        onClick={state === "playing" ? stopPlayback : undefined}
        disabled={state === "loading"}
        aria-label={state === "idle" ? "Hold to speak" : state === "recording" ? "Release to send" : state === "loading" ? "Processing" : "Tap to stop"}
        className="relative select-none group block w-[214px] h-[214px] lg:w-[252px] lg:h-[252px]"
        style={{
          transform: state === "loading" ? "translateY(-8px)" : "translateY(0)",
          transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Edge-matching glow */}
        <div className="absolute inset-[-6px] rounded-full" style={{
          background: "conic-gradient(from 0deg, rgba(45,212,160,0.25), rgba(29,158,117,0.2), rgba(15,122,92,0.25), rgba(93,202,165,0.2), rgba(19,78,58,0.25), rgba(45,212,160,0.25))",
          filter: state === "loading"
            ? "blur(18px) brightness(2.5)"
            : state === "recording"
            ? "blur(15px) brightness(2)"
            : state === "playing"
            ? "blur(13px) brightness(1.6)"
            : "blur(11px) brightness(1.3)",
          opacity: state === "loading" ? 0.9 : state === "recording" ? 0.75 : 0.65,
          animation: state === "idle" ? "orbRotate 8s linear infinite" : "orbRotate 8s linear infinite",
          animationPlayState: state === "idle" ? "paused" : "running",
          willChange: "transform",
          transition: "filter 0.6s ease, opacity 0.6s ease",
        }} />

        {/* Counter-rotating glow */}
        <div className="absolute inset-[-4px] rounded-full" style={{
          background: "conic-gradient(from 180deg, rgba(93,202,165,0.18), rgba(19,78,58,0.2), rgba(45,212,160,0.18), rgba(15,122,92,0.2), rgba(93,202,165,0.18))",
          filter: state === "loading"
            ? "blur(22px) brightness(2.5)"
            : "blur(13px) brightness(1.2)",
          opacity: state === "loading" ? 0.85 : 0.5,
          animation: "orbRotate 12s linear infinite reverse",
          animationPlayState: state === "idle" ? "paused" : "running",
          willChange: "transform",
          transition: "filter 0.6s ease, opacity 0.6s ease",
        }} />

        {/* Main orb */}
        <div className="relative w-full h-full rounded-full overflow-hidden" style={{
          transform: state === "recording" ? "scale(1.075)" : "scale(1)",
          transition: "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.6s ease",
          boxShadow: state === "loading"
            ? "0 0 50px rgba(29,158,117,0.5), 0 0 100px rgba(93,202,165,0.2)"
            : state === "recording"
            ? "0 0 40px rgba(29,158,117,0.5), 0 0 80px rgba(29,158,117,0.2), inset 0 0 30px rgba(93,202,165,0.3)"
            : state === "playing"
            ? "0 0 30px rgba(29,158,117,0.4), 0 0 60px rgba(29,158,117,0.15)"
            : "0 0 12px rgba(29,158,117,0.15), 0 0 24px rgba(29,158,117,0.06)",
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
            <div className="absolute inset-0 flex items-center justify-center gap-[3px]">
              {[0, 150, 300, 150].map((d, i) => (
                <span key={i} className="w-[3px] rounded-full bg-white/50" style={{
                  animation: `wave-bar 0.85s ease-in-out infinite ${d}ms`,
                  height: "16px",
                }} />
              ))}
            </div>
          )}

          {showHint && state === "idle" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <kbd className="font-sans text-[10px] font-medium px-2 py-1 rounded-md bg-black/30 backdrop-blur-sm border-2 border-white/10 text-white/50">
                R Shift
              </kbd>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
