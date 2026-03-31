import { Router } from "express";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

router.post("/", asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const id = uuid();
  await db.insert(schema.users).values({ id, name });

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id));

  res.json(user);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, req.params.id));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
}));

export default router;
