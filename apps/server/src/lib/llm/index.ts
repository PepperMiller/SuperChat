import type { LLMProvider } from "@superchat/shared";
import type { LLMProviderInterface } from "./types.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { GoogleProvider } from "./google.js";

const providers: Record<LLMProvider, LLMProviderInterface> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  google: new GoogleProvider(),
};

export function getLLMProvider(provider: LLMProvider): LLMProviderInterface {
  return providers[provider];
}

export type { LLMMessage, LLMStreamCallbacks, LLMProviderInterface } from "./types.js";
