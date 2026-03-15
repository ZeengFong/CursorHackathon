export interface TaskData {
  name: string;
  description: string | null;
  created_at: string | null;
  due_date: string;
}

export interface TaskRemoval {
  name: string;
  reason: string;
}

export interface BrainDumpRequest {
  rawText: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  files?: { name: string; type: string; file_id: string }[];
}

export interface BrainDumpResponse {
  tasks: TaskData[];
  removals: TaskRemoval[];
  clarifyingQuestion: string | null;
  ttsText: string;
  isComplete: boolean;
}

export interface AdvisorRequest {
  userMessage: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  tasks: (TaskData & { completed: boolean })[];
  currentTime: string;
}

export interface AdvisorAction {
  type: "add" | "complete" | "reschedule" | "delete";
  taskName: string;
  dueDate?: string | null;
}

export interface AdvisorResponse {
  reply: string;
  displaySummary: string;
  referencedTaskNames: string[];
  actions: AdvisorAction[];
  needsConfirmation: boolean;
}
