"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Task } from "@/app/dashboard/page";

interface AdvisorVoiceConfig {
  tasks: Task[];
  updateTask: (id: string, updates: Partial<Task>) => void;
  addTasks: (tasks: Task[]) => Promise<void>;
  deleteTask: (id: string) => void;
  /** Whether to include task descriptions in the advisor payload */
  includeDescriptions?: boolean;
  /** Called after a successful advisor response */
  onResponse?: (advisor: AdvisorPayload) => void;
}

interface AdvisorPayload {
  reply: string;
  displaySummary?: string;
  actions?: Array<{
    type: "add" | "complete" | "reschedule" | "delete";
    taskName: string;
    dueDate?: string | null;
  }>;
  needsConfirmation?: boolean;
  referencedTaskNames?: string[];
}

export type AdvisorState = "idle" | "recording" | "loading" | "playing";

export function useAdvisorVoice({
  tasks,
  updateTask,
  addTasks,
  deleteTask,
  includeDescriptions = false,
  onResponse,
}: AdvisorVoiceConfig) {
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
  const blobUrlRef     = useRef<string | null>(null);
  const shiftRecordingRef = useRef(false);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Typewriter effect — batch via setInterval instead of chained setTimeouts
  useEffect(() => {
    if (!replyText || typedChars >= replyText.length) {
      if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null; }
      return;
    }
    typewriterRef.current = setInterval(() => {
      setTypedChars((c) => {
        if (replyText && c >= replyText.length - 1) {
          if (typewriterRef.current) clearInterval(typewriterRef.current);
        }
        return c + 1;
      });
    }, 25);
    return () => { if (typewriterRef.current) clearInterval(typewriterRef.current); };
  }, [replyText]); // only restart on new reply, not on every char

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

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Right Shift keyboard shortcut
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

  const sendToAdvisor = useCallback(async (userMessage: string) => {
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
            description: includeDescriptions ? (t.description ?? null) : null,
            created_at: null,
            due_date: t.due_date ?? null,
            completed: t.status === "done",
          })),
          currentTime: new Date().toISOString(),
        }),
      });

      if (!advisorRes.ok) throw new Error(`Advisor ${advisorRes.status}`);
      const advisor: AdvisorPayload = await advisorRes.json();

      setConversationHistory((prev) => [
        ...prev,
        { role: "user", content: userMessage },
        { role: "assistant", content: advisor.reply },
      ]);

      setReplyText(advisor.displaySummary || advisor.reply || "Done.");
      setTypedChars(0);

      onResponse?.(advisor);

      // Execute actions
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

      // TTS playback — set loading false before TTS for snappier UI
      setIsLoading(false);

      const ttsText = (advisor.reply || "").slice(0, 500);
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ttsText, voiceId: "calm" }),
      });
      if (!ttsRes.ok) throw new Error(`TTS ${ttsRes.status}`);
      const ttsData = await ttsRes.json();
      if (!ttsData.audioBase64) throw new Error("TTS returned no audio data");

      const bytes = atob(ttsData.audioBase64);
      const buf = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
      };
      await audio.play().catch(() => setIsPlaying(false));
    } catch (err) {
      console.error("[advisor]", err);
    } finally {
      setIsLoading(false);
    }
  }, [conversationHistory, tasks, includeDescriptions, updateTask, addTasks, deleteTask, onResponse]);

  const startRecording = useCallback(() => {
    if (isPlaying) { stopPlayback(); return; }

    const win = window as unknown as Record<string, unknown>;
    const SR = (win.SpeechRecognition ?? win.webkitSpeechRecognition) as (new () => {
      continuous: boolean;
      interimResults: boolean;
      onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
      onspeechend: (() => void) | null;
      start: () => void;
      stop: () => void;
    }) | undefined;

    if (!SR) return;

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
    setReplyText(null);
    setTypedChars(0);
  }, [isPlaying, stopPlayback]);

  const stopRecording = useCallback(async () => {
    if (!recognitionRef.current) return;
    setIsRecording(false);
    setIsLoading(true);

    // Reduced buffer: 1.5s (down from 3.5s) for snappier Electron feel
    await new Promise((r) => setTimeout(r, 1500));
    recognitionRef.current?.stop();
    await new Promise((r) => setTimeout(r, 200));

    const text = transcriptRef.current.trim();
    transcriptRef.current = "";
    if (text) {
      await sendToAdvisor(text);
    } else {
      setIsLoading(false);
    }
  }, [sendToAdvisor]);

  // Keep refs in sync
  startRecordingRef.current = startRecording;
  stopRecordingRef.current = stopRecording;

  const state: AdvisorState = isPlaying ? "playing" : isLoading ? "loading" : isRecording ? "recording" : "idle";

  return {
    state,
    replyText,
    typedChars,
    startRecording,
    stopRecording,
    stopPlayback,
  };
}
