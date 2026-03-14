import { NextResponse } from "next/server";
import openai from "@/lib/openai";
import { RESET_SYSTEM_PROMPT } from "@/lib/prompts";

const FALLBACK = "Take a breath. You've identified what matters — that's enough for now.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { q1, q2, q3 } = body as {
      q1: string;
      q2: string;
      q3: number;
      ts?: number;
    };

    const userMessage = [
      q1 ? `What would make today complete: "${q1}"` : "They didn't specify what would make today complete.",
      q2 ? `What they're letting go of: "${q2}"` : "They didn't say what they're letting go.",
      `Body feeling score: ${q3}/5`,
    ].join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: RESET_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    const reflection = completion.choices[0]?.message?.content?.trim() || FALLBACK;

    return NextResponse.json({ reflection });
  } catch (error) {
    console.error("[/api/reset] OpenAI error:", error);
    return NextResponse.json({ reflection: FALLBACK });
  }
}
