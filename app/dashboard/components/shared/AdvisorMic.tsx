"use client";

import { useState, useRef, useEffect } from "react";
import { MicIcon } from "@/app/components/ui/mic";
import type { Task } from "../../page";

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
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [summary, setSummary]         = useState<string | null>(null);
  const [isMicHovered, setIsMicHovered] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const transcriptRef  = useRef<string>("");
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const shiftRecordingRef = useRef(false);

  const stopPlayback = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  // ── Right Shift keyboard shortcut ─────────────────────────────────
  const startRecordingRef = useRef<() => void>(() => {});
  const stopRecordingRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "ShiftRight" && !e.repeat && !shiftRecordingRef.current) {
        // Don't trigger while typing in inputs
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement as HTMLElement)?.isContentEditable) return;
        shiftRecordingRef.current = true;
        startRecordingRef.current();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ShiftRight" && shiftRecordingRef.current) {
        shiftRecordingRef.current = false;
        stopRecordingRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const sendToAdvisor = async (userMessage: string) => {
    setIsLoading(true);
    try {
      const advisorRes = await fetch("/api/ai/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage,
          conversationHistory,
          tasks: tasks.map((t) => ({
            name: t.text,
            description: null,
            created_at: null,
            due_date: t.due_date ?? null,
            completed: t.status === "done",
          })),
          currentTime: new Date().toISOString(),
        }),
      });

      if (!advisorRes.ok) {
        const errText = await advisorRes.text();
        console.error("[advisor] error body →", errText);
        throw new Error(`Advisor ${advisorRes.status}`);
      }
      const advisor = await advisorRes.json();

      setConversationHistory((prev) => [
        ...prev,
        { role: "user", content: userMessage },
        { role: "assistant", content: advisor.reply },
      ]);

      setSummary(advisor.displaySummary ?? null);

      // ── Execute actions if AI is confident ──────────────────────────
      const actions = advisor.actions ?? [];
      if (!advisor.needsConfirmation && actions.length > 0) {
        const tasksToAdd: Task[] = [];

        for (const action of actions) {
          if (action.type === "add") {
            tasksToAdd.push({
              id: crypto.randomUUID(),
              text: action.taskName,
              category: "later",
              status: "pending",
              source: "voice",
              due_date: action.dueDate ?? undefined,
            });
          } else if (action.type === "complete") {
            const match = tasks.find((t) => t.text.toLowerCase() === action.taskName.toLowerCase() && t.status !== "done");
            if (match) updateTask(match.id, { status: "done" });
          } else if (action.type === "reschedule") {
            const match = tasks.find((t) => t.text.toLowerCase() === action.taskName.toLowerCase() && t.status !== "done");
            if (match && action.dueDate) updateTask(match.id, { due_date: action.dueDate });
          } else if (action.type === "delete") {
            const match = tasks.find((t) => t.text.toLowerCase() === action.taskName.toLowerCase());
            if (match) deleteTask(match.id);
          }
        }

        if (tasksToAdd.length > 0) await addTasks(tasksToAdd);
      }

      if (onHighlight) {
        const names = new Set<string>(advisor.referencedTaskNames ?? []);
        const ids = new Set(tasks.filter((t) => names.has(t.text)).map((t) => t.id));
        onHighlight(ids);
        setTimeout(() => onHighlight(new Set()), 6000);
      }

      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: advisor.reply, voiceId: "calm" }),
      });
      if (!ttsRes.ok) {
        const errText = await ttsRes.text();
        console.error("[tts] error body →", errText);
        throw new Error(`TTS ${ttsRes.status}`);
      }
      const ttsData = await ttsRes.json();

      if (!ttsData.audioBase64) throw new Error("TTS returned no audio data");

      const bytes = atob(ttsData.audioBase64);
      const buf = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;
      setIsPlaying(true);
      audio.onerror = (e) => console.error("[tts playback] audio error →", e);
      audio.onended = () => { setIsPlaying(false); URL.revokeObjectURL(url); };
      await audio.play().catch((e) => {
        console.error("[tts playback] play() rejected →", e);
        setIsPlaying(false);
      });
    } catch (err) {
      console.error("[AdvisorMic]", err);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = () => {
    if (isPlaying) { stopPlayback(); return; }

    const win = window as unknown as Record<string, unknown>;
    const SR = (win.SpeechRecognition ?? win.webkitSpeechRecognition) as (new () => {
      continuous: boolean;
      interimResults: boolean;
      onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
      start: () => void;
      stop: () => void;
    }) | undefined;

    if (!SR) { alert("Speech recognition not supported in this browser."); return; }

    transcriptRef.current = "";
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      transcriptRef.current = Array.from({ length: Object.keys(e.results).length }, (_, i) => e.results[i][0].transcript).join(" ");
    };
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  };

  const stopRecording = async () => {
    if (!recognitionRef.current) return;
    setIsRecording(false);
    setIsLoading(true);

    // Keep recognition alive for 2s to capture trailing speech
    await new Promise((r) => setTimeout(r, 3500));
    recognitionRef.current?.stop();
    // Small grace period for final onresult event
    await new Promise((r) => setTimeout(r, 200));

    const text = transcriptRef.current.trim();
    transcriptRef.current = "";
    if (text) {
      await sendToAdvisor(text);
    } else {
      setIsLoading(false);
    }
  };

  // Keep refs in sync so the keyboard listener calls current versions
  startRecordingRef.current = startRecording;
  stopRecordingRef.current = stopRecording;

  const micState = isPlaying ? "playing" : isLoading ? "loading" : isRecording ? "recording" : "idle";
  const micColor = { idle: "#A0A8B8", recording: "#EF4444", loading: "#EF9F27", playing: "#1D9E75" }[micState];
  const micLabel = { idle: "Hold to ask", recording: "Release\u2026", loading: "Thinking\u2026", playing: "Tap to stop" }[micState];

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      {summary && (
        <p className="font-sans text-[10px] text-[#A0A8B8]/50 max-w-[160px] text-right leading-tight">
          {summary}
        </p>
      )}

      <div className="relative">
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
          onClick={isPlaying ? stopPlayback : undefined}
          onMouseEnter={() => setIsMicHovered(true)}
          onMouseLeave={() => setIsMicHovered(false)}
          disabled={isLoading}
          aria-label={micLabel}
          style={{ borderColor: micColor, color: micColor }}
          className="relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-200 hover:opacity-80 disabled:opacity-40 select-none"
        >
          {isRecording && (
            <span className="absolute inset-0 rounded-full animate-ping opacity-25" style={{ backgroundColor: micColor }} />
          )}
          {micState === "loading" ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
              </svg>
          ) : micState === "playing" ? (
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <rect x="4" y="4" width="12" height="12" rx="1" />
            </svg>
          ) : (
            <MicIcon/>
          )}
        </button>

        {/* Keyboard shortcut tooltip */}
        {isMicHovered && micState === "idle" && (
          <div
            className="absolute right-12 top-1/2 -translate-y-1/2 whitespace-nowrap font-sans text-[10px] text-[#A0A8B8]/60 flex items-center gap-1.5 pointer-events-none"
            style={{ animation: "fadeSlideUp 120ms ease-out" }}
          >
            <span>or hold</span>
            <kbd className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium tracking-wide"
              style={{
                background: "rgba(160,168,184,0.08)",
                border: "1px solid rgba(160,168,184,0.15)",
                color: "#A0A8B8",
              }}
            >
              R Shift
            </kbd>
          </div>
        )}
      </div>

      <span className="font-sans text-[9px]" style={{ color: micColor }}>{micLabel}</span>
    </div>
  );
}
