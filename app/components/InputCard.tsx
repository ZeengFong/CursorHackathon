"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DumpInput, { type FilePayload } from "./DumpInput";
import { supabase } from "@/lib/supabase";

export default function InputCard() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (text: string, files: FilePayload[]) => {
    setError(null);
    const res = await fetch("/api/dump", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, files }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    sessionStorage.setItem("BrainDump_tasks", JSON.stringify(data.tasks ?? []));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login?from=dump");
        return;
      }
    } catch {
      // If session check fails, proceed to dashboard anyway
    }
    router.push("/dashboard");
  };

  return (
    <div className="w-full">
      <DumpInput
        onSubmit={handleSubmit}
        placeholder="Everything's too much right now. The report, the emails, that thing I forgot, the meeting tomorrow, the thing Sarah said..."
        submitLabel="Clear my head →"
      />
      {error && (
        <p className="mt-3 font-sans text-sm text-red-400/80 text-center">{error}</p>
      )}
    </div>
  );
}
