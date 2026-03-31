import OpenAI from "openai";
import type { STTProvider } from "@superchat/shared";

export interface STTResult {
  text: string;
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  provider: STTProvider,
  apiKey: string
): Promise<STTResult> {
  switch (provider) {
    case "openai":
      return transcribeOpenAI(audioBuffer, apiKey);
    case "deepgram":
      return transcribeDeepgram(audioBuffer, apiKey);
    default:
      throw new Error(`Unsupported STT provider: ${provider}`);
  }
}

async function transcribeOpenAI(
  audioBuffer: Buffer,
  apiKey: string
): Promise<STTResult> {
  const client = new OpenAI({ apiKey });

  const file = new File([new Uint8Array(audioBuffer)], "audio.webm", { type: "audio/webm" });
  const result = await client.audio.transcriptions.create({
    model: "whisper-1",
    file,
  });

  return { text: result.text };
}

async function transcribeDeepgram(
  audioBuffer: Buffer,
  apiKey: string
): Promise<STTResult> {
  const response = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "audio/webm",
      },
      body: new Uint8Array(audioBuffer),
    }
  );

  if (!response.ok) {
    throw new Error(`Deepgram error: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    results: {
      channels: Array<{
        alternatives: Array<{ transcript: string }>;
      }>;
    };
  };

  const transcript =
    data.results.channels[0]?.alternatives[0]?.transcript ?? "";
  return { text: transcript };
}
