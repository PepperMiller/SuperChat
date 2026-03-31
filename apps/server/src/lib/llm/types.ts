export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMStreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: Error) => void;
}

export interface LLMProviderInterface {
  chat(
    messages: LLMMessage[],
    modelId: string,
    apiKey: string,
    callbacks: LLMStreamCallbacks
  ): Promise<void>;
}
