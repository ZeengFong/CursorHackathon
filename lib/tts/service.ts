import { TTS_CONFIG } from "./config";
import { TTSRequest, TTSResponse } from "./types";

export async function generateSpeech(request: TTSRequest): Promise<TTSResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const voice =
    (request.voiceId && TTS_CONFIG.voicePresets[request.voiceId]) ||
    request.voiceId ||
    TTS_CONFIG.defaultVoice;

  const model = request.model ?? TTS_CONFIG.defaultModel;

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: request.text,
      voice,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI TTS error ${response.status}: ${error}`);
  }

  const buffer = await response.arrayBuffer();
  const audioBase64 = Buffer.from(buffer).toString("base64");

  const durationEstimate = Math.round(request.text.length / 15);

  return {
    audioBase64,
    contentType: "audio/mpeg",
    durationEstimate,
  };
}
