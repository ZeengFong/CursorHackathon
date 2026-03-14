export const TTS_CONFIG = {
  defaultVoiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel — calm, warm voice
  defaultModel: "eleven_flash_v2_5",
  voicePresets: {
    calm: "21m00Tcm4TlvDq8ikWAM",     // Rachel
    friendly: "EXAVITQu4vr4xnSDxMaL", // Bella
    neutral: "ErXwobaYiN019PkySvjV",   // Antoni
  } as Record<string, string>,
  apiUrl: "https://api.elevenlabs.io/v1/text-to-speech",
};
