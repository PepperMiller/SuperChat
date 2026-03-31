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
  // encrypted_key never sent to client
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

// ── API request/response types ──

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

export interface SendMessageRequest {
  content: string;
  inputMode?: InputMode;
}

export interface SetApiKeyRequest {
  provider: ApiKeyProvider;
  key: string;
}

// ── WebSocket event types ──

export interface WSChatMessage {
  type: "chat:message";
  conversationId: string;
  content: string;
}

export interface WSChatResponse {
  type: "chat:response";
  conversationId: string;
  messageId: string;
  delta: string;
  done: boolean;
}

export interface WSChatError {
  type: "chat:error";
  conversationId: string;
  error: string;
}

export interface WSVoiceStart {
  type: "voice:start";
  conversationId: string;
}

export interface WSVoiceAudio {
  type: "voice:audio";
  conversationId: string;
  audio: string; // base64
}

export interface WSVoiceTranscription {
  type: "voice:transcription";
  conversationId: string;
  role: "user" | "assistant";
  text: string;
  isFinal: boolean;
}

export interface WSVoiceResponseAudio {
  type: "voice:response_audio";
  conversationId: string;
  audio: string; // base64
}

export interface WSVoiceStop {
  type: "voice:stop";
  conversationId: string;
}

export type WSClientMessage =
  | WSChatMessage
  | WSVoiceStart
  | WSVoiceAudio
  | WSVoiceStop;

export type WSServerMessage =
  | WSChatResponse
  | WSChatError
  | WSVoiceTranscription
  | WSVoiceResponseAudio
  | WSVoiceStop;
