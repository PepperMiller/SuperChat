import Anthropic from "@anthropic-ai/sdk";
import type { LLMProviderInterface, LLMMessage, LLMStreamCallbacks } from "./types.js";

export class AnthropicProvider implements LLMProviderInterface {
  async chat(
    messages: LLMMessage[],
    modelId: string,
    apiKey: string,
    callbacks: LLMStreamCallbacks
  ): Promise<void> {
    const client = new Anthropic({ apiKey });

    // Extract system message
    const systemMsg = messages.find((m) => m.role === "system");
    const chatMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    try {
      const stream = client.messages.stream({
        model: modelId,
        max_tokens: 4096,
        system: systemMsg?.content,
        messages: chatMessages,
      });

      let fullText = "";
      stream.on("text", (text) => {
        fullText += text;
        callbacks.onToken(text);
      });

      await stream.finalMessage();
      callbacks.onDone(fullText);
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
