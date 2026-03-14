"use client";

import { useRef, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────
export interface FilePayload {
  name: string;
  content: string;
}

interface FileItem {
  id: string;
  name: string;
  content: string;
  size: number;
}

interface DumpInputProps {
  onSubmit: (text: string, files: FilePayload[]) => Promise<void>;
  placeholder?: string;
  submitLabel?: string;
  /** Extra classes applied to the outer wrapper */
  className?: string;
}

// ── Icons ─────────────────────────────────────────────────────────────
function MicIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 2.5a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 5 0V5A2.5 2.5 0 0 0 10 2.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 9.5a5 5 0 0 0 10 0M10 15v2.5M7.5 17.5h5" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <rect x="5" y="5" width="10" height="10" rx="1.5" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m13.5 6-6 6a2.121 2.121 0 0 0 3 3l7-7a4.243 4.243 0 0 0-6-6l-7 7a6.364 6.364 0 0 0 9 9l5-5" />
    </svg>
  );
}

function XSmallIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3 h-3">
      <path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────
const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".xml", ".html", ".htm", ".js", ".ts", ".py"];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ── Component ─────────────────────────────────────────────────────────
export default function DumpInput({
  onSubmit,
  placeholder = "Everything's too much right now. The report, the emails, that thing I forgot, the meeting tomorrow...",
  submitLabel = "Clear my head →",
  className = "",
}: DumpInputProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef("");

  // ── Auto-resize ───────────────────────────────────────────────────
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);

  // ── Speech recognition ────────────────────────────────────────────
  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }
    try {
      const API =
        typeof window !== "undefined"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (window as any).SpeechRecognition ??
            (window as any).webkitSpeechRecognition
          : null;

      if (!API) {
        setVoiceError("Voice input not supported in this browser");
        return;
      }

      const rec = new API();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";
      baseTextRef.current = text.trim();

      rec.onstart = () => { setIsRecording(true); setVoiceError(null); };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        let interim = "", final = "";
        for (let i = 0; i < event.results.length; i++) {
          (event.results[i].isFinal ? (s: string) => { final += s; } : (s: string) => { interim += s; })(
            event.results[i][0].transcript
          );
        }
        const appended = (final || interim).trim();
        setText(baseTextRef.current ? `${baseTextRef.current} ${appended}` : appended);
        requestAnimationFrame(autoResize);
      };

      rec.onend = () => setIsRecording(false);
      rec.onerror = () => { setIsRecording(false); setVoiceError("Voice error — try again."); };
      rec.start();
      recognitionRef.current = rec;
    } catch {
      setVoiceError("Voice input not supported in this browser");
    }
  };

  // ── File reading ──────────────────────────────────────────────────
  const readFile = (file: File): Promise<FileItem> =>
    new Promise((resolve) => {
      const id = crypto.randomUUID();
      const isText =
        TEXT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)) ||
        file.type.startsWith("text/");
      if (isText) {
        const reader = new FileReader();
        reader.onload = (e) =>
          resolve({ id, name: file.name, size: file.size, content: (e.target?.result as string) ?? "" });
        reader.readAsText(file);
      } else {
        resolve({ id, name: file.name, size: file.size, content: `[File: ${file.name}]` });
      }
    });

  const addFiles = async (incoming: File[]) => {
    const slots = 3 - files.length;
    if (slots <= 0) return;
    const items = await Promise.all(incoming.slice(0, slots).map(readFile));
    setFiles((prev) => [...prev, ...items]);
  };

  // ── Drag-and-drop ─────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files.length) addFiles(Array.from(e.dataTransfer.files));
  };

  // ── Submit ────────────────────────────────────────────────────────
  const canSubmit = (text.trim().length > 0 || files.length > 0) && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await onSubmit(text, files.map((f) => ({ name: f.name, content: f.content })));
      setText("");
      setFiles([]);
      if (textareaRef.current) textareaRef.current.style.height = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className={`w-full text-left ${className}`}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-2xl bg-[#13161C] p-6 transition-[border-color] duration-150 ${
          isDragging ? "border border-[#1D9E75]" : "border border-[rgba(29,158,117,0.25)]"
        }`}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(); }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
          disabled={loading || isRecording}
          placeholder={placeholder}
          rows={4}
          style={{ minHeight: "120px", overflow: "hidden" }}
          className="w-full resize-none bg-transparent font-sans text-[15px] text-[#E8EAF0] placeholder-[#A0A8B8]/35 leading-[1.8] outline-none border-none disabled:opacity-60"
        />

        {/* File chips */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#1D9E75]/10">
            {files.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0D0F14] border border-[#1D9E75]/25 font-sans text-[11px] text-[#A0A8B8]">
                <span className="max-w-[140px] truncate">{f.name}</span>
                <span className="text-[#A0A8B8]/40">{formatSize(f.size)}</span>
                <button onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))} className="text-[#A0A8B8]/40 hover:text-[#E8EAF0] transition-colors">
                  <XSmallIcon />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between mt-4">
          {/* Left */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleRecording}
              disabled={loading}
              aria-label={isRecording ? "Stop" : "Voice input"}
              className={`relative w-9 h-9 rounded-full border flex items-center justify-center transition-colors disabled:opacity-40 ${
                isRecording
                  ? "border-[#1D9E75] bg-[#1D9E75]/12 text-[#5DCAA5]"
                  : "border-white/10 text-[#A0A8B8]/60 hover:border-white/20 hover:text-[#A0A8B8]"
              }`}
            >
              {isRecording && <span className="absolute inset-0 rounded-full bg-[#1D9E75]/20 animate-ping pointer-events-none" />}
              {isRecording ? <StopIcon /> : <MicIcon />}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || files.length >= 3}
              aria-label="Attach files"
              className="w-9 h-9 rounded-full border border-white/10 text-[#A0A8B8]/60 hover:border-white/20 hover:text-[#A0A8B8] flex items-center justify-center transition-colors disabled:opacity-30"
            >
              <PaperclipIcon />
            </button>

            <input ref={fileInputRef} type="file" multiple accept=".pdf,.txt,.doc,.docx,image/*,.md,.csv,.json" className="hidden"
              onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ""; }} />

            {isRecording && <span className="font-sans text-[12px] text-[#5DCAA5] animate-pulse">Listening...</span>}
            {voiceError && !isRecording && <span className="font-sans text-[12px] text-red-400/70">{voiceError}</span>}
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            {text.length > 0 && (
              <span className="font-sans text-[12px] text-[#A0A8B8]/35 tabular-nums">{text.length} chars</span>
            )}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`relative px-6 py-3 rounded-xl font-sans font-medium text-[15px] text-white transition-colors overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed ${
                loading ? "bg-[#1D9E75] animate-pulse cursor-wait" : "bg-[#1D9E75] hover:bg-[#0F6E56]"
              }`}
            >
              {loading ? "Thinking..." : submitLabel}
              {loading && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden">
                  <span className="absolute inset-y-0 left-0 w-2/5 bg-white/40 animate-progress-bar rounded-full" />
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="mt-3 font-sans text-sm text-red-400/80 text-center">{error}</p>}
    </div>
  );
}
