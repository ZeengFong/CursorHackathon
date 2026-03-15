"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Sidebar from "./components/Sidebar";
import TriageMode from "./components/TriageMode";
import FocusMode from "./components/FocusMode";
import DumpMode from "./components/DumpMode";
import ResetMode from "./components/ResetMode";
import MascotOrb from "./components/MascotOrb";
import CalendarMode from "./components/CalendarMode";
import MindLetter from "./components/MindLetter";

import { supabase } from "@/lib/supabase"
import { getCachedTasks, setCachedTasks } from "@/lib/task-cache"

// ── Types ──────────────────────────────────────────────────────────────
export type AppMode = "dump" | "triage" | "focus" | "reset" | "calendar";
export type Category = "now" | "later" | "drop";

export interface Task {
  id: string;
  text: string;
  category: Category;
  status: "pending" | "done";
  source: "voice" | "file" | "typed";
  due_date?: string;
}

// ── Migrate old task shape → new ──────────────────────────────────────
function migrateTask(raw: Record<string, unknown>): Task {
  const validCategories = new Set(["now", "later", "drop"]);
  const validSources    = new Set(["voice", "file", "typed"]);
  return {
    id:       String(raw.id ?? crypto.randomUUID()),
    text:     String(raw.text ?? ""),
    category: validCategories.has(raw.category as string) ? (raw.category as Category) : "later",
    status:   raw.status === "done" || raw.done === true ? "done" : "pending",
    source:   validSources.has(raw.source as string) ? (raw.source as Task["source"]) : "typed",
    due_date: typeof raw.due_date === "string" ? raw.due_date : undefined,
  };
}


// ── Mobile nav items ───────────────────────────────────────────────────
const MODE_NAV: { id: AppMode; label: string; icon: React.ReactNode }[] = [
  {
    id: "dump", label: "Dump",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 4v9m0 0-3-3m3 3 3-3M5 16h10" />
      </svg>
    ),
  },
  {
    id: "triage", label: "Triage",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h14M3 10h10M3 15h7" />
      </svg>
    ),
  },
  {
    id: "focus", label: "Focus",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <circle cx="10" cy="10" r="7" />
        <circle cx="10" cy="10" r="2.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "reset", label: "Reset",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" d="M3 10q3.5-5 7 0t7 0" />
      </svg>
    ),
  },
  {
    id: "calendar", label: "Cal",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <rect x="2" y="4" width="16" height="14" rx="2" />
        <path strokeLinecap="round" d="M6 2v3M14 2v3M2 9h16" />
      </svg>
    ),
  },
];

// ── speak utility ──────────────────────────────────────────────────────
function speakText(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.95;
  window.speechSynthesis.speak(utt);
}

// ── Component ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const [mode, setMode]                 = useState<AppMode>("triage");
  const [tasks, setTasks]               = useState<Task[]>([]);
  const [mounted, setMounted]           = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [userName, setUserName]         = useState("BrainDump");
  const [dismissedText, setDismissedText] = useState<string | null>(null);
  const [restoredBanner, setRestoredBanner] = useState(false);
  const [showLetter, setShowLetter] = useState(false);
  const lastSpeakKey = useRef<string>("");

  // Load tasks: instant from localStorage cache, then refresh from Supabase
  useEffect(() => {
    const loadTasks = async () => {
      // Instant cache load to avoid flash of empty state
      const cached = getCachedTasks();
      if (cached) setTasks(cached);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setMounted(true); return; }

      // Set user name from metadata
      const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "User";
      setUserName(displayName);

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      let freshTasks: Task[] = [];
      if (error) {
        console.error("Failed to load tasks:", error.message);
      } else if (data && data.length > 0) {
        freshTasks = data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          text: String(row.Name ?? ""),
          category: (["now", "later", "drop"].includes(row.category as string) ? row.category : "later") as Category,
          status: row.completed ? "done" as const : "pending" as const,
          source: (["voice", "file", "typed"].includes(row.source as string) ? row.source : "typed") as Task["source"],
          due_date: row.due_date ? String(row.due_date).split("T")[0] : undefined,
        }));
      }
      setTasks(freshTasks);
      setCachedTasks(freshTasks);
      setMounted(true);

      // Show banner if user arrived after a dump from landing page
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("restored") === "true") {
        window.history.replaceState({}, "", "/dashboard");
        setRestoredBanner(true);
        setTimeout(() => setRestoredBanner(false), 3000);
      }
    };
    loadTasks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep localStorage cache in sync with task mutations
  useEffect(() => {
    if (mounted) setCachedTasks(tasks);
  }, [tasks, mounted]);

  // ── Task mutations (synced to Supabase) ─────────────────────────────
  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));

    // Sync to Supabase in background
    const patch: Record<string, unknown> = {};
    if (updates.text !== undefined) patch.Name = updates.text;
    if (updates.status !== undefined) patch.completed = updates.status === "done";
    if (updates.category !== undefined) patch.category = updates.category;
    if (updates.source !== undefined) patch.source = updates.source;
    if (updates.due_date !== undefined) patch.due_date = updates.due_date || null;

    supabase.from("tasks").update(patch).eq("id", Number(id)).then(({ error }) => {
      if (error) console.error("Failed to sync task update:", error.message);
    });
  };

  const addTasks = async (newTasks: Task[]) => {
    sessionStorage.removeItem('clearhead_letter');
    const migrated = newTasks.map((t) => migrateTask(t as unknown as Record<string, unknown>));

    // Insert into Supabase and use returned IDs
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const rows = migrated.map((t) => ({
        Name: t.text,
        completed: t.status === "done",
        category: t.category,
        source: t.source,
        due_date: t.due_date || null,
        user_id: user.id,
      }));

      const { data, error } = await supabase.from("tasks").insert(rows).select();
      if (!error && data) {
        const dbTasks: Task[] = data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          text: String(row.Name ?? ""),
          category: (row.category as Category) ?? "later",
          status: row.completed ? "done" as const : "pending" as const,
          source: (row.source as Task["source"]) ?? "typed",
          due_date: row.due_date ? String(row.due_date).split("T")[0] : undefined,
        }));
        setTasks((prev) => [...prev, ...dbTasks]);
        return;
      }
      if (error) console.error("Failed to insert tasks:", error.message);
    }

    // Fallback: add locally without DB IDs
    setTasks((prev) => [...prev, ...migrated]);
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    supabase.from("tasks").delete().eq("id", Number(id)).then(({ error }) => {
      if (error) console.error("Failed to delete task:", error.message);
    });
  };

  // ── Derived state ────────────────────────────────────────────────────
  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.category !== "drop"),
    [tasks]
  );

  const taskCount = activeTasks.length;

  // nextActionText: top "now" task
  const nextActionText = useMemo(() => {
    const nowTask = tasks.find((t) => t.status !== "done" && t.category === "now");
    return nowTask ? `Next up: ${nowTask.text}` : null;
  }, [tasks]);

  // Voice readback when mode is triage and tasks change (gated)
  useEffect(() => {
    if (!voiceEnabled || mode !== "triage") return;
    const nowTasks = tasks.filter((t) => t.status !== "done" && t.category === "now");
    if (nowTasks.length === 0) return;
    const key = nowTasks[0].id;
    if (key === lastSpeakKey.current) return;
    lastSpeakKey.current = key;
    speakText(`Focus on: ${nowTasks[0].text}`);
  }, [tasks, mode, voiceEnabled]);

  // Dismiss mascot orb text when nextActionText changes
  useEffect(() => {
    setDismissedText(null);
  }, [nextActionText]);

  const visibleNextActionText =
    nextActionText === dismissedText ? null : nextActionText;

  const speak = (text: string) => speakText(text);

  return (
    <div className="flex h-screen bg-[#0D0F14] overflow-hidden">
      {/* Sidebar — desktop only */}
      <div className="hidden sm:block shrink-0">
        <Sidebar
          mode={mode}
          setMode={setMode}
          taskCount={taskCount}
          voiceEnabled={voiceEnabled}
          setVoiceEnabled={setVoiceEnabled}
          userName={userName}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-16 sm:pb-0 relative">
        {restoredBanner && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1D9E75]/10 border border-[#1D9E75]/30 text-[#5DCAA5] font-sans text-sm px-4 py-2 rounded-full pointer-events-none">
            Your dump was saved — welcome back
          </div>
        )}
        {mode === "triage" && (
          <TriageMode tasks={tasks} updateTask={updateTask} addTasks={addTasks} deleteTask={deleteTask} onOpenLetter={() => setShowLetter(true)} />
        )}
        {mode === "focus" && <FocusMode tasks={tasks} />}
        {mode === "dump" && (
          <DumpMode onTasksAdded={addTasks} onDone={() => setMode("triage")} />
        )}
        {mode === "reset" && (
          <ResetMode speak={speak} voiceEnabled={voiceEnabled} />
        )}
        {mode === "calendar" && (
          <CalendarMode tasks={tasks} updateTask={updateTask} />
        )}
      </main>

      {/* Mascot Orb */}
      <MascotOrb
        nextActionText={visibleNextActionText}
        onDismiss={() => setDismissedText(nextActionText)}
        speak={speak}
      />

      {showLetter && (
        <MindLetter
          tasks={tasks}
          onClose={() => setShowLetter(false)}
        />
      )}

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-[#13161C]/95 backdrop-blur-sm border-t border-[#1D9E75]/10 flex z-50">
        {MODE_NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setMode(item.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
              mode === item.id ? "text-[#5DCAA5]" : "text-[#A0A8B8]/40"
            }`}
          >
            {item.icon}
            <span className="text-[10px] font-sans">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
