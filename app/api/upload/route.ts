import { NextResponse } from "next/server";
import openai from "@/lib/openai";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const name = url.searchParams.get("name") ?? "file";
  const type = url.searchParams.get("type") ?? "application/octet-stream";

  const buffer = Buffer.from(await request.arrayBuffer());
  if (!buffer.length) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  try {
    const file = new File([buffer], name, { type });
    const uploaded = await openai.files.create({
      file,
      purpose: "assistants",
    });

    return NextResponse.json({
      file_id: uploaded.id,
      name,
      type,
    });
  } catch (err) {
    console.error("[/api/upload] OpenAI error:", err);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 },
    );
  }
}
