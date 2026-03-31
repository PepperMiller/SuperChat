import { Router } from "express";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// List bots for user
router.get("/", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    res.status(401).json({ error: "x-user-id header required" });
    return;
  }

  const userBots = await db
    .select()
    .from(schema.bots)
    .where(eq(schema.bots.userId, userId));

  res.json(userBots);
}));

// Get single bot
router.get("/:id", asyncHandler(async (req, res) => {
  const [bot] = await db
    .select()
    .from(schema.bots)
    .where(eq(schema.bots.id, req.params.id));

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  res.json(bot);
}));

// Create bot
router.post("/", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    res.status(401).json({ error: "x-user-id header required" });
    return;
  }

  const {
    name,
    modelProvider,
    modelId,
    systemPrompt,
    ttsProvider,
    ttsVoiceId,
    sttProvider,
    avatarUrl,
  } = req.body;

  if (!name || !modelProvider || !modelId || !systemPrompt) {
    res.status(400).json({ error: "name, modelProvider, modelId, and systemPrompt are required" });
    return;
  }

  const id = uuid();
  await db.insert(schema.bots).values({
    id,
    userId,
    name,
    modelProvider,
    modelId,
    systemPrompt,
    ttsProvider: ttsProvider ?? null,
    ttsVoiceId: ttsVoiceId ?? null,
    sttProvider: sttProvider ?? null,
    avatarUrl: avatarUrl ?? null,
  });

  const [bot] = await db
    .select()
    .from(schema.bots)
    .where(eq(schema.bots.id, id));

  res.json(bot);
}));

// Update bot
router.put("/:id", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  const { id } = req.params;

  await db
    .update(schema.bots)
    .set(req.body)
    .where(and(eq(schema.bots.id, id), eq(schema.bots.userId, userId)));

  const [bot] = await db
    .select()
    .from(schema.bots)
    .where(eq(schema.bots.id, id));

  res.json(bot);
}));

// Delete bot
router.delete("/:id", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  await db
    .delete(schema.bots)
    .where(and(eq(schema.bots.id, req.params.id), eq(schema.bots.userId, userId)));

  res.json({ ok: true });
}));

export default router;
