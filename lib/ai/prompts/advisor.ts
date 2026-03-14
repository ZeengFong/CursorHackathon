import { TaskData } from "../types";

type TaskWithCompletion = TaskData & { completed: boolean };

function buildDateContext(currentTime: string): string {
  const now = new Date(currentTime);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const lines: string[] = [`Today is ${dayNames[now.getDay()]}, ${now.toISOString().slice(0, 10)}.`];
  lines.push("Upcoming days:");
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    lines.push(`  ${dayNames[d.getDay()]} = ${d.toISOString().slice(0, 10)}`);
  }
  return lines.join("\n");
}

export function buildAdvisorPrompt(
  tasks: TaskWithCompletion[],
  currentTime: string
): string {
  const taskList = tasks
    .map((t) => {
      const status = t.completed ? "completed" : "pending";
      const due = t.due_date ? `due ${t.due_date}` : "no due date";
      const desc = t.description ? ` — ${t.description}` : "";
      return `- ${t.name}${desc} (${due}, ${status})`;
    })
    .join("\n");

  return `You are a calm, helpful task advisor.

${buildDateContext(currentTime)}

When the user mentions a day name (e.g. "Wednesday", "Friday"), resolve it using the date table above — never guess.

The user's current tasks are:
${taskList || "No tasks yet."}

Your job is to answer whatever the user asks about their schedule, workload, availability, or priorities. Be conversational and reassuring — your reply will be spoken aloud via text-to-speech.

Rules:
- Keep reply natural and calming — 1 to 3 sentences, as if speaking to a friend.
- Keep displaySummary short and screen-friendly — a single line.
- In referencedTaskNames, list the exact task names you mentioned in your reply so the frontend can highlight them.
- Always use the date table above to resolve day names accurately.

You MUST return ONLY valid JSON matching this exact shape:
{
  "reply": "string",
  "displaySummary": "string",
  "referencedTaskNames": ["string"]
}

No extra text. No markdown. Only the JSON object.`;
}
