import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { task } = await request.json();

  // TODO: replace with a real API call 
  // context-specific micro-steps for the given task.
  const truncated = task ? String(task).slice(0, 50) : "this task";

  const steps = [
    `Open the document or context you need for: "${truncated}"`,
    "Identify the single first action completable in under 5 minutes",
    "Start — commit to that first action only",
    "Complete one full section or milestone",
    "Note what remains before closing the session",
  ];

  return NextResponse.json({ steps });
}
