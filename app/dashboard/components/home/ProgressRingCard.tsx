"use client";

import { useState, useEffect } from "react";

interface Props {
  completed: number;
  total: number;
  delay?: number;
}

export default function ProgressBattery({ completed, total, delay = 0 }: Props) {
  const rawProgress = total === 0 ? 0 : completed / total;
  const progress = total === 0 ? 0 : Math.max(0.10, rawProgress);
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const pct = total === 0 ? 0 : Math.round(rawProgress * 100);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setAnimatedWidth(progress * 100);
    });
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  return (
    <div
      className="flex items-center"
      style={{ animation: `fadeSlideUp 600ms ease-out ${delay}ms both` }}
    >
      {/* Battery body */}
      <div className="relative flex-1 h-full min-h-[180px] rounded-2xl border-2 border-[#A0A8B8]/15 bg-[#0D0F14] overflow-hidden transition-all duration-300 hover:border-[#1D9E75]/20 hover:shadow-[0_0_20px_rgba(29,158,117,0.08)]">
        {total > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-lg"
            style={{
              width: `${animatedWidth}%`,
              background: "linear-gradient(to right, #EF4444 0%, #EF9F27 25%, #1D9E75 50%, #1D9E75 100%)",
              backgroundSize: `${100 / (progress || 1)}% 100%`,
              transition: "width 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: rawProgress >= 0.5
                ? "0 0 20px rgba(29,158,117,0.25)"
                : rawProgress >= 0.25
                ? "0 0 15px rgba(239,159,39,0.15)"
                : "0 0 15px rgba(239,68,68,0.15)",
            }}
          />
        )}

        {/* Percent indicator */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="bg-[#0D0F14] px-2 py-1.5 rounded-lg font-sans text-lg font-semibold text-[#1D9E75] tabular-nums leading-none">
            {pct}%
          </span>
        </div>
      </div>

      {/* Battery terminal bump */}
      <div className="w-[8px] h-10 rounded-r-md bg-[#A0A8B8]/30 shrink-0" />
    </div>
  );
}
