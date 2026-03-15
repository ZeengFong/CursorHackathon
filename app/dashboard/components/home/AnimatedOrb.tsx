"use client";

import { useState, useRef, useEffect } from "react";
import type { Task } from "../../page";

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
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [replyText, setReplyText]     = useState<string | null>(null);
  const [typedChars, setTypedChars]   = useState(0);
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

  // Auto-dismiss reply after fully typed + 4s
  useEffect(() => {
    if (replyText && typedChars >= replyText.length) {
      replyTimerRef.current = setTimeout(() => {
        setReplyText(null);
        setTypedChars(0);
      }, 6000);
      return () => { if (replyTimerRef.current) clearTimeout(replyTimerRef.current); };
    }
  }, [replyText, typedChars]);

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
    // Clear previous reply
    setReplyText(null);
    setTypedChars(0);
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);

    try {
      console.log("[orb] sending to advisor:", userMessage);
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

      console.log("[orb] advisor status:", advisorRes.status);
      if (!advisorRes.ok) {
        const errText = await advisorRes.text();
        console.error("[orb] advisor error:", errText);
        throw new Error(`Advisor ${advisorRes.status}`);
      }
      const advisor = await advisorRes.json();
      console.log("[orb] advisor response:", JSON.stringify(advisor).slice(0, 200));

      setConversationHistory((prev) => [
        ...prev,
        { role: "user", content: userMessage },
        { role: "assistant", content: advisor.reply },
      ]);

      // Show reply as floating typewriter dialogue
      setReplyText(advisor.displaySummary || advisor.reply || "Done.");
      setTypedChars(0);

      // Increment times_pondered
      onPondered();

      // Execute actions
      const actions = advisor.actions ?? [];
      if (!advisor.needsConfirmation && actions.length > 0) {
        console.log("[orb] executing actions:", JSON.stringify(actions));
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
            else console.warn("[orb] no match for complete:", action.taskName);
          } else if (action.type === "reschedule") {
            const match = tasks.find((t) => t.text.toLowerCase() === action.taskName.toLowerCase() && t.status !== "done");
            if (match && action.dueDate) updateTask(match.id, { due_date: action.dueDate });
            else console.warn("[orb] no match for reschedule:", action.taskName);
          } else if (action.type === "delete") {
            const match = tasks.find((t) => t.text.toLowerCase() === action.taskName.toLowerCase());
            if (match) deleteTask(match.id);
            else console.warn("[orb] no match for delete:", action.taskName);
          }
        }
        if (tasksToAdd.length > 0) await addTasks(tasksToAdd);
      }

      // TTS playback
      console.log("[orb] calling TTS...");
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: advisor.reply, voiceId: "calm" }),
      });
      console.log("[orb] TTS status:", ttsRes.status);
      if (!ttsRes.ok) {
        const errText = await ttsRes.text();
        console.error("[orb] TTS error:", errText);
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
      audio.onerror = (e) => console.error("[orb] audio error:", e);
      audio.onended = () => { setIsPlaying(false); URL.revokeObjectURL(url); };
      await audio.play().catch((e) => {
        console.error("[orb] play() rejected:", e);
        setIsPlaying(false);
      });
    } catch (err) {
      console.error("[AnimatedOrb]", err);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = () => {
    if (isPlaying) { stopPlayback(); return; }
    console.log("[orb] startRecording");

    const win = window as unknown as Record<string, unknown>;
    const SR = (win.SpeechRecognition ?? win.webkitSpeechRecognition) as (new () => {
      continuous: boolean;
      interimResults: boolean;
      onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
      start: () => void;
      stop: () => void;
    }) | undefined;

    if (!SR) {
      console.warn("[orb] SpeechRecognition not available");
      return;
    }

    transcriptRef.current = "";
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      transcriptRef.current = Array.from({ length: Object.keys(e.results).length }, (_, i) => e.results[i][0].transcript).join(" ");
      console.log("[orb] transcript so far:", transcriptRef.current);
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
    console.log("[orb] stopRecording — buffering 3.5s...");
    setIsRecording(false);
    setIsLoading(true);

    // 3.5s buffer to capture trailing speech
    await new Promise((r) => setTimeout(r, 3500));
    recognitionRef.current?.stop();
    // 200ms grace period for final onresult
    await new Promise((r) => setTimeout(r, 200));

    const text = transcriptRef.current.trim();
    transcriptRef.current = "";
    console.log("[orb] final transcript:", text || "(empty)");
    if (text) {
      await sendToAdvisor(text);
    } else {
      setIsLoading(false);
    }
  };

  startRecordingRef.current = startRecording;
  stopRecordingRef.current = stopRecording;

  const state = isPlaying ? "playing" : isLoading ? "loading" : isRecording ? "recording" : "idle";
  const showHint = timesPondered < 3 && state === "idle";

  return (
    <div
      className="relative"
      style={{ animation: `fadeSlideUp 600ms ease-out ${delay}ms both` }}
    >
      {/* Floating dialogue bubble — above the orb */}
      {replyText && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-[280px] pointer-events-none"
          style={{ animation: "fadeSlideUp 400ms ease-out" }}
        >
          <div className="rounded-xl bg-[#13161C]/95 backdrop-blur-md border border-[#1D9E75]/15 px-4 py-3 shadow-lg shadow-black/20">
            <p className="font-sans text-[13px] text-[#E8EAF0]/80 leading-relaxed">
              {replyText.slice(0, typedChars)}
              {typedChars < replyText.length && (
                <span className="inline-block w-[1.5px] h-[0.9em] bg-[#5DCAA5]/60 ml-[1px] align-middle" style={{ animation: "blink 1s step-end infinite" }} />
              )}
            </p>
          </div>
          {/* Arrow pointing down to orb */}
          <div className="flex justify-center">
            <div className="w-3 h-3 bg-[#13161C]/95 border-r border-b border-[#1D9E75]/15 rotate-45 -mt-1.5" />
          </div>
        </div>
      )}

      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
        onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
        onClick={isPlaying ? stopPlayback : undefined}
        disabled={isLoading}
        aria-label={state === "idle" ? "Hold to speak" : state === "recording" ? "Release to send" : state === "loading" ? "Processing" : "Tap to stop"}
        className="relative select-none group block w-[214px] h-[214px] lg:w-[252px] lg:h-[252px]"
        style={{
          transform: state === "loading" ? "translateY(-8px)" : "translateY(0)",
          transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Edge-matching glow — subtle baseline, intensifies when thinking */}
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
          animation: "orbRotate 8s linear infinite",
          transition: "filter 0.6s ease, opacity 0.6s ease",
        }} />

        {/* Second glow layer — counter-rotating */}
        <div className="absolute inset-[-4px] rounded-full" style={{
          background: "conic-gradient(from 180deg, rgba(93,202,165,0.18), rgba(19,78,58,0.2), rgba(45,212,160,0.18), rgba(15,122,92,0.2), rgba(93,202,165,0.18))",
          filter: state === "loading"
            ? "blur(22px) brightness(2.5)"
            : "blur(13px) brightness(1.2)",
          opacity: state === "loading" ? 0.85 : 0.5,
          animation: "orbRotate 12s linear infinite reverse",
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
            <div className="absolute inset-0 flex items-center justify-center gap-[3px]">
              {[0, 150, 300, 150].map((d, i) => (
                <span key={i} className="w-[3px] rounded-full bg-white/50" style={{
                  animation: `wave-bar 0.85s ease-in-out infinite ${d}ms`,
                  height: "16px",
                }} />
              ))}
            </div>
          )}

          {/* R Shift hint — centered on orb, disappears after 3 uses */}
          {showHint && state === "idle" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <kbd className="font-sans text-[10px] font-medium px-2 py-1 rounded-md bg-black/30 backdrop-blur-sm border border-white/10 text-white/50">
                R Shift
              </kbd>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
