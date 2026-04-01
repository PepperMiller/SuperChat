import { Router } from "express";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { decrypt } from "../lib/crypto.js";
import { getLLMProvider } from "../lib/llm/index.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import type { LLMProvider } from "@superchat/shared";

const router = Router();

async function getApiKey(
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

// POST /api/chat/send — SSE streaming chat
router.post("/send", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    res.status(401).json({ error: "x-user-id header required" });
    return;
  }

  const { conversationId, content } = req.body;
  if (!conversationId || !content) {
    res.status(400).json({ error: "conversationId and content are required" });
    return;
  }

  // Get conversation and bot
  const [convo] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, conversationId));

  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const [bot] = await db
    .select()
    .from(schema.bots)
    .where(eq(schema.bots.id, convo.botId));

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  // Save user message
  const userMsgId = uuid();
  await db.insert(schema.messages).values({
    id: userMsgId,
    conversationId,
    role: "user",
    content,
    inputMode: "text",
  });

  // Get API key
  const apiKey = await getApiKey(userId, bot.modelProvider);
  if (!apiKey) {
    res.status(400).json({ error: `No ${bot.modelProvider} API key configured` });
    return;
  }

  // Build message history
  const history = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(schema.messages.createdAt);

  const llmMessages = [
    { role: "system" as const, content: bot.systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
  ];

  // Set up SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const assistantMsgId = uuid();
  const provider = getLLMProvider(bot.modelProvider as LLMProvider);

  let aborted = false;
  req.on("close", () => {
    aborted = true;
  });

  await provider.chat(llmMessages, bot.modelId, apiKey, {
    onToken(delta) {
      if (aborted) return;
      res.write(`data: ${JSON.stringify({ delta, done: false })}\n\n`);
    },
    async onDone(fullText) {
      // Save assistant message
      await db.insert(schema.messages).values({
        id: assistantMsgId,
        conversationId,
        role: "assistant",
        content: fullText,
        inputMode: "text",
      });

      // Update conversation title if first message
      if (history.length <= 1) {
        const title =
          content.slice(0, 100) + (content.length > 100 ? "..." : "");
        await db
          .update(schema.conversations)
          .set({ title })
          .where(eq(schema.conversations.id, conversationId));
      }

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ done: true, messageId: assistantMsgId })}\n\n`);
        res.end();
      }
    },
    onError(err) {
      if (!aborted) {
        res.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
        res.end();
      }
    },
  });
}));

// POST /api/chat/save-transcript — Save messages from client-direct voice sessions
router.post("/save-transcript", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    res.status(401).json({ error: "x-user-id header required" });
    return;
  }

  const { conversationId, messages } = req.body;
  if (!conversationId || !messages?.length) {
    res.status(400).json({ error: "conversationId and messages are required" });
    return;
  }

  // Verify conversation belongs to user
  const [convo] = await db
    .select()
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, conversationId),
        eq(schema.conversations.userId, userId)
      )
    );

  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  // Insert messages
  for (const msg of messages) {
    await db.insert(schema.messages).values({
      id: uuid(),
      conversationId,
      role: msg.role,
      content: msg.content,
      inputMode: msg.inputMode || "voice",
    });
  }

  // Update title if first messages
  const existing = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId));

  if (existing.length <= messages.length) {
    const firstUserMsg = messages.find((m: { role: string }) => m.role === "user");
    if (firstUserMsg) {
      const title =
        firstUserMsg.content.slice(0, 100) +
        (firstUserMsg.content.length > 100 ? "..." : "");
      await db
        .update(schema.conversations)
        .set({ title })
        .where(eq(schema.conversations.id, conversationId));
    }
  }

  res.json({ ok: true });
}));

export default router;
