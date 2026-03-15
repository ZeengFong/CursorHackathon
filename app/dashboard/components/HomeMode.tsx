"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import type { Task } from "../page";
import type { BrainDumpResponse } from "@/lib/ai/types";
import { supabase } from "@/lib/supabase";
import GreetingHeader from "./home/GreetingCard";
import ProgressRingCard from "./home/ProgressRingCard";
import WeekStripCard from "./home/WeekStripCard";
import CompletedCard from "./home/CompletedCard";
import AnimatedOrb from "./home/AnimatedOrb";
import DumpInput, { type FilePayload } from "../../components/DumpInput";

import { parseDueDate } from "@/lib/date-utils";

interface HomeModeProps {
  tasks: Task[];
  userName: string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  addTasks: (tasks: Task[]) => Promise<void>;
  deleteTask: (id: string) => void;
}

export default function HomeMode({ tasks, userName, updateTask, addTasks, deleteTask }: HomeModeProps) {
  const [dumpDone, setDumpDone] = useState(false);
  const [timesPondered, setTimesPondered] = useState(3); // default to 3 (hint hidden) until loaded
  const conversationHistoryRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const attachedFilesRef = useRef<FilePayload[]>([]);

  // Load times_pondered from user metadata
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setTimesPondered(user.user_metadata?.times_pondered ?? 0);
      }
    });
  }, []);

  const handlePondered = useCallback(() => {
    setTimesPondered((prev) => {
      const next = prev + 1;
      // Persist to user metadata
      supabase.auth.updateUser({ data: { times_pondered: next } });
      return next;
    });
  }, []);

  // Compute week boundaries (Monday-Sunday)
  const weekStart = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    return monday;
  }, []);

  const weekEnd = useMemo(() => {
    const sunday = new Date(weekStart);
    sunday.setDate(weekStart.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  }, [weekStart]);

  const enrichedTasks = useMemo(() => {
    return tasks.map((t) => ({
      ...t,
      due_date: t.due_date ?? parseDueDate(t.text),
    }));
  }, [tasks]);

  const weekTasks = useMemo(() => {
    return enrichedTasks.filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date + "T00:00:00");
      return d >= weekStart && d <= weekEnd;
    });
  }, [enrichedTasks, weekStart, weekEnd]);

  const completedThisWeek = useMemo(() => weekTasks.filter((t) => t.status === "done"), [weekTasks]);
  const totalThisWeek = weekTasks.length;

  // ── Inline brain dump handler ──────────────────────────────────────
  const handleDumpSubmit = async (text: string, files: FilePayload[]) => {
    attachedFilesRef.current = files;

    const res = await fetch("/api/ai/brain-dump", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawText: text,
        conversationHistory: conversationHistoryRef.current,
        ...(files.length > 0 ? { files } : {}),
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: BrainDumpResponse = await res.json();

    conversationHistoryRef.current = [
      ...conversationHistoryRef.current,
      { role: "user", content: text },
      { role: "assistant", content: data.clarifyingQuestion ?? data.ttsText },
    ];

    if (data.isComplete || !data.clarifyingQuestion) {
      const mapped: Task[] = data.tasks.map((t) => ({
        id: crypto.randomUUID(),
        text: t.name,
        description: t.description ?? null,
        category: "later" as const,
        status: "pending" as const,
        source: (attachedFilesRef.current.length > 0 ? "file" : "typed") as Task["source"],
        due_date: t.due_date ?? undefined,
      }));
      await addTasks(mapped);

      setDumpDone(true);
      setTimeout(() => setDumpDone(false), 2500);
      conversationHistoryRef.current = [];
    }
  };

  return (
    <div className="p-6 sm:p-8 sm:pl-10 sm:pr-20 max-w-[1200px] mx-auto min-h-full">
      {/* Standalone greeting header */}
      <GreetingHeader userName={userName} delay={0} />

      {/* Spacer between greeting and content */}
      <div className="h-8 sm:h-10" />

      {/* Layer 1: Brain dump + Orb — orb exceeds dump box by 2px top/bottom */}
      <div className="flex flex-col lg:flex-row gap-6 items-center">
        {/* Brain dump input — narrowed by 0.2*orbRadius (24px) from right, left edge anchored */}
        <div className="flex-1 min-w-0 lg:pr-[30px]" style={{ animation: "fadeSlideUp 600ms ease-out 100ms both" }}>
          {dumpDone ? (
            <div className="rounded-2xl border-2 border-[#1D9E75]/20 bg-[#13161C] p-10 flex items-center justify-center min-h-[200px]">
              <p className="font-serif italic text-xl text-[#5DCAA5]" style={{ animation: "fadeSlideUp 300ms ease-out" }}>
                Tasks added
              </p>
            </div>
          ) : (
            <DumpInput
              onSubmit={handleDumpSubmit}
              placeholder="Dump what's on your mind..."
              submitLabel="Extract tasks"
              className="[&_textarea]:min-h-[140px]"
            />
          )}
        </div>

        {/* Animated orb — slightly taller than dump box (2px overflow each side) */}
        <div className="shrink-0 lg:my-[-2px]">
          <AnimatedOrb
            tasks={tasks}
            updateTask={updateTask}
            addTasks={addTasks}
            deleteTask={deleteTask}
            timesPondered={timesPondered}
            onPondered={handlePondered}
            delay={150}
          />
        </div>
      </div>

      {/* Layer 2: Weekly calendar — full width */}
      <div className="mt-6">
        <WeekStripCard tasks={weekTasks} weekStart={weekStart} delay={250} />
      </div>

      {/* Layer 3: Completed (left) + Battery (right, skinnier) */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-[3fr_2fr] gap-5 items-stretch">
        <CompletedCard tasks={completedThisWeek} delay={300} />
        <ProgressRingCard completed={completedThisWeek.length} total={totalThisWeek} delay={350} />
      </div>
    </div>
  );
}
