import { Router } from "express";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { decrypt } from "../lib/crypto.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// Get ephemeral token for OpenAI Realtime WebRTC
router.post("/token", asyncHandler(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    res.status(401).json({ error: "x-user-id header required" });
    return;
  }

  // Get user's OpenAI key
  const [keyRow] = await db
    .select()
    .from(schema.apiKeys)
    .where(
      and(
        eq(schema.apiKeys.userId, userId),
        eq(schema.apiKeys.provider, "openai")
      )
    );

  if (!keyRow) {
    res.status(400).json({ error: "No OpenAI API key configured" });
    return;
  }

  const openaiKey = decrypt(keyRow.encryptedKey);

  // Request ephemeral token from OpenAI
  const response = await fetch(
    "https://api.openai.com/v1/realtime/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
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

export default router;
