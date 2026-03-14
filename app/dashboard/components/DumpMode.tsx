"use client";

import DumpInput, { type FilePayload } from "../../components/DumpInput";
import type { Task } from "../page";

interface Props {
  onTasksAdded: (tasks: Task[]) => void;
  onDone: () => void;
}

export default function DumpMode({ onTasksAdded, onDone }: Props) {
  const handleSubmit = async (text: string, files: FilePayload[]) => {
    const res = await fetch("/api/dump", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, files }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data.tasks)) {
      onTasksAdded(data.tasks);
    }
    onDone();
  };

  return (
    <div className="p-6 sm:p-10 max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="font-serif text-2xl text-[#E8EAF0]">New dump</h2>
        <p className="mt-1 font-sans text-sm text-[#A0A8B8]/50">
          What&apos;s swirling around right now? Let it out.
        </p>
      </div>

      <DumpInput
        onSubmit={handleSubmit}
        placeholder="The deadline, the unanswered message, the thing I keep forgetting, the call I need to make..."
        submitLabel="Add to triage →"
      />
    </div>
  );
}
