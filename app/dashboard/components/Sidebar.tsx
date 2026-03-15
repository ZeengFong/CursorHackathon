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
    id: "dump",
    label: "Dump",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 4v9m0 0-3-3m3 3 3-3M5 16h10" />
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

  // Left-edge bar color based on task count
  const barColor =
    taskCount === 0 ? "transparent" :
    taskCount <= 3 ? "#1D9E75" :
    taskCount <= 7 ? "#EF9F27" : "#D85A30";

  const barFill = taskCount === 0 ? 0 : Math.min((taskCount / 10) * 100, 100);

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
    <aside className="relative w-60 h-screen bg-[#0D0F14] border-r border-[#1D9E75]/8 flex">
      {/* Left-edge cognitive load bar */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#13161C] z-10">
        <div
          className="absolute bottom-0 w-full transition-all duration-700 rounded-t-full"
          style={{ height: `${barFill}%`, backgroundColor: barColor }}
        />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 py-6 px-4 pl-5">
        {/* Logo + user avatar */}


        {/* Mode nav */}
        <nav className="flex flex-col gap-0.5 flex-1">
          {MODE_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setMode(item.id)}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans transition-all text-left ${
                mode === item.id
                  ? "bg-[#13161C] text-[#E8EAF0]"
                  : "text-[#A0A8B8]/50 hover:text-[#A0A8B8] hover:bg-[#13161C]/40"
              }`}
            >
              {mode === item.id && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#1D9E75] rounded-full" />
              )}
              <span className={`transition-colors ${mode === item.id ? "text-[#5DCAA5]" : ""}`}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}



        </nav>

        {/* Settings button */}
        <div className="px-2 pb-2">
          <button
            onClick={() => router.push("/settings")}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[#A0A8B8]/50 hover:text-[#A0A8B8] hover:bg-[#13161C]/40 transition-colors font-sans text-sm"
          >
            <SettingsIcon size={16} className="shrink-0" />
            Settings
          </button>
        </div>

        {/* Panic button */}
        <div className="px-2 pt-4 border-t border-[#1D9E75]/8">
          <button
            onClick={handlePanic}
            className="panic-btn w-full py-2.5 px-3 rounded-lg text-left font-sans text-[13px] font-medium transition-colors flex items-center gap-2"
            style={{
              color: "#D85A30",
              background: "rgba(216,90,48,0.12)",
              border: "1px solid rgba(216,90,48,0.28)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#D85A30] shrink-0 animate-pulse" />
            I need a break
          </button>
          <p className="mt-1.5 text-[9px] font-sans text-[#A0A8B8]/20 text-center">
            configure in settings
          </p>
        </div>

        <div className="flex items-center justify-between mb-8 px-2">
          <span className="font-serif text-xl text-[#E8EAF0]">
            Brain<em className="text-[#5DCAA5] italic">Dump</em>
          </span>
          <div className="w-7 h-7 rounded-full bg-[#1D9E75]/20 border border-[#1D9E75]/30 flex items-center justify-center shrink-0">
            <span className="font-sans text-[10px] font-semibold text-[#5DCAA5]">{initials}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
