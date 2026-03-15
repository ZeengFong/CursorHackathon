import type { Category } from "@/app/dashboard/page";

/** Category → color mapping, used in CalendarMode, WeekStripCard, settings archive, etc. */
export const CATEGORY_COLOR: Record<Category, string> = {
  now: "#1D9E75",
  later: "#EF9F27",
  drop: "#A0A8B8",
};

/** Source style mapping, used in TriageMode, CompletedCard, etc. */
export const SOURCE_STYLE: Record<string, { label: string; color: string }> = {
  voice: { label: "voice", color: "#5DCAA5" },
  file:  { label: "file",  color: "#EF9F27" },
  typed: { label: "typed", color: "#A0A8B8" },
};

/** localStorage key constants — single source of truth */
export const STORAGE_KEYS = {
  tasks: "clearhead_tasks",
  displayName: "clearhead_display_name",
  brandDisplayName: "BrainDump_display_name",
  voiceEnabled: "BrainDump_voice_enabled",
  clarifyEnabled: "BrainDump_clarify_enabled",
  voiceName: "BrainDump_voice_name",
  panicUrl: "BrainDump_panic_url",
  autoDate: "BrainDump_autodate",
  showPast: "BrainDump_show_past",
  currentUser: "BrainDump_current_user",
} as const;
