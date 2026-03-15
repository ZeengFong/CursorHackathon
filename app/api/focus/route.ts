import { NextResponse } from "next/server";
import openai from "@/lib/openai";
import { FOCUS_SYSTEM_PROMPT } from "@/lib/prompts";

const FALLBACK_STEPS = [
  "Open the relevant file or tool to get started",
  "Complete the first small concrete action",
  "Work through the main body of the task",
  "Review what you have done so far",
  "Save, send, or close out the task",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { task } = body as { task: string };

    if (!task || task.trim().length === 0) {
      return NextResponse.json({ steps: FALLBACK_STEPS });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: FOCUS_SYSTEM_PROMPT },
        { role: "user", content: `Task: ${task}` },
      ],
      max_tokens: 16384,
      temperature: 0.3,
      response_format: { type: "json_object" },
      reasoning: { effort: "medium" },
      text: { format: { type: "text", verbosity: "low" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { steps?: unknown[] };

    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      return NextResponse.json({ steps: FALLBACK_STEPS });
    }

    // Ensure exactly 5 steps
    const steps = parsed.steps.slice(0, 5).map(String);
    while (steps.length < 5) {
      steps.push(FALLBACK_STEPS[steps.length]);
    }

    return NextResponse.json({ steps });
  } catch (error) {
    console.error("[/api/focus] OpenAI error:", error);
    return NextResponse.json({ steps: FALLBACK_STEPS });
  }
}
