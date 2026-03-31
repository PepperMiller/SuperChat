import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { parse } from "url";

import usersRouter from "./routes/users.js";
import botsRouter from "./routes/bots.js";
import conversationsRouter from "./routes/conversations.js";
import apikeysRouter from "./routes/apikeys.js";
import voiceRouter from "./routes/voice.js";
import { handleConnection } from "./ws/chatHandler.js";
import { initDb } from "./db/seed.js";

// Initialize database tables
initDb();

const app = express();
const server = createServer(app);

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

// Catch unhandled rejections so the server doesn't crash
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

// WebSocket
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const { query } = parse(req.url || "", true);
  const userId = query.userId as string;

  if (!userId) {
    ws.close(4001, "userId query param required");
    return;
  }

  console.log(`WS connected: user=${userId}`);
  handleConnection(ws, userId);

  ws.on("close", () => {
    console.log(`WS disconnected: user=${userId}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`SuperChat server running on http://localhost:${PORT}`);
});
