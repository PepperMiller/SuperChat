import type { SSEChatEvent } from "@superchat/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function getHeaders(): Record<string, string> {
  const userId =
    typeof window !== "undefined"
      ? localStorage.getItem("superchat_user_id") || ""
      : "";
  return {
    "Content-Type": "application/json",
    "x-user-id": userId,
  };
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ── Users ──

export const createUser = (name: string) =>
  request<{ id: string; name: string }>("/api/users", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const getUser = (id: string) =>
  request<{ id: string; name: string }>(`/api/users/${id}`);

// ── Bots ──

export const listBots = () =>
  request<Array<Record<string, unknown>>>("/api/bots");

export const getBot = (id: string) =>
  request<Record<string, unknown>>(`/api/bots/${id}`);

export const createBot = (data: Record<string, unknown>) =>
  request<Record<string, unknown>>("/api/bots", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateBot = (id: string, data: Record<string, unknown>) =>
  request<Record<string, unknown>>(`/api/bots/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteBot = (id: string) =>
  request<{ ok: boolean }>(`/api/bots/${id}`, { method: "DELETE" });

// ── Conversations ──

export const listConversations = () =>
  request<Array<Record<string, unknown>>>("/api/conversations");

export const getConversation = (id: string) =>
  request<Record<string, unknown>>(`/api/conversations/${id}`);

export const createConversation = (botId: string, title?: string) =>
  request<Record<string, unknown>>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ botId, title }),
  });

export const getMessages = (conversationId: string) =>
  request<Array<Record<string, unknown>>>(
    `/api/conversations/${conversationId}/messages`
  );

export const deleteConversation = (id: string) =>
  request<{ ok: boolean }>(`/api/conversations/${id}`, { method: "DELETE" });

// ── API Keys ──

export const listApiKeys = () =>
  request<Array<Record<string, unknown>>>("/api/api-keys");

export const setApiKey = (provider: string, key: string) =>
  request<Record<string, unknown>>("/api/api-keys", {
    method: "POST",
    body: JSON.stringify({ provider, key }),
  });

export const deleteApiKey = (id: string) =>
  request<{ ok: boolean }>(`/api/api-keys/${id}`, { method: "DELETE" });

// ── Chat (SSE streaming) ──

export interface ChatCallbacks {
  onDelta: (delta: string) => void;
  onDone: (messageId: string) => void;
  onError: (error: string) => void;
}

export function sendChatMessage(
  conversationId: string,
  content: string,
  callbacks: ChatCallbacks
): AbortController {
  const controller = new AbortController();

  fetch(`${API_URL}/api/chat/send`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ conversationId, content }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        callbacks.onError(err.error || res.statusText);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        callbacks.onError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events: split on double newline
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6);
          try {
            const event: SSEChatEvent = JSON.parse(json);
            if ("error" in event) {
              callbacks.onError(event.error);
            } else if (event.done) {
              callbacks.onDone(event.messageId);
            } else {
              callbacks.onDelta(event.delta);
            }
          } catch {
            // skip malformed events
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        callbacks.onError(err.message);
      }
    });

  return controller;
}

// ── Voice ──

export const getVoiceToken = (voice?: string, instructions?: string, model?: string) =>
  request<Record<string, unknown>>("/api/voice/token", {
    method: "POST",
    body: JSON.stringify({ voice, instructions, model }),
  });

export const getGoogleVoiceToken = (model?: string) =>
  request<Record<string, unknown>>("/api/voice/google-token", {
    method: "POST",
    body: JSON.stringify({ model }),
  });

export const transcribeAudio = (audio: string, conversationId: string) =>
  request<{ text: string }>("/api/voice/transcribe", {
    method: "POST",
    body: JSON.stringify({ audio, conversationId }),
  });

export async function synthesizeSpeech(
  text: string,
  conversationId: string
): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/voice/synthesize`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ text, conversationId }),
  });
  if (!res.ok) {
    throw new Error("TTS synthesis failed");
  }
  return res.blob();
}

export const saveTranscript = (
  conversationId: string,
  messages: Array<{ role: string; content: string; inputMode?: string }>
) =>
  request<{ ok: boolean }>("/api/chat/save-transcript", {
    method: "POST",
    body: JSON.stringify({ conversationId, messages }),
  });
