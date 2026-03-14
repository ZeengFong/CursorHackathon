import OpenAI from "openai";
import { AI_CONFIG } from "../config";
import { buildBrainDumpPrompt } from "../prompts/brain-dump";
import { BrainDumpRequest, BrainDumpResponse } from "../types";

const client = new OpenAI({ apiKey: AI_CONFIG.apiKey });

export async function processBrainDump(
  request: BrainDumpRequest,
  currentTime: string = new Date().toISOString()
): Promise<BrainDumpResponse> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildBrainDumpPrompt(currentTime) },
    ...request.conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: request.rawText },
  ];

  const completion = await client.chat.completions.create({
    model: AI_CONFIG.openAiModel,
    messages,
    max_tokens: AI_CONFIG.maxTokensBrainDump,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content;
  if (!raw) throw new Error("Empty response from OpenAI");

  return JSON.parse(raw) as BrainDumpResponse;
}
