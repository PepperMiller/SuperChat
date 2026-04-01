import "dotenv/config";
import express from "express";
import cors from "cors";

import usersRouter from "./routes/users.js";
import botsRouter from "./routes/bots.js";
import conversationsRouter from "./routes/conversations.js";
import apikeysRouter from "./routes/apikeys.js";
import voiceRouter from "./routes/voice.js";
import chatRouter from "./routes/chat.js";
import { initDb } from "./db/seed.js";

// Initialize database tables
initDb();

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
}));
app.use(express.json({ limit: "50mb" }));

// REST routes
app.use("/api/users", usersRouter);
app.use("/api/bots", botsRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/api-keys", apikeysRouter);
app.use("/api/voice", voiceRouter);
app.use("/api/chat", chatRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Global error handler for async route errors
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Route error:", err.message);
    res.status(500).json({ error: err.message });
  }
);

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`SuperChat server running on http://localhost:${PORT}`);
});
