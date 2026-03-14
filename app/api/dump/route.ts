import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Accept both new { text, files } shape and legacy { dump } shape
  const body = await request.json();
  const content: string = body.text ?? body.dump ?? "";
  const files: { name: string; content: string }[] = body.files ?? [];

  // TODO: replace with a real LLM API call.

  const id = () => crypto.randomUUID();

  const tasks = [
    {
      id: id(),
      text: "Address the most pressing item from your dump",
      category: "now",
      source: "from dump",
    },
    {
      id: id(),
      text: "Schedule time to handle the pending concern",
      category: "later",
      source: "from dump",
    },
    ...(files.length > 0
      ? [{ id: id(), text: `Review contents of ${files[0].name}`, category: "later", source: "from file" }]
      : []),
    {
      id: id(),
      text: "Release what is outside your control today",
      category: "drop",
      source: "from dump",
    },
  ];

  return NextResponse.json({ tasks, text: content });
}
