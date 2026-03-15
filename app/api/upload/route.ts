import { NextResponse } from "next/server";
import openai from "@/lib/openai";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const { path, name, type } = await request.json();

  // Download from Supabase Storage
  const { data, error } = await supabaseServer.storage.from("uploads").download(path);
  if (error || !data) {
    return NextResponse.json({ error: "File not found in storage" }, { status: 400 });
  }

  try {
    // Upload to OpenAI
    const file = new File([data], name, { type });
    const uploaded = await openai.files.create({
      file,
      purpose: "assistants",
    });

    // Cleanup from Supabase Storage
    supabaseServer.storage.from("uploads").remove([path]).catch(() => {});

    return NextResponse.json({
      file_id: uploaded.id,
      name,
      type,
    });
  } catch (err) {
    console.error("[/api/upload] OpenAI error:", err);
    // Cleanup on error too
    supabaseServer.storage.from("uploads").remove([path]).catch(() => {});
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 },
    );
  }
}
