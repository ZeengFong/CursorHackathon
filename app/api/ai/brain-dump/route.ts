import { NextRequest, NextResponse } from "next/server";
import { processBrainDump } from "@/lib/ai/services/brain-dump";
import { BrainDumpRequest } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  let body: BrainDumpRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.rawText || typeof body.rawText !== "string" || body.rawText.trim() === "") {
    return NextResponse.json({ error: "rawText is required and must be a non-empty string" }, { status: 400 });
  }

  try {
    const result = await processBrainDump(body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
