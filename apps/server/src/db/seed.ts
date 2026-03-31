import { db } from "./index.js";
import { sql } from "drizzle-orm";

export async function initDb() {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  await db.execute(sql`CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    provider TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  await db.execute(sql`CREATE TABLE IF NOT EXISTS bots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    avatar_url TEXT,
    model_provider TEXT NOT NULL,
    model_id TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    tts_provider TEXT,
    tts_voice_id TEXT,
    stt_provider TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  await db.execute(sql`CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    bot_id TEXT NOT NULL REFERENCES bots(id),
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  await db.execute(sql`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    audio_url TEXT,
    input_mode TEXT NOT NULL DEFAULT 'text',
    created_at TEXT NOT NULL
  )`);

  console.log("Database tables initialized");
}
