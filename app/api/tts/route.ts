import { NextRequest, NextResponse } from "next/server";
import { generateSpeech } from "@/lib/tts/service";
import { TTSRequest } from "@/lib/tts/types";

const MAX_CHARS = 500;

export async function POST(req: NextRequest) {
  let body: TTSRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.text || typeof body.text !== "string" || body.text.trim() === "") {
    return NextResponse.json({ error: "text is required and must be a non-empty string" }, { status: 400 });
  }

  if (body.text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `text must be ${MAX_CHARS} characters or fewer` },
      { status: 400 }
    );
  }

  try {
    const result = await generateSpeech(body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
