"use client";

import { useState, useRef, useCallback } from "react";
import type { Task } from "../page";

interface Props {
  tasks: Task[];
  updateTask: (id: string, updates: Partial<Task>) => void;
}

const COLUMNS: {
  id: Task["category"];
  label: string;
  color: string;
  emptyText: string;
}[] = [
  { id: "now",   label: "Do now",   color: "#1D9E75", emptyText: "All clear here." },
  { id: "later", label: "Do later", color: "#EF9F27", emptyText: "Nothing pending." },
  { id: "drop",  label: "Drop",     color: "#A0A8B8", emptyText: "Nothing to let go of yet." },
];

const CYCLE: Record<Task["category"], Task["category"]> = {
  now: "later",
  later: "drop",
  drop: "now",
};

const SOURCE_STYLE: Record<string, { label: string; color: string }> = {
  voice: { label: "voice", color: "#5DCAA5" },
  file:  { label: "file",  color: "#EF9F27" },
  typed: { label: "typed", color: "#A0A8B8" },
};

// ── Advisor mic button ──────────────────────────────────────────────
function AdvisorMic({ tasks }: { tasks: Task[] }) {
  const [isRecording, setIsRecording]       = useState(false);
  const [isLoading, setIsLoading]           = useState(false);
  const [isPlaying, setIsPlaying]           = useState(false);
  const [summary, setSummary]               = useState<string | null>(null);
  const [highlighted, setHighlighted]       = useState<Set<string>>(new Set());
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  const recognitionRef  = useRef<SpeechRecognition | null>(null);
  const transcriptRef   = useRef<string>("");
  const audioRef        = useRef<HTMLAudioElement | null>(null);

  const stopPlayback = () => {
    audioRef.current?.pause();
    if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
    setIsPlaying(false);
  };

  const sendToAdvisor = useCallback(async (userMessage: string) => {
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

      if (!advisorRes.ok) throw new Error(`Advisor error ${advisorRes.status}`);
      const advisor = await advisorRes.json();

      setConversationHistory((prev) => [
        ...prev,
        { role: "user", content: userMessage },
        { role: "assistant", content: advisor.reply },
      ]);

      setSummary(advisor.displaySummary ?? null);

      // Highlight referenced tasks
      const names = new Set<string>(advisor.referencedTaskNames ?? []);
      setHighlighted(new Set(tasks.filter((t) => names.has(t.text)).map((t) => t.id)));
      setTimeout(() => setHighlighted(new Set()), 6000);

      // TTS
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: advisor.reply, voiceId: "calm" }),
      });

      if (!ttsRes.ok) throw new Error(`TTS error ${ttsRes.status}`);
      const ttsData = await ttsRes.json();

      const bytes = atob(ttsData.audioBase64);
      const buf = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;
      setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };
      audio.play();
    } catch (err) {
      console.error("[AdvisorMic]", err);
    } finally {
      setIsLoading(false);
    }
  }, [tasks, conversationHistory]);

  const startRecording = () => {
    if (isPlaying) { stopPlayback(); return; }

    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    transcriptRef.current = "";
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      transcriptRef.current = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ");
    };
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  };

  const stopRecording = async () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    const text = transcriptRef.current.trim();
    transcriptRef.current = "";
    if (text) await sendToAdvisor(text);
  };

  const micState = isPlaying ? "playing" : isLoading ? "loading" : isRecording ? "recording" : "idle";

  const micColor = {
    idle:      "#A0A8B8",
    recording: "#EF4444",
    loading:   "#EF9F27",
    playing:   "#1D9E75",
  }[micState];

  const micLabel = {
    idle:      "Hold to ask",
    recording: "Release to send",
    loading:   "Thinking…",
    playing:   "Tap to stop",
  }[micState];

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Summary chip */}
      {summary && (
        <p className="font-sans text-[11px] text-[#A0A8B8]/60 max-w-[200px] text-center leading-tight">
          {summary}
        </p>
      )}

      {/* Mic button */}
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
        onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
        onClick={isPlaying ? stopPlayback : undefined}
        disabled={isLoading}
        aria-label={micLabel}
        style={{ borderColor: micColor, color: micColor }}
        className="relative w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-200 hover:opacity-80 disabled:opacity-40 select-none"
      >
        {/* Pulse ring when recording */}
        {isRecording && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ backgroundColor: micColor }}
          />
        )}

        {micState === "loading" ? (
          // Spinner
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
          </svg>
        ) : micState === "playing" ? (
          // Stop icon
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <rect x="4" y="4" width="12" height="12" rx="1" />
          </svg>
        ) : (
          // Mic icon
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="7" y="2" width="6" height="10" rx="3" />
            <path strokeLinecap="round" d="M4 10a6 6 0 0 0 12 0M10 16v2" />
          </svg>
        )}
      </button>

      <span className="font-sans text-[10px]" style={{ color: micColor }}>{micLabel}</span>

      {/* Highlighted task names */}
      {highlighted.size > 0 && (
        <p className="font-sans text-[10px] text-[#5DCAA5]/60 text-center max-w-[180px]">
          ↑ highlighted in list
        </p>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────
export default function TriageMode({ tasks, updateTask }: Props) {
  const [hoveredId, setHoveredId]   = useState<string | null>(null);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [calendarId, setCalendarId] = useState<string | null>(null);

  // We thread highlighted IDs from AdvisorMic down via a shared ref approach
  // — simpler: just keep it in TriageMode state and pass a setter to AdvisorMic
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

  const visibleTasks = tasks.filter((t) => t.status !== "done");

  if (visibleTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
        <p className="font-serif italic text-3xl text-[#5DCAA5]">You&apos;ve cleared everything.</p>
        <p className="mt-2 font-sans text-sm text-[#A0A8B8]/40">Rare.</p>
      </div>
    );
  }

  const markDone = (id: string) => {
    setExitingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      updateTask(id, { status: "done" });
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 280);
  };

  return (
    <div className="p-6 sm:p-8">
      {/* Header row */}
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-[#E8EAF0]">Triage</h2>
          <p className="mt-1 font-sans text-xs text-[#A0A8B8]/50">
            Click a card to cycle it · hover to mark done
          </p>
        </div>

        {/* Advisor mic */}
        <AdvisorMicWrapper tasks={tasks} setHighlightedIds={setHighlightedIds} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {COLUMNS.map((col) => {
          const colTasks = visibleTasks.filter((t) => t.category === col.id);

          return (
            <div key={col.id}>
              {/* Column header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                <span
                  className="font-sans text-[11px] font-semibold tracking-widest uppercase"
                  style={{ color: col.color }}
                >
                  {col.label}
                </span>
                <span className="ml-auto font-sans text-xs text-[#A0A8B8]/30">{colTasks.length}</span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 min-h-[80px]">
                {colTasks.length === 0 ? (
                  <p className="py-8 text-center font-sans text-xs text-[#A0A8B8]/20 italic">
                    {col.emptyText}
                  </p>
                ) : (
                  colTasks.map((task) => {
                    const isExiting     = exitingIds.has(task.id);
                    const isHighlighted = highlightedIds.has(task.id);
                    const src = SOURCE_STYLE[task.source] ?? SOURCE_STYLE.typed;

                    return (
                      <div
                        key={task.id}
                        style={{
                          maxHeight: isExiting ? "0px" : "200px",
                          opacity: isExiting ? 0 : 1,
                          overflow: "hidden",
                          transition: "max-height 280ms ease, opacity 200ms ease",
                          marginBottom: isExiting ? 0 : undefined,
                        }}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => updateTask(task.id, { category: CYCLE[task.category] })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ")
                              updateTask(task.id, { category: CYCLE[task.category] });
                          }}
                          onMouseEnter={() => setHoveredId(task.id)}
                          onMouseLeave={() => { setHoveredId(null); setCalendarId(null); }}
                          className="relative cursor-pointer rounded-lg bg-[#13161C] border px-4 py-3.5 transition-all outline-none focus-visible:ring-1 focus-visible:ring-[#1D9E75]/50"
                          style={{
                            borderColor: isHighlighted ? "#5DCAA5" : "rgba(29,158,117,0.08)",
                            boxShadow: isHighlighted ? "0 0 0 1px #5DCAA540" : undefined,
                          }}
                        >
                          <p className="font-sans text-sm text-[#E8EAF0] leading-snug">{task.text}</p>

                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            {/* Source badge */}
                            <span
                              className="text-[9px] font-sans font-medium px-1.5 py-0.5 rounded uppercase tracking-wider"
                              style={{ color: src.color, backgroundColor: src.color + "18" }}
                            >
                              {src.label}
                            </span>

                            {hoveredId === task.id && (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {/* Add to calendar */}
                                <div className="relative">
                                  <button
                                    onClick={() => setCalendarId(calendarId === task.id ? null : task.id)}
                                    className="text-[10px] font-sans text-[#A0A8B8]/40 hover:text-[#5DCAA5] transition-colors px-1.5 py-0.5 rounded hover:bg-[#1D9E75]/8"
                                  >
                                    + date
                                  </button>
                                  {calendarId === task.id && (
                                    <input
                                      type="date"
                                      value={task.due_date ?? ""}
                                      onChange={(e) => {
                                        updateTask(task.id, { due_date: e.target.value });
                                        setCalendarId(null);
                                      }}
                                      className="absolute bottom-full right-0 mb-1 bg-[#13161C] border border-[#1D9E75]/30 text-[#E8EAF0] font-sans text-xs rounded-lg px-2 py-1 outline-none z-10"
                                    />
                                  )}
                                </div>

                                <button
                                  onClick={() => markDone(task.id)}
                                  className="text-[10px] font-sans text-[#A0A8B8]/40 hover:text-[#5DCAA5] transition-colors px-2 py-0.5 rounded hover:bg-[#1D9E75]/8"
                                >
                                  Mark done
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Due date chip */}
                          {task.due_date && (
                            <p className="mt-1 font-sans text-[9px] text-[#A0A8B8]/35 tabular-nums">
                              due {task.due_date.slice(5)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Wrapper to bridge highlighted IDs between AdvisorMic and TriageMode
function AdvisorMicWrapper({
  tasks,
  setHighlightedIds,
}: {
  tasks: Task[];
  setHighlightedIds: (ids: Set<string>) => void;
}) {
  const [isRecording, setIsRecording]     = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [summary, setSummary]             = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef  = useRef<string>("");
  const audioRef       = useRef<HTMLAudioElement | null>(null);

  const stopPlayback = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

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

      console.log("[advisor] fetch status →", advisorRes.status);
      if (!advisorRes.ok) {
        const errText = await advisorRes.text();
        console.error("[advisor] error body →", errText);
        throw new Error(`Advisor ${advisorRes.status}`);
      }
      const advisor = await advisorRes.json();
      console.log("[advisor] response →", JSON.stringify(advisor));

      setConversationHistory((prev) => [
        ...prev,
        { role: "user", content: userMessage },
        { role: "assistant", content: advisor.reply },
      ]);

      setSummary(advisor.displaySummary ?? null);

      // Highlight referenced tasks for 6 seconds
      const names = new Set<string>(advisor.referencedTaskNames ?? []);
      const ids = new Set(tasks.filter((t) => names.has(t.text)).map((t) => t.id));
      setHighlightedIds(ids);
      setTimeout(() => setHighlightedIds(new Set()), 6000);

      // TTS playback
      console.log("[tts] calling /api/tts with text →", advisor.reply?.slice(0, 60));
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: advisor.reply, voiceId: "calm" }),
      });
      console.log("[tts] fetch status →", ttsRes.status);
      if (!ttsRes.ok) {
        const errText = await ttsRes.text();
        console.error("[tts] error body →", errText);
        throw new Error(`TTS ${ttsRes.status}`);
      }
      const ttsData = await ttsRes.json();

      console.log("[tts playback] audioBase64 length →", ttsData.audioBase64?.length ?? 0);
      if (!ttsData.audioBase64) {
        console.error("[tts playback] NO audioBase64 in response! Full response →", JSON.stringify(ttsData));
        throw new Error("TTS returned no audio data");
      }
      const bytes = atob(ttsData.audioBase64);
      const buf = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      console.log("[tts playback] blob size →", blob.size, "bytes, URL →", url);

      const audio = new Audio(url);
      audioRef.current = audio;
      setIsPlaying(true);
      audio.onerror = (e) => console.error("[tts playback] audio element error →", e);
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

    const SR =
      (window as unknown as Record<string, unknown>).SpeechRecognition as typeof SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition as typeof SpeechRecognition;
    if (!SR) { alert("Speech recognition not supported in this browser."); return; }

    transcriptRef.current = "";
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      transcriptRef.current = Array.from(e.results).map((r) => r[0].transcript).join(" ");
    };
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  };

  const stopRecording = async () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    const text = transcriptRef.current.trim();
    transcriptRef.current = "";
    console.log("[stt] transcript →", text || "(empty)");
    if (text) await sendToAdvisor(text);
  };

  const micState = isPlaying ? "playing" : isLoading ? "loading" : isRecording ? "recording" : "idle";
  const micColor = { idle: "#A0A8B8", recording: "#EF4444", loading: "#EF9F27", playing: "#1D9E75" }[micState];
  const micLabel = { idle: "Hold to ask", recording: "Release…", loading: "Thinking…", playing: "Tap to stop" }[micState];

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      {summary && (
        <p className="font-sans text-[10px] text-[#A0A8B8]/50 max-w-[160px] text-right leading-tight">
          {summary}
        </p>
      )}

      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
        onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
        onClick={isPlaying ? stopPlayback : undefined}
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
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="7" y="2" width="6" height="10" rx="3" />
            <path strokeLinecap="round" d="M4 10a6 6 0 0 0 12 0M10 16v2" />
          </svg>
        )}
      </button>

      <span className="font-sans text-[9px]" style={{ color: micColor }}>{micLabel}</span>
    </div>
  );
}
