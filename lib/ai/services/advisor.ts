import OpenAI from "openai";
import { AI_CONFIG } from "../config";
import { buildAdvisorPrompt } from "../prompts/advisor";
import { AdvisorRequest, AdvisorResponse } from "../types";

const client = new OpenAI({ apiKey: AI_CONFIG.apiKey });

export async function getAdvisorResponse(
  request: AdvisorRequest
): Promise<AdvisorResponse> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildAdvisorPrompt(request.tasks, request.currentTime),
    },
    ...request.conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: request.userMessage },
  ];

  const completion = await client.chat.completions.create({
    model: AI_CONFIG.openAiModel,
    messages,
    max_tokens: AI_CONFIG.maxTokensAdvisor,
    response_format: { type: "json_object" },
    reasoning: { effort: "minimal" },
    text: { format: { type: "text", verbosity: "medium" } },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  const raw = completion.choices[0].message.content;
  if (!raw) throw new Error("Empty response from OpenAI");

  return JSON.parse(raw) as AdvisorResponse;
}
