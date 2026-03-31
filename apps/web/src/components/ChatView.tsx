"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, Mic, MicOff, Square } from "lucide-react";
import { useApp } from "@/lib/context";
import { getMessages, getBot, getConversation } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { WSServerMessage } from "@superchat/shared";
import { VoiceOverlay } from "./VoiceOverlay";

interface MessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  inputMode: "text" | "voice";
  createdAt: string;
}

interface BotInfo {
  id: string;
  name: string;
  modelProvider: string;
  modelId: string;
  ttsProvider: string | null;
  ttsVoiceId: string | null;
  sttProvider: string | null;
  systemPrompt: string;
}

export function ChatView({ conversationId }: { conversationId: string }) {
  const { wsSend, wsSubscribe } = useApp();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [bot, setBot] = useState<BotInfo | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load messages and bot info
  useEffect(() => {
    getMessages(conversationId).then((msgs) =>
      setMessages(msgs as unknown as MessageItem[])
    );
    getConversation(conversationId).then(async (c) => {
      const convo = c as unknown as { botId: string };
      const b = await getBot(convo.botId);
      setBot(b as unknown as BotInfo);
    });
  }, [conversationId]);

  // Subscribe to WS messages
  useEffect(() => {
    return wsSubscribe((msg: WSServerMessage) => {
      if (msg.type === "chat:response" && msg.conversationId === conversationId) {
        if (msg.done) {
          setStreaming(false);
          setStreamingContent("");
          // Reload messages to get the saved version
          getMessages(conversationId).then((msgs) =>
            setMessages(msgs as unknown as MessageItem[])
          );
        } else {
          setStreamingContent((prev) => prev + msg.delta);
        }
      }
      if (msg.type === "chat:error" && msg.conversationId === conversationId) {
        setStreaming(false);
        setStreamingContent("");
      }
      if (
        msg.type === "voice:transcription" &&
        msg.conversationId === conversationId &&
        msg.isFinal
      ) {
        // Reload messages when a voice transcription is final
        getMessages(conversationId).then((msgs) =>
          setMessages(msgs as unknown as MessageItem[])
        );
      }
    });
  }, [conversationId, wsSubscribe]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const sendMessage = useCallback(() => {
    const content = input.trim();
    if (!content || streaming) return;

    // Optimistic update
    setMessages((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        role: "user",
        content,
        inputMode: "text",
        createdAt: new Date().toISOString(),
      },
    ]);

    setInput("");
    setStreaming(true);
    setStreamingContent("");

    wsSend({
      type: "chat:message",
      conversationId,
      content,
    });
  }, [input, streaming, conversationId, wsSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 md:px-6">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{bot?.name?.[0] || "B"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate">{bot?.name || "Loading..."}</h2>
          <p className="text-xs text-muted-foreground">
            {bot?.modelProvider} / {bot?.modelId}
          </p>
        </div>
        <Button
          variant={voiceMode ? "destructive" : "outline"}
          size="sm"
          onClick={() => setVoiceMode(!voiceMode)}
        >
          {voiceMode ? (
            <>
              <MicOff className="mr-1 h-4 w-4" /> End Voice
            </>
          ) : (
            <>
              <Mic className="mr-1 h-4 w-4" /> Voice
            </>
          )}
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4 md:px-6">
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback>{bot?.name?.[0] || "B"}</AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "rounded-lg px-4 py-2 max-w-[80%]",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.inputMode === "voice" && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    <Mic className="mr-1 h-3 w-3" /> voice
                  </Badge>
                )}
              </div>
            </div>
          ))}

          {/* Streaming response */}
          {streaming && streamingContent && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback>{bot?.name?.[0] || "B"}</AvatarFallback>
              </Avatar>
              <div className="rounded-lg px-4 py-2 max-w-[80%] bg-muted">
                <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
              </div>
            </div>
          )}

          {streaming && !streamingContent && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback>{bot?.name?.[0] || "B"}</AvatarFallback>
              </Avatar>
              <div className="rounded-lg px-4 py-2 bg-muted">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Voice overlay */}
      {voiceMode && bot && (
        <VoiceOverlay
          conversationId={conversationId}
          bot={bot}
          onClose={() => setVoiceMode(false)}
        />
      )}

      {/* Input */}
      {!voiceMode && (
        <div className="border-t px-4 py-3 md:px-6">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[44px] max-h-[120px] resize-none"
              rows={1}
              disabled={streaming}
            />
            <Button
              onClick={sendMessage}
              size="icon"
              disabled={!input.trim() || streaming}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
