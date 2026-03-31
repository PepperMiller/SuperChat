"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Phone } from "lucide-react";
import { useApp } from "@/lib/context";
import { getVoiceToken } from "@/lib/api";
import type { WSServerMessage } from "@superchat/shared";

interface BotInfo {
  name: string;
  modelProvider: string;
  ttsProvider: string | null;
  ttsVoiceId: string | null;
  sttProvider: string | null;
  systemPrompt: string;
}

interface TranscriptLine {
  role: "user" | "assistant";
  text: string;
  isFinal: boolean;
}

export function VoiceOverlay({
  conversationId,
  bot,
  onClose,
}: {
  conversationId: string;
  bot: BotInfo;
  onClose: () => void;
}) {
  const { wsSend, wsSubscribe, userId } = useApp();
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [mode, setMode] = useState<"webrtc" | "chained" | null>(null);
  const [status, setStatus] = useState("Connecting...");

  // WebRTC refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  // Chained mode refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Determine mode: use WebRTC if bot uses OpenAI model provider and has no explicit STT/TTS
  const useWebRTC =
    bot.modelProvider === "openai" && !bot.sttProvider && !bot.ttsProvider;

  const startWebRTC = useCallback(async () => {
    setMode("webrtc");
    setStatus("Getting token...");

    try {
      const session = (await getVoiceToken(
        bot.ttsVoiceId || "coral",
        bot.systemPrompt
      )) as { client_secret?: { value?: string } };

      const token = session.client_secret?.value;
      if (!token) {
        setStatus("Failed to get token");
        return;
      }

      setStatus("Connecting...");

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Set up audio playback
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      // Add microphone
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = ms;
      ms.getTracks().forEach((track) => pc.addTrack(track, ms));

      // Data channel for events
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onmessage = (e) => {
        const event = JSON.parse(e.data);
        if (event.type === "response.audio_transcript.delta") {
          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant" && !last.isFinal) {
              return [
                ...prev.slice(0, -1),
                { ...last, text: last.text + event.delta },
              ];
            }
            return [...prev, { role: "assistant", text: event.delta, isFinal: false }];
          });
        }
        if (event.type === "response.audio_transcript.done") {
          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant") {
              return [...prev.slice(0, -1), { ...last, isFinal: true }];
            }
            return prev;
          });
          // Send transcript to server for storage
          wsSend({
            type: "chat:message",
            conversationId,
            content: `[voice transcript stored]`,
          });
        }
        if (
          event.type === "conversation.item.input_audio_transcription.completed"
        ) {
          setTranscript((prev) => [
            ...prev,
            { role: "user", text: event.transcript, isFinal: true },
          ]);
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(
        "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        }
      );

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setStatus("Connected - speak to chat");
    } catch (err) {
      console.error("WebRTC error:", err);
      setStatus("Connection failed");
    }
  }, [bot, conversationId, wsSend]);

  const startChained = useCallback(async () => {
    setMode("chained");
    setStatus("Starting microphone...");

    try {
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = ms;

      const recorder = new MediaRecorder(ms, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;

      wsSend({ type: "voice:start", conversationId });

      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const buffer = await e.data.arrayBuffer();
          const base64 = btoa(
            String.fromCharCode(...new Uint8Array(buffer))
          );
          wsSend({
            type: "voice:audio",
            conversationId,
            audio: base64,
          });
        }
      };

      // Record in 3-second chunks
      recorder.start(3000);
      setStatus("Listening - speak to chat");
    } catch (err) {
      console.error("Microphone error:", err);
      setStatus("Microphone access denied");
    }
  }, [conversationId, wsSend]);

  // Subscribe to voice transcription events (chained mode)
  useEffect(() => {
    return wsSubscribe((msg: WSServerMessage) => {
      if (
        msg.type === "voice:transcription" &&
        msg.conversationId === conversationId
      ) {
        if (msg.isFinal) {
          setTranscript((prev) => [
            ...prev,
            { role: msg.role, text: msg.text, isFinal: true },
          ]);
        }
      }
      if (
        msg.type === "voice:response_audio" &&
        msg.conversationId === conversationId
      ) {
        // Play audio
        const audioData = atob(msg.audio);
        const bytes = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          bytes[i] = audioData.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "audio/mp3" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
        audio.onended = () => URL.revokeObjectURL(url);
      }
    });
  }, [conversationId, wsSubscribe]);

  // Start voice on mount
  useEffect(() => {
    if (useWebRTC) {
      startWebRTC();
    } else {
      startChained();
    }

    return () => {
      // Cleanup
      pcRef.current?.close();
      dcRef.current?.close();
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
    };
  }, [useWebRTC, startWebRTC, startChained]);

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = muted; // toggle
      });
    }
    setMuted(!muted);
  };

  const handleEnd = () => {
    pcRef.current?.close();
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    wsSend({ type: "voice:stop", conversationId });
    onClose();
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-background/95 backdrop-blur">
      {/* Status */}
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm text-muted-foreground">{status}</span>
        {mode && (
          <span className="text-xs text-muted-foreground">
            ({mode === "webrtc" ? "WebRTC" : "Chained"})
          </span>
        )}
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="max-w-2xl mx-auto space-y-3">
          {transcript.map((t, i) => (
            <div
              key={i}
              className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-lg px-4 py-2 max-w-[80%] ${
                  t.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                } ${!t.isFinal ? "opacity-60" : ""}`}
              >
                <p className="text-sm">{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 py-6">
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={toggleMute}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Button
          variant="destructive"
          size="icon"
          className="h-14 w-14 rounded-full"
          onClick={handleEnd}
        >
          <Phone className="h-6 w-6 rotate-[135deg]" />
        </Button>
      </div>
    </div>
  );
}
