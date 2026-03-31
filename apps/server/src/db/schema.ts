import { pgTable, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(), // openai, anthropic, google, elevenlabs, deepgram
  encryptedKey: text("encrypted_key").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const bots = pgTable("bots", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  modelProvider: text("model_provider").notNull(), // openai, anthropic, google
  modelId: text("model_id").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  ttsProvider: text("tts_provider"), // openai, elevenlabs
  ttsVoiceId: text("tts_voice_id"),
  sttProvider: text("stt_provider"), // openai, deepgram
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  botId: text("bot_id").notNull().references(() => bots.id),
  title: text("title").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  role: text("role").notNull(), // user, assistant, system
  content: text("content").notNull(),
  audioUrl: text("audio_url"),
  inputMode: text("input_mode").notNull().default("text"), // text, voice
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
