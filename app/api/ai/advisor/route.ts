import { NextRequest, NextResponse } from "next/server";
import { getAdvisorResponse } from "@/lib/ai/services/advisor";
import { AdvisorRequest } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  let body: AdvisorRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.userMessage || typeof body.userMessage !== "string" || body.userMessage.trim() === "") {
    return NextResponse.json({ error: "userMessage is required and must be a non-empty string" }, { status: 400 });
  }

  if (!Array.isArray(body.tasks)) {
    return NextResponse.json({ error: "tasks must be an array" }, { status: 400 });
  }

  try {
    const result = await getAdvisorResponse(body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
