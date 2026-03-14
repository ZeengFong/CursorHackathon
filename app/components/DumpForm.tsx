"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function DumpForm() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    handleInput();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dump: value }),
      });

      if (!res.ok) throw new Error("Server error");

      const data = await res.json();
      sessionStorage.setItem("clearhead_triage", JSON.stringify(data));
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onInput={handleInput}
          placeholder="Everything's too much right now. The report, the emails, the thing I forgot to do, the meeting tomorrow, the..."
          rows={5}
          style={{ overflow: "hidden", minHeight: "140px" }}
          className="w-full resize-none rounded-xl bg-[#13161C] border border-[#1D9E75]/20 focus:border-[#1D9E75]/50 text-[#E8EAF0] placeholder-[#A0A8B8]/40 font-sans text-base leading-relaxed px-5 py-4 outline-none transition-[border-color,box-shadow] duration-300 focus:shadow-[0_0_0_3px_rgba(29,158,117,0.08)]"
        />
      </div>

      {error && (
        <p className="mt-2.5 text-sm text-red-400/90 font-sans">{error}</p>
      )}

      <div className="mt-5 flex flex-col items-center gap-3">
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="px-8 py-3.5 bg-[#1D9E75] hover:bg-[#5DCAA5] disabled:opacity-40 disabled:cursor-not-allowed text-white font-sans font-medium text-[15px] rounded-lg transition-colors duration-200 flex items-center gap-2.5 cursor-pointer"
        >
          {loading ? (
            <>
              <span
                className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                style={{ animationDuration: "0.7s" }}
              />
              <span>Thinking...</span>
            </>
          ) : (
            "Clear my head →"
          )}
        </button>

        <p className="text-xs text-[#A0A8B8]/50 font-sans">
          No account needed. Your data stays private.
        </p>
      </div>
    </form>
  );
}
