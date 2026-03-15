import { NextResponse } from "next/server";
import openai from "@/lib/openai";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const uploaded = await openai.files.create({
      file,
      purpose: "assistants",
    });

    return NextResponse.json({
      file_id: uploaded.id,
      name: file.name,
      type: file.type || "application/octet-stream",
    });
  } catch (err) {
    console.error("[/api/upload] OpenAI error:", err);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
