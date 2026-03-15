import openai from "@/lib/openai";
import type OpenAI from "openai";
import { LETTER_SYSTEM_PROMPT } from "@/lib/prompts";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { tasks } = await req.json();

    if (!tasks || tasks.length === 0) {
      return new Response("No tasks provided", { status: 400 });
    }

    // Build a clear task list for the prompt
    const lines = tasks
      .map(
        (t: { text: string; category: string }) =>
          `[${t.category.toUpperCase()}] ${t.text}`,
      )
      .join("\n");

    const userMsg = `My brain dump has been triaged into these tasks:\n\n${lines}`;

    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      stream: true,
      max_tokens: 16384,
      temperature: 0.75,
      messages: [
        { role: "system", content: LETTER_SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      reasoning: { effort: "medium" },
      text: { format: { type: "text", verbosity: "low" } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any) as any as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>;

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("/api/letter error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate letter" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
