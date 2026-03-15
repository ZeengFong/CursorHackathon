import OpenAI from "openai";
import { AI_CONFIG } from "../config";
import { buildBrainDumpPrompt } from "../prompts/brain-dump";
import { BrainDumpRequest, BrainDumpResponse } from "../types";

const client = new OpenAI({ apiKey: AI_CONFIG.apiKey });

export async function processBrainDump(
  request: BrainDumpRequest,
  currentTime: string = new Date().toISOString()
): Promise<BrainDumpResponse> {
  const files = request.files ?? [];
  const hasFiles = files.length > 0;

  // Build user content: multi-part if files are attached, plain string otherwise
  let userContent: string | OpenAI.Chat.ChatCompletionContentPart[];
  if (hasFiles) {
    const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
    if (request.rawText.trim()) {
      parts.push({ type: "text", text: request.rawText });
    }
    for (const file of files) {
      if (!file.data) continue;
      if (file.type.startsWith("image/")) {
        parts.push({
          type: "image_url",
          image_url: { url: file.data, detail: "auto" },
        });
      } else {
        parts.push({
          type: "file",
          file: { filename: file.name, file_data: file.data },
        } as OpenAI.Chat.ChatCompletionContentPart);
      }
    }
    userContent = parts;
  } else {
    userContent = request.rawText;
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildBrainDumpPrompt(currentTime) },
    ...request.conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userContent },
  ];

  const completion = await client.chat.completions.create({
    model: hasFiles ? "gpt-4o" : AI_CONFIG.openAiModel,
    messages,
    max_tokens: AI_CONFIG.maxTokensBrainDump,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content;
  if (!raw) throw new Error("Empty response from OpenAI");

  return JSON.parse(raw) as BrainDumpResponse;
}
