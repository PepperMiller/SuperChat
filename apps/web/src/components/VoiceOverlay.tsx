"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Phone } from "lucide-react";
import {
  getVoiceToken,
  getGoogleVoiceToken,
  saveTranscript,
  transcribeAudio,
  sendChatMessage,
  synthesizeSpeech,
} from "@/lib/api";

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

type VoiceMode = "webrtc" | "gemini-live" | "chained";

function getVoiceMode(bot: BotInfo): VoiceMode {
  if (bot.modelProvider === "openai" && !bot.sttProvider && !bot.ttsProvider) {
    return "webrtc";
  }
  if (bot.modelProvider === "google" && !bot.sttProvider && !bot.ttsProvider) {
    return "gemini-live";
  }
  return "chained";
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
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [mode, setMode] = useState<VoiceMode | null>(null);
  const [status, setStatus] = useState("Connecting...");
  const [recording, setRecording] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const geminiWsRef = useRef<WebSocket | null>(null);
  const transcriptRef = useRef<TranscriptLine[]>([]);

  // Keep ref in sync for cleanup
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const voiceMode = getVoiceMode(bot);

  // ── OpenAI WebRTC Mode ──
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

      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = ms;
      ms.getTracks().forEach((track) => pc.addTrack(track, ms));

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
        }
        if (event.type === "conversation.item.input_audio_transcription.completed") {
          setTranscript((prev) => [
            ...prev,
            { role: "user", text: event.transcript, isFinal: true },
          ]);
        }
      };

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
  }, [bot]);

  // ── Google Gemini Live Mode ──
  const startGeminiLive = useCallback(async () => {
    setMode("gemini-live");
    setStatus("Getting token...");

    try {
      const tokenData = (await getGoogleVoiceToken(bot.ttsVoiceId || undefined)) as {
        apiKey?: string;
        token?: string;
        model?: string;
      };

      const apiKey = tokenData.apiKey || tokenData.token;
      if (!apiKey) {
        setStatus("Failed to get Google token");
        return;
      }

      setStatus("Connecting to Gemini Live...");

      // Connect via WebSocket to Gemini Live API
      const model = tokenData.model || "gemini-2.5-flash";
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

      const ws = new WebSocket(wsUrl);
      geminiWsRef.current = ws;

      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = ms;

      ws.onopen = () => {
        // Send setup message
        ws.send(JSON.stringify({
          setup: {
            model: `models/${model}`,
            generationConfig: {
              responseModalities: ["AUDIO", "TEXT"],
            },
            systemInstruction: {
              parts: [{ text: bot.systemPrompt }],
            },
          },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle setup complete
          if (data.setupComplete) {
            setStatus("Connected - speak to chat");
            startGeminiAudioStream(ws, ms);
            return;
          }

          // Handle server content (text transcription of response)
          if (data.serverContent?.modelTurn?.parts) {
            for (const part of data.serverContent.modelTurn.parts) {
              if (part.text) {
                setTranscript((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === "assistant" && !last.isFinal) {
                    return [
                      ...prev.slice(0, -1),
                      { ...last, text: last.text + part.text },
                    ];
                  }
                  return [...prev, { role: "assistant", text: part.text, isFinal: false }];
                });
              }
            }
          }

          // Handle turn complete
          if (data.serverContent?.turnComplete) {
            setTranscript((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant" && !last.isFinal) {
                return [...prev.slice(0, -1), { ...last, isFinal: true }];
              }
              return prev;
            });
          }
        } catch {
          // skip parse errors
        }
      };

      ws.onerror = () => {
        setStatus("Connection error");
      };

      ws.onclose = () => {
        setStatus("Disconnected");
      };
    } catch (err) {
      console.error("Gemini Live error:", err);
      setStatus("Connection failed");
    }
  }, [bot]);

  function startGeminiAudioStream(ws: WebSocket, ms: MediaStream) {
    const recorder = new MediaRecorder(ms, { mimeType: "audio/webm" });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = async (e) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        const buffer = await e.data.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        ws.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{
              mimeType: "audio/webm",
              data: base64,
            }],
          },
        }));
      }
    };

    recorder.start(1000);
  }

  // ── Chained REST Mode (Anthropic / explicit STT+TTS) ──
  const startChained = useCallback(async () => {
    setMode("chained");
    setStatus("Starting microphone...");

    try {
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = ms;
      setRecording(true);
      setStatus("Listening - tap stop when done speaking");
    } catch (err) {
      console.error("Microphone error:", err);
      setStatus("Microphone access denied");
    }
  }, []);

  // Record and process a single voice exchange (chained mode)
  const processChainedRecording = useCallback(async () => {
    if (!streamRef.current) return;

    setRecording(false);
    setStatus("Recording...");

    // Record a short clip
    const recorder = new MediaRecorder(streamRef.current, { mimeType: "audio/webm" });
    const chunks: Blob[] = [];

    return new Promise<void>((resolve) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        if (chunks.length === 0) {
          setRecording(true);
          setStatus("Listening - tap stop when done speaking");
          resolve();
          return;
        }

        const blob = new Blob(chunks, { type: "audio/webm" });
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

        // 1. Transcribe
        setStatus("Transcribing...");
        try {
          const { text } = await transcribeAudio(base64, conversationId);
          if (!text.trim()) {
            setRecording(true);
            setStatus("Listening - tap stop when done speaking");
            resolve();
            return;
          }

          setTranscript((prev) => [
            ...prev,
            { role: "user", text, isFinal: true },
          ]);

          // 2. Send to LLM via SSE
          setStatus("Thinking...");
          let responseText = "";

          await new Promise<void>((resolveChat) => {
            sendChatMessage(conversationId, text, {
              onDelta(delta) {
                responseText += delta;
                setTranscript((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === "assistant" && !last.isFinal) {
                    return [
                      ...prev.slice(0, -1),
                      { ...last, text: last.text + delta },
                    ];
                  }
                  return [...prev, { role: "assistant", text: delta, isFinal: false }];
                });
              },
              onDone() {
                setTranscript((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === "assistant") {
                    return [...prev.slice(0, -1), { ...last, isFinal: true }];
                  }
                  return prev;
                });
                resolveChat();
              },
              onError(err) {
                console.error("Chat error:", err);
                resolveChat();
              },
            });
          });

          // 3. TTS
          if (responseText) {
            setStatus("Speaking...");
            try {
              const audioBlob = await synthesizeSpeech(responseText, conversationId);
              const url = URL.createObjectURL(audioBlob);
              const audio = new Audio(url);
              audio.play();
              audio.onended = () => URL.revokeObjectURL(url);
            } catch {
              // TTS failed, continue anyway
            }
          }
        } catch (err) {
          console.error("Voice processing error:", err);
        }

        setRecording(true);
        setStatus("Listening - tap stop when done speaking");
        resolve();
      };

      // Record for up to 10 seconds
      recorder.start();
      setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, 10000);

      // Store ref so user can stop early
      mediaRecorderRef.current = recorder;
    });
  }, [conversationId]);

  // Start voice on mount
  useEffect(() => {
    if (voiceMode === "webrtc") {
      startWebRTC();
    } else if (voiceMode === "gemini-live") {
      startGeminiLive();
    } else {
      startChained();
    }

    return () => {
      pcRef.current?.close();
      dcRef.current?.close();
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      geminiWsRef.current?.close();
    };
  }, [voiceMode, startWebRTC, startGeminiLive, startChained]);

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = muted;
      });
    }
    setMuted(!muted);
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleEnd = async () => {
    // Save transcript to DB for WebRTC and Gemini Live modes
    const finalTranscript = transcriptRef.current.filter((t) => t.isFinal);
    if (finalTranscript.length > 0 && (mode === "webrtc" || mode === "gemini-live")) {
      try {
        await saveTranscript(
          conversationId,
          finalTranscript.map((t) => ({
            role: t.role,
            content: t.text,
            inputMode: "voice",
          }))
        );
      } catch (err) {
        console.error("Failed to save transcript:", err);
      }
    }

    pcRef.current?.close();
    dcRef.current?.close();
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    geminiWsRef.current?.close();
    onClose();
  };

  const modeLabel =
    mode === "webrtc" ? "WebRTC" : mode === "gemini-live" ? "Gemini Live" : "Chained";

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-background/95 backdrop-blur">
      {/* Status */}
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm text-muted-foreground">{status}</span>
        {mode && (
          <span className="text-xs text-muted-foreground">({modeLabel})</span>
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

        {/* Chained mode: record/stop button */}
        {mode === "chained" && recording && (
          <Button
            variant="secondary"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={processChainedRecording}
          >
            <div className="h-4 w-4 rounded-sm bg-red-500" />
          </Button>
        )}

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
