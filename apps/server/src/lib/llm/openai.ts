import OpenAI from "openai";
import type { LLMProviderInterface, LLMMessage, LLMStreamCallbacks } from "./types.js";

export class OpenAIProvider implements LLMProviderInterface {
  async chat(
    messages: LLMMessage[],
    modelId: string,
    apiKey: string,
    callbacks: LLMStreamCallbacks
  ): Promise<void> {
    const client = new OpenAI({ apiKey });

    try {
      const stream = await client.chat.completions.create({
        model: modelId,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      });

      let fullText = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          callbacks.onToken(delta);
        }
      }
      callbacks.onDone(fullText);
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
