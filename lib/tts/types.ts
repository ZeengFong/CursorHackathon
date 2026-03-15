export interface TTSRequest {
  text: string;
  voiceId?: string;
  model?: string;
}

export interface TTSResponse {
  audioBase64: string;
  contentType: string;
  durationEstimate?: number;
}
