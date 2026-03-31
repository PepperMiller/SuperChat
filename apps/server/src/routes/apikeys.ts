import { Router } from "express";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { encrypt } from "../lib/crypto.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// List API keys (without actual key values)
router.get("/", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    res.status(401).json({ error: "x-user-id header required" });
    return;
  }

  const keys = await db
    .select({
      id: schema.apiKeys.id,
      userId: schema.apiKeys.userId,
      provider: schema.apiKeys.provider,
      createdAt: schema.apiKeys.createdAt,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.userId, userId));

  res.json(keys);
}));

// Set API key (upsert)
router.post("/", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    res.status(401).json({ error: "x-user-id header required" });
    return;
  }

  const { provider, key } = req.body;
  if (!provider || !key) {
    res.status(400).json({ error: "provider and key are required" });
    return;
  }

  // Delete existing key for this provider
  await db
    .delete(schema.apiKeys)
    .where(
      and(
        eq(schema.apiKeys.userId, userId),
        eq(schema.apiKeys.provider, provider)
      )
    );

  const id = uuid();
  const encryptedKey = encrypt(key);

  await db.insert(schema.apiKeys).values({
    id,
    userId,
    provider,
    encryptedKey,
  });

  res.json({ id, provider, createdAt: new Date() });
}));

// Delete API key
router.delete("/:id", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;

  await db
    .delete(schema.apiKeys)
    .where(
      and(
        eq(schema.apiKeys.id, req.params.id),
        eq(schema.apiKeys.userId, userId)
      )
    );

  res.json({ ok: true });
}));

export default router;
