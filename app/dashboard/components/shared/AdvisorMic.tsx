"use client";

import { useState, useRef, useEffect } from "react";
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
  const [replyText, setReplyText]     = useState<string | null>(null);
  const [typedChars, setTypedChars]   = useState(0);
  const [isHovered, setIsHovered]     = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const transcriptRef  = useRef<string>("");
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const shiftRecordingRef = useRef(false);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPlayback = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  // Typewriter effect for reply text
  useEffect(() => {
    if (!replyText || typedChars >= replyText.length) return;
    const timer = setTimeout(() => setTypedChars((c) => c + 1), 25);
    return () => clearTimeout(timer);
  }, [replyText, typedChars]);

  // Auto-dismiss reply after fully typed + 6s
  useEffect(() => {
    if (replyText && typedChars >= replyText.length) {
      replyTimerRef.current = setTimeout(() => {
        setReplyText(null);
        setTypedChars(0);
      }, 6000);
      return () => { if (replyTimerRef.current) clearTimeout(replyTimerRef.current); };
    }
  }, [replyText, typedChars]);

  // ── Right Shift keyboard shortcut ─────────────────────────────────
  const startRecordingRef = useRef<() => void>(() => {});
  const stopRecordingRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "ShiftRight" && !e.repeat && !shiftRecordingRef.current) {
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
    setReplyText(null);
    setTypedChars(0);
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);

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

      // Show reply as floating typewriter dialogue
      setReplyText(advisor.displaySummary || advisor.reply || "Done.");
      setTypedChars(0);

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

      // TTS — truncate to 500 chars
      const ttsText = (advisor.reply || "").slice(0, 500);
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ttsText, voiceId: "calm" }),
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

    // Clear previous reply when starting new recording
    setReplyText(null);
    setTypedChars(0);
  };

  const stopRecording = async () => {
    if (!recognitionRef.current) return;
    setIsRecording(false);
    setIsLoading(true);

    // Keep recognition alive for 3.5s to capture trailing speech
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

  const state = isPlaying ? "playing" : isLoading ? "loading" : isRecording ? "recording" : "idle";

  return (
    <div className="relative flex flex-col items-center gap-1 shrink-0">
      {/* Floating dialogue bubble — above the orb */}
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

      {/* Padded wrapper — gives glow room to radiate without clipping */}
      <div className="relative" style={{ width: 75 + 60, height: 75 + 60 }}>
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
          onClick={isPlaying ? stopPlayback : undefined}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          disabled={isLoading}
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
          {/* Circular glow — tight radial gradient hugging the orb edge */}
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
            transition: "filter 0.6s ease, opacity 0.6s ease",
          }} />

          {/* Second circular glow — counter-rotating */}
          <div className="absolute" style={{
            inset: -8,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(93,202,165,0.2) 42%, rgba(19,78,58,0.1) 62%, transparent 80%)",
            filter: state === "loading"
              ? "brightness(2.5)"
              : "brightness(1.2)",
            opacity: state === "loading" ? 0.85 : 0.5,
            animation: "orbRotate 12s linear infinite reverse",
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
            {/* Gradient mesh layers */}
            <div className="absolute inset-0" style={{
              background: "radial-gradient(ellipse at 30% 20%, #2DD4A0 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, #0F7A5C 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, #1D9E75 0%, #134E3A 100%)",
              animation: "orbRotate 8s linear infinite",
            }} />
            <div className="absolute inset-0" style={{
              background: "radial-gradient(ellipse at 60% 30%, rgba(93,202,165,0.6) 0%, transparent 40%), radial-gradient(ellipse at 20% 70%, rgba(15,122,92,0.8) 0%, transparent 50%)",
              animation: "orbRotate 12s linear infinite reverse",
            }} />
            <div className="absolute inset-0" style={{
              background: "radial-gradient(ellipse at 40% 60%, rgba(45,212,160,0.3) 0%, transparent 35%), radial-gradient(ellipse at 80% 20%, rgba(19,78,58,0.5) 0%, transparent 40%)",
              animation: "orbDrift 6s ease-in-out infinite",
            }} />
            {/* Sheen */}
            <div className="absolute inset-0" style={{
              background: "radial-gradient(ellipse at 35% 25%, rgba(255,255,255,0.15) 0%, transparent 50%)",
            }} />

            {/* Playing indicator — waveform bars */}
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

            {/* R Shift hint — shown on hover */}
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
