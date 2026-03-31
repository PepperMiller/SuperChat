import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMProviderInterface, LLMMessage, LLMStreamCallbacks } from "./types.js";

export class GoogleProvider implements LLMProviderInterface {
  async chat(
    messages: LLMMessage[],
    modelId: string,
    apiKey: string,
    callbacks: LLMStreamCallbacks
  ): Promise<void> {
    const genAI = new GoogleGenerativeAI(apiKey);

    // Extract system instruction
    const systemMsg = messages.find((m) => m.role === "system");
    const chatMessages = messages.filter((m) => m.role !== "system");

    const model = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: systemMsg?.content,
    });

    // Convert to Gemini history format
    const history = chatMessages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));

    const lastMessage = chatMessages[chatMessages.length - 1];

    try {
      const chat = model.startChat({ history });
      const result = await chat.sendMessageStream(lastMessage.content);

      let fullText = "";
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullText += text;
          callbacks.onToken(text);
        }
      }
      callbacks.onDone(fullText);
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
