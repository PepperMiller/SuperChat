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

// Users
export const createUser = (name: string) =>
  request<{ id: string; name: string }>("/api/users", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const getUser = (id: string) =>
  request<{ id: string; name: string }>(`/api/users/${id}`);

// Bots
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

// Conversations
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

// API Keys
export const listApiKeys = () =>
  request<Array<Record<string, unknown>>>("/api/api-keys");

export const setApiKey = (provider: string, key: string) =>
  request<Record<string, unknown>>("/api/api-keys", {
    method: "POST",
    body: JSON.stringify({ provider, key }),
  });

export const deleteApiKey = (id: string) =>
  request<{ ok: boolean }>(`/api/api-keys/${id}`, { method: "DELETE" });

// Voice
export const getVoiceToken = (voice?: string, instructions?: string) =>
  request<Record<string, unknown>>("/api/voice/token", {
    method: "POST",
    body: JSON.stringify({ voice, instructions }),
  });
