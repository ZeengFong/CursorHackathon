import { TTS_CONFIG } from "./config";
import { TTSRequest, TTSResponse } from "./types";

export async function generateSpeech(request: TTSRequest): Promise<TTSResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const resolvedVoiceId =
    (request.voiceId && TTS_CONFIG.voicePresets[request.voiceId]) ||
    request.voiceId ||
    TTS_CONFIG.defaultVoiceId;

  const model = request.model ?? TTS_CONFIG.defaultModel;

  const response = await fetch(`${TTS_CONFIG.apiUrl}/${resolvedVoiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: request.text,
      model_id: model,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${error}`);
  }

  const buffer = await response.arrayBuffer();
  const audioBase64 = Buffer.from(buffer).toString("base64");

  // Rough estimate: ~15 chars per second of speech
  const durationEstimate = Math.round(request.text.length / 15);

  return {
    audioBase64,
    contentType: "audio/mpeg",
    durationEstimate,
  };
}
