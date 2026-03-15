"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clearCachedTasks } from "@/lib/task-cache";

// ── Local-storage helpers ─────────────────────────────────────────────
function lsGet(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function lsSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
}
function lsBool(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : v === "true";
  } catch { return def; }
}

// ── Inline feedback hook ──────────────────────────────────────────────
function useSaved() {
  const [saved, setSaved] = useState(false);
  const flash = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);
  return [saved, flash] as const;
}

// ── Toggle component ─────────────────────────────────────────────────
function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-4 cursor-pointer group">
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={`w-10 rounded-full transition-colors duration-200 ${
            checked ? "bg-[#1D9E75]" : "bg-white/8"
          }`}
          style={{ height: "22px" }}
        />
        <div
          className="absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200"
          style={{
            width: "18px",
            height: "18px",
            transform: checked ? "translateX(18px)" : "translateX(0)",
          }}
        />
      </div>
      <div>
        <p className="font-sans text-sm text-[#E8EAF0] group-hover:text-white transition-colors">
          {label}
        </p>
        {description && (
          <p className="mt-0.5 font-sans text-[12px] text-[#A0A8B8]/50">{description}</p>
        )}
      </div>
    </label>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────
function Section({ title, children, className = "" }: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section>
      <h2 className="font-sans text-[11px] font-semibold tracking-widest uppercase text-[#A0A8B8]/40 mb-3">
        {title}
      </h2>
      <div className={`bg-[#13161C] border-2 border-[#1D9E75]/8 rounded-xl p-5 flex flex-col gap-5 ${className}`}>
        {children}
      </div>
    </section>
  );
}

// ── SaveButton ────────────────────────────────────────────────────────
function SaveButton({ onClick, loading, saved, label = "Save" }: {
  onClick: () => void;
  loading?: boolean;
  saved: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onClick}
        disabled={loading}
        className="px-5 py-2 bg-[#1D9E75] hover:bg-[#5DCAA5] disabled:opacity-50 text-white font-sans font-medium text-sm rounded-lg transition-colors"
      >
        {loading ? "Saving…" : label}
      </button>
      <span
        className={`font-sans text-sm text-[#5DCAA5] transition-opacity duration-300 ${
          saved ? "opacity-100" : "opacity-0"
        }`}
      >
        Saved ✓
      </span>
    </div>
  );
}

// ── Settings input style ──────────────────────────────────────────────
const INPUT_CLS =
  "w-full bg-[#0D0F14] border-2 border-white/8 focus:border-[#1D9E75]/55 focus:shadow-[0_0_0_3px_rgba(29,158,117,0.07)] rounded-xl py-2.5 px-4 font-sans text-sm text-[#E8EAF0] placeholder-[#A0A8B8]/35 outline-none transition-[border-color,box-shadow] duration-200";

// ── Quick panic URLs ──────────────────────────────────────────────────

// ── Page ──────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();

  // ── Display name (localStorage only) ────────────────────────────────
  const [displayName, setDisplayName] = useState("");
  const [profileSaved, flashProfile] = useSaved();
  const [profileError, setProfileError] = useState("");

  // ── Voice settings ───────────────────────────────────────────────────
  const [voiceEnabled, setVoiceEnabled]     = useState(false);
  const [clarifyEnabled, setClarifyEnabled] = useState(false);
  const [voices, setVoices]                 = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice]   = useState("");
  const [voiceSaved, flashVoice]            = useSaved();

  // ── Panic URL ────────────────────────────────────────────────────────
  const [panicUrl, setPanicUrl]  = useState("https://www.youtube.com/watch?v=jfKfPfyJRdk");
  const [panicSaved, flashPanic] = useSaved();
  const panicInputRef = useRef<HTMLInputElement>(null);

  // ── Calendar prefs ──────────────────────────────────────────────────
  const [autoDate, setAutoDate] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [calSaved, flashCal]    = useSaved();

  // ── Calendar integration ──────────────────────────────────────────
  const [icsSyncing, setIcsSyncing] = useState(false);
  const [calFeedUrl, setCalFeedUrl] = useState<string | null>(null);
  const [feedCopied, setFeedCopied] = useState(false);
  const [calMsg, setCalMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Task archive ───────────────────────────────────────────────────
  const [archivedTasks, setArchivedTasks] = useState<{ id: number; Name: string; category: string; due_date: string | null; created_at: string }[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);

  // ── Danger ──────────────────────────────────────────────────────────
  const [clearMsg, setClearMsg] = useState("");

  // ── Mount: load localStorage values ─────────────────────────────────
  useEffect(() => {
    const brandName = lsGet("BrainDump_display_name", "");
    const clearheadName = lsGet("clearhead_display_name", "");
    setDisplayName(brandName || clearheadName);

    setVoiceEnabled(lsBool("BrainDump_voice_enabled", false));
    setClarifyEnabled(lsBool("BrainDump_clarify_enabled", false));
    setSelectedVoice(lsGet("BrainDump_voice_name", ""));

    setPanicUrl(lsGet("BrainDump_panic_url", "https://www.youtube.com/watch?v=jfKfPfyJRdk"));

    setAutoDate(lsBool("BrainDump_autodate", true));
    setShowPast(lsBool("BrainDump_show_past", false));

    const loadVoices = () => setVoices(window.speechSynthesis?.getVoices() ?? []);
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);

    // Load archived (completed) tasks and calendar feed token from Supabase
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setArchiveLoading(false); return; }
      const { data } = await supabase
        .from("tasks")
        .select("id, Name, category, due_date, created_at")
        .eq("user_id", user.id)
        .eq("completed", true)
        .order("created_at", { ascending: false });
      setArchivedTasks(data ?? []);
      setArchiveLoading(false);

      // Load calendar feed token
      const { data: profile } = await supabase
        .from("profiles")
        .select("calendar_token")
        .eq("id", user.id)
        .single();
      if (profile?.calendar_token) {
        setCalFeedUrl(`${window.location.origin}/api/calendar/feed?token=${profile.calendar_token}`);
      }
    })();

    return () => window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────

  function saveProfile() {
    if (!displayName.trim()) {
      setProfileError("Display name cannot be empty.");
      return;
    }
    setProfileError("");
    lsSet("BrainDump_display_name", displayName.trim());
    lsSet("clearhead_display_name", displayName.trim());
    flashProfile();
  }

  function saveVoice() {
    lsSet("BrainDump_voice_enabled", String(voiceEnabled));
    lsSet("BrainDump_clarify_enabled", String(clarifyEnabled));
    lsSet("BrainDump_voice_name", selectedVoice);
    flashVoice();
  }

  function savePanic() {
    lsSet("BrainDump_panic_url", panicUrl);
    flashPanic();
  }

  function saveCal() {
    lsSet("BrainDump_autodate", String(autoDate));
    lsSet("BrainDump_show_past", String(showPast));
    flashCal();
  }

  async function exportIcs() {
    setIcsSyncing(true);
    setCalMsg(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data } = await supabase
        .from("tasks")
        .select("Name, Description, due_date")
        .eq("user_id", user.id)
        .eq("completed", false)
        .not("due_date", "is", null);
      const tasks = (data ?? []).map((t: Record<string, unknown>) => ({
        name: String(t.Name ?? ""),
        description: typeof t.Description === "string" ? t.Description : null,
        due_date: String(t.due_date ?? "").split("T")[0],
      }));
      if (tasks.length === 0) {
        setCalMsg({ type: "error", text: "No tasks with due dates to export." });
        setIcsSyncing(false);
        return;
      }
      const res = await fetch("/api/calendar/ics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks }),
      });
      if (!res.ok) throw new Error("Failed to generate file");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "braindump-tasks.ics";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setCalMsg({ type: "error", text: "Failed to export .ics file." });
    } finally {
      setIcsSyncing(false);
    }
  }

  async function restoreTask(id: number) {
    const { error } = await supabase.from("tasks").update({ completed: false }).eq("id", id);
    if (!error) setArchivedTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function deleteArchivedTask(id: number) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (!error) setArchivedTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function clearTasks() {
    try { sessionStorage.removeItem("BrainDump_tasks"); } catch {}
    clearCachedTasks();
    setClearMsg("All tasks cleared.");
    setTimeout(() => setClearMsg(""), 2000);
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // If Supabase sign out fails, continue anyway
    } finally {
      try { sessionStorage.clear(); } catch {}
      clearCachedTasks();
      [
        "BrainDump_tasks", "clearhead_display_name",
        "BrainDump_voice_enabled", "BrainDump_display_name",
        "BrainDump_panic_url", "BrainDump_voice_name",
        "BrainDump_autodate", "BrainDump_show_past",
        "BrainDump_clarify_enabled",
      ].forEach((key) => { try { localStorage.removeItem(key); } catch {} });
      router.push("/");
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────
  let panicDomain = "";
  try {
    if (panicUrl) panicDomain = new URL(panicUrl).hostname;
  } catch {}

  return (
    <div className="min-h-screen bg-[#0D0F14]">
      <div className="max-w-xl mx-auto p-6 sm:p-8 py-10">

        {/* Back link */}
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 font-sans text-sm text-[#A0A8B8]/50 hover:text-[#A0A8B8] transition-colors mb-8 group"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 3L5 8l5 5" />
          </svg>
          Back to dashboard
        </button>

        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-[#E8EAF0]">Settings</h1>
          <p className="mt-1 font-sans text-sm text-[#A0A8B8]/50">
            All preferences are saved locally in your browser.
          </p>
        </div>

        <div className="flex flex-col gap-7">

          {/* ── Profile ────────────────────────────────────────────── */}
          <Section title="Profile">
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-xs text-[#A0A8B8]/60">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className={INPUT_CLS}
              />
            </div>

            {profileError && (
              <p className="text-[12px] text-[#E07878] font-sans">{profileError}</p>
            )}

            <SaveButton
              onClick={saveProfile}
              saved={profileSaved}
              label="Save profile"
            />
          </Section>

          {/* ── Voice settings ──────────────────────────────────────── */}
          <Section title="Voice">
            <Toggle
              checked={voiceEnabled}
              onChange={setVoiceEnabled}
              label="Read results aloud"
              description="Speaks your top task after each brain dump."
            />
            <Toggle
              checked={clarifyEnabled}
              onChange={setClarifyEnabled}
              label="Ask clarifying questions after dump"
              description="BrainDump will prompt you with one follow-up question."
            />

            {voices.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-xs text-[#A0A8B8]/60">Voice</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className={INPUT_CLS + " cursor-pointer"}
                  style={{
                    appearance: "none",
                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23A0A8B8' stroke-width='1.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 12px center",
                    backgroundSize: "16px",
                    paddingRight: "36px",
                  }}
                >
                  <option value="">System default</option>
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <SaveButton onClick={saveVoice} saved={voiceSaved} label="Save voice settings" />
          </Section>

          {/* ── Panic button ────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-[11px] font-semibold tracking-widest uppercase text-[#A0A8B8]/40 mb-3">
              Panic button
            </h2>
            <div
              className="bg-[#13161C] rounded-xl p-5 flex flex-col gap-4"
              style={{ border: "2px solid rgba(216,90,48,0.22)" }}
            >
              <div>
                <p className="font-sans text-sm font-medium text-[#E8EAF0]">Your escape hatch</p>
                <p className="mt-0.5 font-sans text-[12px] text-[#A0A8B8]/50">
                  Paste a YouTube video, YouTube playlist, or Spotify playlist URL. Opens as a full-screen player inside the app. Must be a specific video or playlist — not a homepage URL.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <input
                  ref={panicInputRef}
                  type="url"
                  value={panicUrl}
                  onChange={(e) => setPanicUrl(e.target.value)}
                  placeholder="https://..."
                  className={INPUT_CLS}
                />

                {(() => {
                  const isHomepage =
                    panicUrl === "https://youtube.com" ||
                    panicUrl === "https://www.youtube.com" ||
                    panicUrl === "http://youtube.com" ||
                    panicUrl === "youtube.com"

                  const isTikTokOrX =
                    panicUrl.includes("tiktok.com") ||
                    panicUrl.includes("x.com") ||
                    panicUrl.includes("twitter.com")

                  if (isTikTokOrX) return (
                    <p className="font-sans text-[11px] text-[#D85A30]/70 mt-0.5">
                      TikTok and X cannot be embedded in browsers. Use a YouTube or Spotify URL instead.
                    </p>
                  )

                  if (isHomepage) return (
                    <p className="font-sans text-[11px] text-[#EF9F27]/70 mt-0.5">
                      Paste a specific video URL, not the homepage. Example: youtube.com/watch?v=jfKfPfyJRdk
                    </p>
                  )

                  if (panicUrl &&
                      !panicUrl.includes("youtube.com") &&
                      !panicUrl.includes("youtu.be") &&
                      !panicUrl.includes("spotify.com")) return (
                    <p className="font-sans text-[11px] text-[#EF9F27]/70 mt-0.5">
                      Only YouTube and Spotify URLs are supported.
                    </p>
                  )

                  return null
                })()}

                <div className="flex flex-wrap gap-2">
                  {/* Lofi beats — teal accent, recommended default */}
                  {(() => {
                    const lofiUrl = "https://www.youtube.com/watch?v=jfKfPfyJRdk"
                    const isActive = panicUrl === lofiUrl
                    return (
                      <button
                        onClick={() => {
                          setPanicUrl(lofiUrl)
                          lsSet("BrainDump_panic_url", lofiUrl)
                          flashPanic()
                        }}
                        className={`font-sans text-[11px] px-3 py-1.5 rounded-lg border-2 transition-colors ${
                          isActive
                            ? "border-teal/40 text-teal-light bg-teal/10"
                            : "border-white/8 text-muted/50 hover:text-muted hover:border-white/14"
                        }`}
                      >
                        Lofi beats
                      </button>
                    )
                  })()}

                  {/* Nature sounds */}
                  {(() => {
                    const natureUrl = "https://www.youtube.com/watch?v=eKFTSSKCzWA"
                    const isActive = panicUrl === natureUrl
                    return (
                      <button
                        onClick={() => {
                          setPanicUrl(natureUrl)
                          lsSet("BrainDump_panic_url", natureUrl)
                          flashPanic()
                        }}
                        className={`font-sans text-[11px] px-3 py-1.5 rounded-lg border-2 transition-colors ${
                          isActive
                            ? "border-[#D85A30]/40 text-[#D85A30] bg-[#D85A30]/10"
                            : "border-white/8 text-muted/50 hover:text-muted hover:border-white/14"
                        }`}
                      >
                        Nature sounds
                      </button>
                    )
                  })()}

                  {/* Custom — clears input and focuses it */}
                  <button
                    onClick={() => {
                      setPanicUrl("")
                      setTimeout(() => panicInputRef.current?.focus(), 0)
                    }}
                    className="font-sans text-[11px] px-3 py-1.5 rounded-lg border-2 transition-colors border-white/8 text-muted/50 hover:text-muted hover:border-white/14"
                  >
                    Custom
                  </button>
                </div>

                {panicDomain && (
                  <p className="font-sans text-[11.5px] text-[#A0A8B8]/40">
                    Opens →{" "}
                    <span className="text-[#A0A8B8]/65">{panicDomain}</span>
                  </p>
                )}
              </div>

              <SaveButton onClick={savePanic} saved={panicSaved} />
            </div>
          </section>

          {/* ── Calendar preferences ────────────────────────────────── */}
          <Section title="Calendar">
            <Toggle
              checked={autoDate}
              onChange={setAutoDate}
              label="Auto-detect dates in my dumps"
              description='Parses phrases like "tomorrow" or "next week" from task text.'
            />
            <Toggle
              checked={showPast}
              onChange={setShowPast}
              label="Show past tasks on calendar"
              description="Keeps completed tasks visible on past dates."
            />
            <SaveButton onClick={saveCal} saved={calSaved} label="Save preferences" />
          </Section>

          {/* ── Calendar integration ──────────────────────────────────── */}
          <Section title="Calendar integration">
            <div>
              <p className="font-sans text-sm text-[#E8EAF0]">Add tasks to your calendar</p>
              <p className="mt-0.5 font-sans text-[12px] text-[#A0A8B8]/50">
                Pending tasks with due dates appear as 9 PM – 11:59 PM events. Done tasks are excluded.
              </p>
            </div>

            <button
              onClick={exportIcs}
              disabled={icsSyncing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1D9E75] hover:bg-[#5DCAA5] disabled:opacity-50 text-white font-sans font-medium text-sm rounded-lg transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 3v10m0 0-3-3m3 3 3-3M4 15h12" />
              </svg>
              {icsSyncing ? "Exporting…" : "Download .ics"}
            </button>

            {/* Live subscription URL */}
            {calFeedUrl && (
              <div className="flex flex-col gap-2">
                <div>
                  <p className="font-sans text-sm text-[#E8EAF0]">Live calendar subscription</p>
                  <p className="mt-0.5 font-sans text-[12px] text-[#A0A8B8]/50">
                    Subscribe in Apple Calendar, Google Calendar, or any app that supports ICS feeds. Updates automatically — done tasks disappear, new tasks appear.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={calFeedUrl}
                    className={INPUT_CLS + " text-[12px] truncate"}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(calFeedUrl);
                      setFeedCopied(true);
                      setTimeout(() => setFeedCopied(false), 2000);
                    }}
                    className="shrink-0 px-3 py-2 border-2 border-white/8 hover:border-[#1D9E75]/30 text-[#A0A8B8] hover:text-[#5DCAA5] font-sans text-xs rounded-lg transition-colors"
                  >
                    {feedCopied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="font-sans text-[11px] text-[#A0A8B8]/35">
                  Apple Calendar: File → New Calendar Subscription → paste URL.
                  Google Calendar: Other calendars (+) → From URL → paste. Keep this URL private.
                </p>
              </div>
            )}

            {calMsg && (
              <p className={`font-sans text-[12.5px] px-3 py-2 rounded-lg ${
                calMsg.type === "error"
                  ? "text-[#E07878] bg-[#D85A30]/8 border-2 border-[#D85A30]/15"
                  : "text-[#5DCAA5] bg-[#1D9E75]/8 border-2 border-[#1D9E75]/15"
              }`}>
                {calMsg.text}
              </p>
            )}
          </Section>

          {/* ── Task archive ─────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-[11px] font-semibold tracking-widest uppercase text-[#A0A8B8]/40 mb-3">
              Task archive
            </h2>
            <div className="bg-[#13161C] border-2 border-[#1D9E75]/8 rounded-xl p-5 flex flex-col gap-3">
              <div>
                <p className="font-sans text-sm text-[#E8EAF0]">Completed tasks</p>
                <p className="mt-0.5 font-sans text-[12px] text-[#A0A8B8]/50">
                  Restore a task to send it back to Triage, or delete it for good.
                </p>
              </div>

              {archiveLoading ? (
                <p className="py-6 text-center font-sans text-xs text-[#A0A8B8]/20">Loading…</p>
              ) : archivedTasks.length === 0 ? (
                <p className="py-6 text-center font-sans text-xs text-[#A0A8B8]/20 italic">
                  Nothing here yet. Tasks you finish will show up here.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(29,158,117,0.15) transparent" }}>
                  {archivedTasks.map((t) => {
                    const catColor =
                      t.category === "now" ? "#1D9E75"
                      : t.category === "later" ? "#EF9F27"
                      : "#A0A8B8";

                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#0D0F14] border-2 border-white/6 group"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: catColor }}
                        />
                        <span className="font-sans text-sm text-[#E8EAF0]/70 leading-snug flex-1 truncate">
                          {t.Name}
                        </span>
                        {t.due_date && (
                          <span className="font-sans text-[11px] text-[#A0A8B8]/30 shrink-0 tabular-nums">
                            {t.due_date.slice(0, 10)}
                          </span>
                        )}
                        <button
                          onClick={() => restoreTask(t.id)}
                          className="text-[10px] font-sans text-[#A0A8B8]/40 hover:text-[#5DCAA5] transition-colors px-2 py-0.5 rounded hover:bg-[#1D9E75]/8"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => deleteArchivedTask(t.id)}
                          className="text-[10px] font-sans text-[#A0A8B8]/40 hover:text-[#D85A30] transition-colors px-2 py-0.5 rounded hover:bg-[#D85A30]/8"
                        >
                          Delete
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {archivedTasks.length > 0 && (
                <p className="font-sans text-[11px] text-[#A0A8B8]/30 tabular-nums">
                  {archivedTasks.length} task{archivedTasks.length !== 1 ? "s" : ""} archived
                </p>
              )}
            </div>
          </section>

          {/* ── Danger zone ─────────────────────────────────────────── */}
          <section>
            <h2 className="font-sans text-[11px] font-semibold tracking-widest uppercase text-[#A0A8B8]/40 mb-3">
              Danger zone
            </h2>
            <div
              className="bg-[#13161C] rounded-xl p-5 flex flex-col gap-4"
              style={{ border: "2px solid rgba(216,90,48,0.18)" }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-sans text-sm text-[#E8EAF0]">Clear all tasks</p>
                  <p className="font-sans text-[12px] text-[#A0A8B8]/45 mt-0.5">
                    Removes tasks from this session. Cannot be undone.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {clearMsg && (
                    <span className="font-sans text-[12px] text-[#5DCAA5] whitespace-nowrap">{clearMsg}</span>
                  )}
                  <button
                    onClick={clearTasks}
                    className="px-4 py-2 font-sans text-sm text-[#D85A30] border-2 border-[#D85A30]/25 rounded-lg hover:bg-[#D85A30]/8 transition-colors whitespace-nowrap"
                  >
                    Clear tasks
                  </button>
                </div>
              </div>

              <div className="h-px bg-white/6" />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-sans text-sm text-[#E8EAF0]">Sign out</p>
                  <p className="font-sans text-[12px] text-[#A0A8B8]/45 mt-0.5">
                    Clears your session and returns to the home page.
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 font-sans text-sm text-[#D85A30] border-2 border-[#D85A30]/25 rounded-lg hover:bg-[#D85A30]/8 transition-colors whitespace-nowrap shrink-0"
                >
                  Sign out
                </button>
              </div>
            </div>
          </section>

        </div>

        <div className="h-16" />
      </div>
    </div>
  );
}