import { NextResponse } from "next/server";
import openai from "@/lib/openai";
import { TRIAGE_SYSTEM_PROMPT } from "@/lib/prompts";

export async function POST(request: Request) {
  // Accept both new { text, files } shape and legacy { dump } shape
  const body = await request.json();
  const content: string = body.text ?? body.dump ?? "";
  const files: { name: string; content: string }[] = body.files ?? [];

  // Build the user message: dump text + any file contents appended
  let userMessage = content.trim();
  if (files.length > 0) {
    const fileSection = files
      .map((f) => `[File: ${f.name}]\n${f.content}`)
      .join("\n\n");
    userMessage = `${userMessage}\n\n--- Attached files ---\n${fileSection}`;
  }

  if (!userMessage) {
    return NextResponse.json({ tasks: [], text: "" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: TRIAGE_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1024,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { tasks?: unknown[] };

    // Ensure every task has an id and valid fields
    const tasks = (parsed.tasks ?? []).map((t: unknown) => {
      const task = t as Record<string, unknown>;
      return {
        id: typeof task.id === "string" && task.id ? task.id : crypto.randomUUID(),
        text: String(task.text ?? ""),
        category: ["now", "later", "drop"].includes(task.category as string)
          ? task.category
          : "later",
        status: "pending",
        source: task.source === "file" ? "file" : "typed",
        due_date: typeof task.due_date === "string" ? task.due_date : null,
      };
    });

    return NextResponse.json({ tasks, text: content });
  } catch (err) {
    console.error("[/api/dump] OpenAI error:", err);
    return NextResponse.json({ tasks: [], error: "Failed to process dump. Please try again." });
  }
}
