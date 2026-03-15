"use client";

import { useState, useRef } from "react";
import DumpInput, { type FilePayload } from "../../components/DumpInput";
import type { Task } from "../page";
import type { BrainDumpResponse } from "@/lib/ai/types";

interface Props {
  onTasksAdded: (tasks: Task[]) => void;
  onDone: () => void;
}

type ConversationEntry = { role: "user" | "assistant"; content: string };

export default function DumpMode({ onTasksAdded, onDone }: Props) {
  const [phase, setPhase] = useState<"dump" | "clarify" | "done">("dump");
  const [clarifyingQuestion, setClarifyingQuestion] = useState<string>("");
  const [clarifyAnswer, setClarifyAnswer] = useState("");
  const [pendingTasks, setPendingTasks] = useState<BrainDumpResponse["tasks"]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversationHistoryRef = useRef<ConversationEntry[]>([]);
  const lastRawTextRef = useRef<string>("");
  const attachedFilesRef = useRef<FilePayload[]>([]);

  // ── First submission (raw dump) ─────────────────────────────────────
  const handleDumpSubmit = async (text: string, files: FilePayload[]) => {
    setLoading(true);
    setError(null);
    lastRawTextRef.current = text;
    attachedFilesRef.current = files;

    // Append file contents to rawText so the AI sees them
    let rawText = text.trim();
    if (files.length > 0) {
      const fileSection = files
        .map((f) => `[File: ${f.name}]\n${f.content}`)
        .join("\n\n");
      rawText = `${rawText}\n\n--- Attached files ---\n${fileSection}`;
    }

    await callBrainDump(rawText);
    setLoading(false);
  };

  // ── Clarification answer submission ────────────────────────────────
  const handleClarifySubmit = async () => {
    if (!clarifyAnswer.trim()) return;
    setLoading(true);
    setError(null);
    await callBrainDump(clarifyAnswer.trim());
    setClarifyAnswer("");
    setLoading(false);
  };

  // ── Core API call ──────────────────────────────────────────────────
  const callBrainDump = async (userMessage: string) => {
    try {
      const res = await fetch("/api/ai/brain-dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: userMessage,
          conversationHistory: conversationHistoryRef.current,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: BrainDumpResponse = await res.json();

      // Accumulate conversation history
      conversationHistoryRef.current = [
        ...conversationHistoryRef.current,
        { role: "user", content: userMessage },
        { role: "assistant", content: data.clarifyingQuestion ?? data.ttsText },
      ];

      // Merge tasks (latest response has the full up-to-date list)
      setPendingTasks(data.tasks);

      if (data.isComplete) {
        // Map BrainDump TaskData → dashboard Task type
        const mapped: Task[] = data.tasks.map((t) => ({
          id: crypto.randomUUID(),
          text: t.name,
          category: "later" as const,
          status: "pending" as const,
          source: attachedFilesRef.current.length > 0 ? "file" : "typed",
          due_date: t.due_date ?? undefined,
        }));
        onTasksAdded(mapped);
        setPhase("done");
        setTimeout(onDone, 1200);
      } else if (data.clarifyingQuestion) {
        setClarifyingQuestion(data.clarifyingQuestion);
        setPhase("clarify");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="p-6 sm:p-10 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <p className="font-serif italic text-3xl text-[#5DCAA5]">
          {pendingTasks.length} task{pendingTasks.length !== 1 ? "s" : ""} added.
        </p>
        <p className="mt-2 font-sans text-sm text-[#A0A8B8]/40">Heading to triage…</p>
      </div>
    );
  }

  if (phase === "clarify") {
    return (
      <div className="p-6 sm:p-10 max-w-2xl mx-auto">
        <div className="mb-8">
          <h2 className="font-serif text-2xl text-[#E8EAF0]">One quick thing</h2>
          <p className="mt-1 font-sans text-sm text-[#A0A8B8]/50">
            {pendingTasks.length > 0 && `Extracted ${pendingTasks.length} task${pendingTasks.length !== 1 ? "s" : ""} so far.`}
          </p>
        </div>

        {/* Clarifying question bubble */}
        <div className="mb-6 rounded-xl bg-[#1A1E27] border border-[#1D9E75]/20 px-5 py-4">
          <p className="font-sans text-sm text-[#E8EAF0] leading-relaxed">{clarifyingQuestion}</p>
        </div>

        {/* Answer input */}
        <div className="flex gap-3">
          <input
            autoFocus
            type="text"
            value={clarifyAnswer}
            onChange={(e) => setClarifyAnswer(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleClarifySubmit()}
            placeholder="Type your answer…"
            disabled={loading}
            className="flex-1 rounded-lg bg-[#13161C] border border-[#1D9E75]/20 px-4 py-3 font-sans text-sm text-[#E8EAF0] placeholder-[#A0A8B8]/30 outline-none focus:border-[#1D9E75]/50 disabled:opacity-50"
          />
          <button
            onClick={handleClarifySubmit}
            disabled={loading || !clarifyAnswer.trim()}
            className="px-5 py-3 rounded-lg bg-[#1D9E75] font-sans text-sm font-medium text-white disabled:opacity-40 hover:bg-[#5DCAA5] transition-colors"
          >
            {loading ? "…" : "Send"}
          </button>
        </div>

        {error && (
          <p className="mt-3 font-sans text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  }

  // phase === "dump"
  return (
    <div className="p-6 sm:p-10 max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="font-serif text-2xl text-[#E8EAF0]">New dump</h2>
        <p className="mt-1 font-sans text-sm text-[#A0A8B8]/50">
          What&apos;s swirling around right now? Let it out.
        </p>
      </div>

      <DumpInput
        onSubmit={handleDumpSubmit}
        placeholder="The deadline, the unanswered message, the thing I keep forgetting, the call I need to make..."
        submitLabel="Extract tasks →"
      />

      {error && (
        <p className="mt-3 font-sans text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
