"use client";

import { useState, useEffect, useRef } from "react";

const PHASES = [
  { label: "Inhale",  seconds: 4 },
  { label: "Hold",    seconds: 4 },
  { label: "Exhale",  seconds: 4 },
  { label: "Hold",    seconds: 4 },
];

interface Props {
  speak: (text: string) => void;
  voiceEnabled: boolean;
}

export default function ResetMode({ speak, voiceEnabled }: Props) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [answers, setAnswers]       = useState({ q1: "", q2: "", q3: 0 });
  const [saved, setSaved]           = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const advance = (index: number) => {
      timeoutRef.current = setTimeout(() => {
        const next = (index + 1) % PHASES.length;
        setPhaseIndex(next);
        advance(next);
      }, PHASES[index].seconds * 1000);
    };
    advance(0);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const handleSave = () => {
    try {
      sessionStorage.setItem(
        "BrainDump_checkins",
        JSON.stringify({ ...answers, ts: Date.now() })
      );
    } catch {}
    setSaved(true);
    if (voiceEnabled) speak("Good. Now back to it.");
  };

  const phase = PHASES[phaseIndex];

  return (
    <div className="p-6 sm:p-10 max-w-lg mx-auto">
      <div className="mb-10">
        <h2 className="font-serif text-2xl text-[#E8EAF0]">Reset</h2>
        <p className="mt-1 font-sans text-sm text-[#A0A8B8]/50">
          Breathe first. Three questions. Then back.
        </p>
      </div>

      {/* Breathing circle */}
      <div className="flex flex-col items-center mb-12">
        <div className="relative flex items-center justify-center w-40 h-40">
          <div className="animate-breathe absolute inset-0 rounded-full bg-[#1D9E75]/6" />
          <div
            className="animate-breathe absolute w-32 h-32 rounded-full border border-[#1D9E75]/25 bg-[#1D9E75]/10"
            style={{ animationDelay: "0.4s" }}
          />
          <div
            className="animate-breathe w-20 h-20 rounded-full bg-[#1D9E75]/20 flex items-center justify-center"
            style={{ animationDelay: "0.8s" }}
          >
            <div className="w-3 h-3 rounded-full bg-[#5DCAA5]/70" />
          </div>
        </div>

        <p
          key={phaseIndex}
          className="mt-7 font-serif italic text-2xl text-[#5DCAA5] opacity-0 animate-fade-up"
          style={{ animationDuration: "0.4s", animationFillMode: "both" }}
        >
          {phase.label}
        </p>
        <p className="mt-1 font-sans text-[11px] text-[#A0A8B8]/25 tabular-nums">{phase.seconds}s</p>
      </div>

      {/* Check-in */}
      <div className="flex flex-col gap-5">
        <div>
          <label className="block font-sans text-sm text-[#A0A8B8] mb-2">
            What&apos;s the ONE thing that would make today feel complete?
          </label>
          <textarea
            value={answers.q1}
            onChange={(e) => setAnswers((a) => ({ ...a, q1: e.target.value }))}
            rows={2}
            placeholder="If I only do one thing..."
            className="w-full resize-none rounded-lg bg-[#13161C] border border-[#1D9E75]/15 focus:border-[#1D9E75]/40 text-[#E8EAF0] placeholder-[#A0A8B8]/25 font-sans text-sm px-4 py-3 outline-none transition-[border-color] duration-200"
          />
        </div>

        <div>
          <label className="block font-sans text-sm text-[#A0A8B8] mb-2">
            What can you let go of right now?
          </label>
          <textarea
            value={answers.q2}
            onChange={(e) => setAnswers((a) => ({ ...a, q2: e.target.value }))}
            rows={2}
            placeholder="It's okay to release..."
            className="w-full resize-none rounded-lg bg-[#13161C] border border-[#1D9E75]/15 focus:border-[#1D9E75]/40 text-[#E8EAF0] placeholder-[#A0A8B8]/25 font-sans text-sm px-4 py-3 outline-none transition-[border-color] duration-200"
          />
        </div>

        {/* 1–5 dot selector */}
        <div>
          <label className="block font-sans text-sm text-[#A0A8B8] mb-3">
            How is your body feeling right now?
          </label>
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setAnswers((a) => ({ ...a, q3: n }))}
                aria-label={`${n}`}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
                    answers.q3 >= n
                      ? "border-[#1D9E75] bg-[#1D9E75]"
                      : "border-[#A0A8B8]/20 bg-transparent group-hover:border-[#1D9E75]/40"
                  }`}
                />
                <span className="font-sans text-[10px] text-[#A0A8B8]/30">{n}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saved}
          className="mt-2 w-full py-3 bg-[#13161C] hover:bg-[#1D9E75]/8 border border-[#1D9E75]/20 hover:border-[#1D9E75]/35 text-[#5DCAA5] font-sans text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saved ? "Saved ✓" : "Done"}
        </button>
      </div>
    </div>
  );
}
