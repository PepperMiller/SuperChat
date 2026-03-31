import OpenAI from "openai";
import type { TTSProvider } from "@superchat/shared";

export async function synthesizeSpeech(
  text: string,
  provider: TTSProvider,
  voiceId: string,
  apiKey: string
): Promise<Buffer> {
  switch (provider) {
    case "openai":
      return synthesizeOpenAI(text, voiceId, apiKey);
    case "elevenlabs":
      return synthesizeElevenLabs(text, voiceId, apiKey);
    default:
      throw new Error(`Unsupported TTS provider: ${provider}`);
  }
}

async function synthesizeOpenAI(
  text: string,
  voiceId: string,
  apiKey: string
): Promise<Buffer> {
  const client = new OpenAI({ apiKey });

  const response = await client.audio.speech.create({
    model: "tts-1",
    voice: voiceId as "alloy" | "ash" | "coral" | "echo" | "sage",
    input: text,
    response_format: "mp3",
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function synthesizeElevenLabs(
  text: string,
  voiceId: string,
  apiKey: string
): Promise<Buffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs error: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
