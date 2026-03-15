"use client";

import { useRouter } from "next/navigation";
import { SettingsIcon } from "@/app/components/ui/settings";
import type { AppMode } from "../page";


function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 shrink-0">
      <rect x="2" y="4" width="16" height="14" rx="2" />
      <path strokeLinecap="round" d="M6 2v3M14 2v3M2 9h16" />
    </svg>
  );
}

const MODE_ITEMS: { id: AppMode; label: string; icon: React.ReactNode }[] = [
  {
    id: "home",
    label: "Home",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l7-7 7 7M5 8.5V16a1 1 0 001 1h3v-4h2v4h3a1 1 0 001-1V8.5" />
      </svg>
    ),
  },
  {
    id: "triage",
    label: "Triage",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h14M3 10h10M3 15h7" />
      </svg>
    ),
  },
  {
    id: "focus",
    label: "Focus",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 shrink-0">
        <circle cx="10" cy="10" r="7" />
        <circle cx="10" cy="10" r="2.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "reset",
    label: "Reset",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 shrink-0">
        <path strokeLinecap="round" d="M3 10q3.5-5 7 0t7 0" />
      </svg>
    ),
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: <CalendarIcon />,
  },
];

interface Props {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  taskCount: number;
  voiceEnabled: boolean;
  setVoiceEnabled: (v: boolean) => void;
  userName: string;
}

export default function Sidebar({ mode, setMode, taskCount, voiceEnabled, setVoiceEnabled, userName }: Props) {
  const router = useRouter();

  const initials = userName
    ? userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "CL";

  const handlePanic = () => {
    const url =
      typeof window !== "undefined"
        ? (localStorage.getItem("BrainDump_panic_url") ?? "https://poki.com/en/g/subway-surfers")
        : "https://poki.com/en/g/subway-surfers";
    window.open(url, "_blank");
  };

  return (
    <aside className="p-4 pr-0 h-screen">
      <div className="h-full w-56 bg-[#13161C] rounded-2xl border-2 border-[#1D9E75]/10 flex flex-col py-5 px-3 overflow-hidden">
        {/* BrainDump logo at top */}
        <div className="px-2 mb-5">
          <span className="font-serif text-xl text-[#E8EAF0]">
            Brain<em className="text-[#5DCAA5] italic">Dump</em>
          </span>
        </div>

        {/* Mode nav */}
        <nav className="flex flex-col gap-0.5 flex-1">
          {MODE_ITEMS.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setMode(item.id)}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans transition-all duration-200 text-left hover:-translate-y-px ${
                mode === item.id
                  ? "bg-[#0D0F14]/60 text-[#E8EAF0]"
                  : "text-[#A0A8B8]/50 hover:text-[#A0A8B8] hover:bg-[#0D0F14]/40"
              }`}
              style={{ animation: `fadeSlideUp 400ms ease-out ${i * 50}ms both` }}
            >
              {mode === item.id && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#1D9E75] rounded-full transition-all duration-200" />
              )}
              <span className={`transition-colors duration-200 ${mode === item.id ? "text-[#5DCAA5]" : ""}`}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Panic button */}
        <div className="px-1 mb-3">
          <button
            onClick={handlePanic}
            className="panic-btn w-full py-2.5 px-3 rounded-lg text-left font-sans text-[13px] font-medium transition-colors flex items-center gap-2"
            style={{
              color: "#D85A30",
              background: "rgba(216,90,48,0.12)",
              border: "2px solid rgba(216,90,48,0.28)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#D85A30] shrink-0 animate-pulse" />
            I need a break
          </button>
          <p className="mt-1.5 text-[9px] font-sans text-[#A0A8B8]/20 text-center">
            configure in settings
          </p>
        </div>

        {/* Bottom row: profile + settings */}
        <div className="flex items-center justify-between px-2 pt-3 border-t-2 border-[#1D9E75]/10">
          <div className="w-7 h-7 rounded-full bg-[#1D9E75]/20 border-2 border-[#1D9E75]/30 hover:border-[#1D9E75]/40 flex items-center justify-center shrink-0 transition-colors duration-200">
            <span className="font-sans text-[10px] font-semibold text-[#5DCAA5]">{initials}</span>
          </div>
          <button
            onClick={() => router.push("/settings")}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A0A8B8]/40 hover:text-[#A0A8B8] hover:bg-[#0D0F14]/40 transition-colors"
          >
            <SettingsIcon size={16} className="shrink-0" />
          </button>
        </div>
      </div>
    </aside>
  );
}
