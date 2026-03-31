import { Router } from "express";
import { db, schema } from "../db/index.js";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// List conversations for user
router.get("/", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    res.status(401).json({ error: "x-user-id header required" });
    return;
  }

  const convos = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.userId, userId))
    .orderBy(desc(schema.conversations.updatedAt));

  res.json(convos);
}));

// Get single conversation
router.get("/:id", asyncHandler(async (req, res) => {
  const [convo] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, req.params.id));

  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.json(convo);
}));

// Create conversation
router.post("/", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    res.status(401).json({ error: "x-user-id header required" });
    return;
  }

  const { botId, title } = req.body;
  if (!botId) {
    res.status(400).json({ error: "botId is required" });
    return;
  }

  const id = uuid();
  await db.insert(schema.conversations).values({
    id,
    userId,
    botId,
    title: title || "New Conversation",
  });

  const [convo] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, id));

  res.json(convo);
}));

// Get messages for a conversation
router.get("/:id/messages", asyncHandler(async (req, res) => {
  const msgs = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, req.params.id))
    .orderBy(schema.messages.createdAt);

  res.json(msgs);
}));

// Delete conversation
router.delete("/:id", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;

  // Delete messages first
  await db
    .delete(schema.messages)
    .where(eq(schema.messages.conversationId, req.params.id));

  await db
    .delete(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, req.params.id),
        eq(schema.conversations.userId, userId)
      )
    );

  res.json({ ok: true });
}));

export default router;
