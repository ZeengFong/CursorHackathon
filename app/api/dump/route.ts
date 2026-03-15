import { NextResponse } from "next/server";
import openai from "@/lib/openai";
import { TRIAGE_SYSTEM_PROMPT } from "@/lib/prompts";
import type OpenAI from "openai";

export const maxDuration = 60;

export async function POST(request: Request) {
  // Accept both new { text, files } shape and legacy { dump } shape
  const body = await request.json();
  const content: string = body.text ?? body.dump ?? "";
  const files: { name: string; type: string; file_id: string }[] =
    body.files ?? [];

  const textContent = content.trim();
  if (!textContent && files.length === 0) {
    return NextResponse.json({ tasks: [], text: "" });
  }

  try {
    // Build multi-part content for the user message
    const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];

    if (textContent) {
      parts.push({ type: "text", text: textContent });
    }

    for (const file of files) {
      parts.push({
        type: "file",
        file: { file_id: file.file_id },
      } as OpenAI.Chat.ChatCompletionContentPart);
    }

    // If we only have text (no files), keep it simple
    const userContent =
      parts.length === 1 && parts[0].type === "text" ? textContent : parts;

    const completion = await openai.chat.completions.create({
      model: files.length > 0 ? "gpt-5" : "gpt-5",
      messages: [
        { role: "system", content: TRIAGE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      max_tokens: 16384,
      temperature: 0.3,
      response_format: { type: "json_object" },
      reasoning: { effort: "medium" },
      text: { format: { type: "text", verbosity: "low" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // Clean up uploaded files
    for (const file of files) {
      openai.files.delete(file.file_id).catch(() => {});
    }

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { tasks?: unknown[] };

    // Ensure every task has an id and valid fields
    const tasks = (parsed.tasks ?? []).map((t: unknown) => {
      const task = t as Record<string, unknown>;
      return {
        id:
          typeof task.id === "string" && task.id
            ? task.id
            : crypto.randomUUID(),
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
    // Clean up files on error too
    for (const file of files) {
      openai.files.delete(file.file_id).catch(() => {});
    }
    return NextResponse.json({
      tasks: [],
      error: "Failed to process dump. Please try again.",
    });
  }
}
