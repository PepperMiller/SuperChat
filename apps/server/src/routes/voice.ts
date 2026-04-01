import { Router } from "express";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { decrypt } from "../lib/crypto.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { transcribeAudio } from "../lib/voice/stt.js";
import { synthesizeSpeech } from "../lib/voice/tts.js";
import type { STTProvider, TTSProvider } from "@superchat/shared";

const router = Router();

async function getUserApiKey(
  userId: string,
  provider: string
): Promise<string | null> {
  const [row] = await db
    .select()
    .from(schema.apiKeys)
    .where(
      and(eq(schema.apiKeys.userId, userId), eq(schema.apiKeys.provider, provider))
    );
  if (!row) return null;
  return decrypt(row.encryptedKey);
}

// Get ephemeral token for OpenAI Realtime WebRTC
router.post("/token", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    res.status(401).json({ error: "x-user-id header required" });
    return;
  }

  const openaiKey = await getUserApiKey(userId, "openai");
  if (!openaiKey) {
    res.status(400).json({ error: "No OpenAI API key configured" });
    return;
  }

  const response = await fetch(
    "https://api.openai.com/v1/realtime/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: req.body.model || "gpt-4o-realtime-preview",
        voice: req.body.voice || "coral",
        modalities: ["audio", "text"],
        instructions: req.body.instructions || "You are a helpful assistant.",
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    res.status(response.status).json({ error });
    return;
  }

  const session = await response.json();
  res.json(session);
}));

// Get ephemeral token for Google Gemini Live API
router.post("/google-token", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    res.status(401).json({ error: "x-user-id header required" });
    return;
  }

  const googleKey = await getUserApiKey(userId, "google");
  if (!googleKey) {
    res.status(400).json({ error: "No Google API key configured" });
    return;
  }

  // Generate ephemeral token via Google AI API
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${req.body.model || "gemini-2.5-flash"}:generateEphemeralToken?key=${googleKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ephemeralToken: {
          uses: 1,
          expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
      }),
    }
  );

  if (!response.ok) {
    // Fallback: return the API key directly for client-side use
    // (The ephemeral token API may not be available in all SDK versions)
    res.json({ apiKey: googleKey, model: req.body.model || "gemini-2.5-flash" });
    return;
  }

  const token = await response.json();
  res.json(token);
}));

// Transcribe audio (STT) — for chained voice fallback
router.post("/transcribe", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    res.status(401).json({ error: "x-user-id header required" });
    return;
  }

  const { audio, conversationId } = req.body;
  if (!audio) {
    res.status(400).json({ error: "audio (base64) is required" });
    return;
  }

  // Get bot's STT config from conversation
  let sttProvider: STTProvider = "openai";
  if (conversationId) {
    const [convo] = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId));
    if (convo) {
      const [bot] = await db
        .select()
        .from(schema.bots)
        .where(eq(schema.bots.id, convo.botId));
      if (bot?.sttProvider) {
        sttProvider = bot.sttProvider as STTProvider;
      }
    }
  }

  const keyProvider = sttProvider === "deepgram" ? "deepgram" : "openai";
  const apiKey = await getUserApiKey(userId, keyProvider);
  if (!apiKey) {
    res.status(400).json({ error: `No ${keyProvider} API key configured` });
    return;
  }

  const audioBuffer = Buffer.from(audio, "base64");
  const result = await transcribeAudio(audioBuffer, sttProvider, apiKey);

  res.json({ text: result.text });
}));

// Synthesize speech (TTS) — for chained voice fallback
router.post("/synthesize", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    res.status(401).json({ error: "x-user-id header required" });
    return;
  }

  const { text, conversationId } = req.body;
  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  // Get bot's TTS config from conversation
  let ttsProvider: TTSProvider = "openai";
  let voiceId = "coral";
  if (conversationId) {
    const [convo] = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId));
    if (convo) {
      const [bot] = await db
        .select()
        .from(schema.bots)
        .where(eq(schema.bots.id, convo.botId));
      if (bot?.ttsProvider) ttsProvider = bot.ttsProvider as TTSProvider;
      if (bot?.ttsVoiceId) voiceId = bot.ttsVoiceId;
    }
  }

  const keyProvider = ttsProvider === "elevenlabs" ? "elevenlabs" : "openai";
  const apiKey = await getUserApiKey(userId, keyProvider);
  if (!apiKey) {
    res.status(400).json({ error: `No ${keyProvider} API key configured` });
    return;
  }

  const audioBuffer = await synthesizeSpeech(text, ttsProvider, voiceId, apiKey);

  res.set("Content-Type", "audio/mpeg");
  res.send(audioBuffer);
}));

export default router;
