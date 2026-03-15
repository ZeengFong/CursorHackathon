import type { Task } from "@/app/dashboard/page";

const CACHE_KEY = "clearhead_tasks";

export function getCachedTasks(): Task[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Task[];
  } catch {
    return null;
  }
}

export function setCachedTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(tasks));
  } catch { /* quota exceeded or private browsing */ }
}

export function clearCachedTasks(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}
