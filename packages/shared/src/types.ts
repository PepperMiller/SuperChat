// ── Provider enums ──

export type LLMProvider = "openai" | "anthropic" | "google";
export type TTSProvider = "openai" | "elevenlabs";
export type STTProvider = "openai" | "deepgram";
export type ApiKeyProvider = LLMProvider | "elevenlabs" | "deepgram";

export type MessageRole = "user" | "assistant" | "system";
export type InputMode = "text" | "voice";

// ── Database row types ──

export interface User {
  id: string;
  name: string;
  createdAt: Date;
}

export interface ApiKey {
  id: string;
  userId: string;
  provider: ApiKeyProvider;
  createdAt: Date;
}

export interface Bot {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  modelProvider: LLMProvider;
  modelId: string;
  systemPrompt: string;
  ttsProvider: TTSProvider | null;
  ttsVoiceId: string | null;
  sttProvider: STTProvider | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  botId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  audioUrl: string | null;
  inputMode: InputMode;
  createdAt: Date;
}

// ── API request types ──

export interface CreateBotRequest {
  name: string;
  modelProvider: LLMProvider;
  modelId: string;
  systemPrompt: string;
  ttsProvider?: TTSProvider;
  ttsVoiceId?: string;
  sttProvider?: STTProvider;
  avatarUrl?: string;
}

export interface UpdateBotRequest extends Partial<CreateBotRequest> {}

export interface CreateConversationRequest {
  botId: string;
  title?: string;
}

export interface SetApiKeyRequest {
  provider: ApiKeyProvider;
  key: string;
}

// ── SSE chat types ──

export interface SSEChatDelta {
  delta: string;
  done: false;
}

export interface SSEChatDone {
  done: true;
  messageId: string;
}

export interface SSEChatError {
  error: string;
  done: true;
}

export type SSEChatEvent = SSEChatDelta | SSEChatDone | SSEChatError;

// ── REST request types ──

export interface SendChatRequest {
  conversationId: string;
  content: string;
}

export interface SaveTranscriptRequest {
  conversationId: string;
  messages: Array<{
    role: MessageRole;
    content: string;
    inputMode: InputMode;
  }>;
}

export interface TranscribeRequest {
  audio: string; // base64
  conversationId: string;
}

export interface SynthesizeRequest {
  text: string;
  conversationId: string;
}
