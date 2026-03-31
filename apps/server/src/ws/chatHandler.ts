import type { WebSocket } from "ws";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { decrypt } from "../lib/crypto.js";
import { getLLMProvider } from "../lib/llm/index.js";
import { transcribeAudio } from "../lib/voice/stt.js";
import { synthesizeSpeech } from "../lib/voice/tts.js";
import type {
  WSClientMessage,
  WSServerMessage,
  LLMProvider,
  STTProvider,
  TTSProvider,
} from "@superchat/shared";

interface SocketState {
  userId: string;
}

export function handleConnection(ws: WebSocket, userId: string) {
  const state: SocketState = { userId };

  ws.on("message", async (raw) => {
    try {
      const msg: WSClientMessage = JSON.parse(raw.toString());
      switch (msg.type) {
        case "chat:message":
          await handleChatMessage(ws, state, msg);
          break;
        case "voice:start":
          // Acknowledge voice session start
          break;
        case "voice:audio":
          await handleVoiceAudio(ws, state, msg);
          break;
        case "voice:stop":
          send(ws, { type: "voice:stop", conversationId: msg.conversationId });
          break;
      }
    } catch (err) {
      console.error("WS message error:", err);
    }
  });
}

function send(ws: WebSocket, msg: WSServerMessage) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

async function getApiKey(
  userId: string,
  provider: string
): Promise<string | null> {
  const [row] = await db
    .select()
    .from(schema.apiKeys)
    .where(
      and(
        eq(schema.apiKeys.userId, userId),
        eq(schema.apiKeys.provider, provider as "openai" | "anthropic" | "google" | "elevenlabs" | "deepgram")
      )
    );
  if (!row) return null;
  return decrypt(row.encryptedKey);
}

async function handleChatMessage(
  ws: WebSocket,
  state: SocketState,
  msg: { conversationId: string; content: string }
) {
  // Get conversation and bot
  const [convo] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, msg.conversationId));

  if (!convo) {
    send(ws, {
      type: "chat:error",
      conversationId: msg.conversationId,
      error: "Conversation not found",
    });
    return;
  }

  const [bot] = await db
    .select()
    .from(schema.bots)
    .where(eq(schema.bots.id, convo.botId));

  if (!bot) {
    send(ws, {
      type: "chat:error",
      conversationId: msg.conversationId,
      error: "Bot not found",
    });
    return;
  }

  // Save user message
  const userMsgId = uuid();
  await db.insert(schema.messages).values({
    id: userMsgId,
    conversationId: msg.conversationId,
    role: "user",
    content: msg.content,
    inputMode: "text",
  });

  // Get API key
  const apiKey = await getApiKey(state.userId, bot.modelProvider);
  if (!apiKey) {
    send(ws, {
      type: "chat:error",
      conversationId: msg.conversationId,
      error: `No ${bot.modelProvider} API key configured`,
    });
    return;
  }

  // Build message history
  const history = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, msg.conversationId))
    .orderBy(schema.messages.createdAt);

  const llmMessages = [
    { role: "system" as const, content: bot.systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
  ];

  // Stream response
  const assistantMsgId = uuid();
  const provider = getLLMProvider(bot.modelProvider as LLMProvider);

  await provider.chat(llmMessages, bot.modelId, apiKey, {
    onToken(delta) {
      send(ws, {
        type: "chat:response",
        conversationId: msg.conversationId,
        messageId: assistantMsgId,
        delta,
        done: false,
      });
    },
    async onDone(fullText) {
      // Save assistant message
      await db.insert(schema.messages).values({
        id: assistantMsgId,
        conversationId: msg.conversationId,
        role: "assistant",
        content: fullText,
        inputMode: "text",
      });

      send(ws, {
        type: "chat:response",
        conversationId: msg.conversationId,
        messageId: assistantMsgId,
        delta: "",
        done: true,
      });

      // Update conversation title if first message
      if (history.length <= 1) {
        const title =
          msg.content.slice(0, 100) + (msg.content.length > 100 ? "..." : "");
        await db
          .update(schema.conversations)
          .set({ title })
          .where(eq(schema.conversations.id, msg.conversationId));
      }
    },
    onError(err) {
      send(ws, {
        type: "chat:error",
        conversationId: msg.conversationId,
        error: err.message,
      });
    },
  });
}

async function handleVoiceAudio(
  ws: WebSocket,
  state: SocketState,
  msg: { conversationId: string; audio: string }
) {
  const [convo] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, msg.conversationId));

  if (!convo) return;

  const [bot] = await db
    .select()
    .from(schema.bots)
    .where(eq(schema.bots.id, convo.botId));

  if (!bot || !bot.sttProvider || !bot.ttsProvider) return;

  // STT
  const sttKey = await getApiKey(
    state.userId,
    bot.sttProvider === "openai" ? "openai" : "deepgram"
  );
  if (!sttKey) return;

  const audioBuffer = Buffer.from(msg.audio, "base64");
  const sttResult = await transcribeAudio(
    audioBuffer,
    bot.sttProvider as STTProvider,
    sttKey
  );

  if (!sttResult.text.trim()) return;

  // Send user transcription
  send(ws, {
    type: "voice:transcription",
    conversationId: msg.conversationId,
    role: "user",
    text: sttResult.text,
    isFinal: true,
  });

  // Save user message
  const userMsgId = uuid();
  await db.insert(schema.messages).values({
    id: userMsgId,
    conversationId: msg.conversationId,
    role: "user",
    content: sttResult.text,
    inputMode: "voice",
  });

  // LLM
  const llmKey = await getApiKey(state.userId, bot.modelProvider);
  if (!llmKey) return;

  const history = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, msg.conversationId))
    .orderBy(schema.messages.createdAt);

  const llmMessages = [
    { role: "system" as const, content: bot.systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
  ];

  const provider = getLLMProvider(bot.modelProvider as LLMProvider);
  const assistantMsgId = uuid();

  await provider.chat(llmMessages, bot.modelId, llmKey, {
    onToken(delta) {
      // Send partial transcription for assistant
      send(ws, {
        type: "voice:transcription",
        conversationId: msg.conversationId,
        role: "assistant",
        text: delta,
        isFinal: false,
      });
    },
    async onDone(fullText) {
      // Save assistant message
      await db.insert(schema.messages).values({
        id: assistantMsgId,
        conversationId: msg.conversationId,
        role: "assistant",
        content: fullText,
        inputMode: "voice",
      });

      // Send final transcription
      send(ws, {
        type: "voice:transcription",
        conversationId: msg.conversationId,
        role: "assistant",
        text: fullText,
        isFinal: true,
      });

      // TTS
      const ttsKey = await getApiKey(
        state.userId,
        bot.ttsProvider === "openai" ? "openai" : "elevenlabs"
      );
      if (!ttsKey || !bot.ttsVoiceId) return;

      const audioBuffer = await synthesizeSpeech(
        fullText,
        bot.ttsProvider as TTSProvider,
        bot.ttsVoiceId,
        ttsKey
      );

      send(ws, {
        type: "voice:response_audio",
        conversationId: msg.conversationId,
        audio: audioBuffer.toString("base64"),
      });
    },
    onError(err) {
      send(ws, {
        type: "chat:error",
        conversationId: msg.conversationId,
        error: err.message,
      });
    },
  });
}
