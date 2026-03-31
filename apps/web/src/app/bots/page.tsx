"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/context";
import { Welcome } from "@/components/Welcome";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Bot, Pencil } from "lucide-react";
import { listBots, createBot, updateBot, deleteBot } from "@/lib/api";
import { LLM_MODELS, TTS_VOICES } from "@superchat/shared";

interface BotItem {
  id: string;
  name: string;
  modelProvider: string;
  modelId: string;
  systemPrompt: string;
  ttsProvider: string | null;
  ttsVoiceId: string | null;
  sttProvider: string | null;
}

const defaultBot: {
  name: string;
  modelProvider: "openai" | "anthropic" | "google";
  modelId: string;
  systemPrompt: string;
  ttsProvider: string | null;
  ttsVoiceId: string | null;
  sttProvider: string | null;
} = {
  name: "",
  modelProvider: "openai",
  modelId: "gpt-5.4",
  systemPrompt: "You are a helpful assistant.",
  ttsProvider: null,
  ttsVoiceId: null,
  sttProvider: null,
};

export default function BotsPage() {
  const { userId, userLoading } = useApp();
  const [bots, setBots] = useState<BotItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<BotItem | null>(null);
  const [form, setForm] = useState(defaultBot);

  useEffect(() => {
    if (userId) loadBots();
  }, [userId]);

  const loadBots = () => {
    listBots().then((b) => setBots(b as unknown as BotItem[]));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    if (editingBot) {
      await updateBot(editingBot.id, form);
    } else {
      await createBot(form);
    }

    setDialogOpen(false);
    setEditingBot(null);
    setForm(defaultBot);
    loadBots();
  };

  const handleEdit = (bot: BotItem) => {
    setEditingBot(bot);
    setForm({
      name: bot.name,
      modelProvider: bot.modelProvider as "openai" | "anthropic" | "google",
      modelId: bot.modelId,
      systemPrompt: bot.systemPrompt,
      ttsProvider: bot.ttsProvider,
      ttsVoiceId: bot.ttsVoiceId,
      sttProvider: bot.sttProvider,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteBot(id);
    loadBots();
  };

  const handleNewBot = () => {
    setEditingBot(null);
    setForm(defaultBot);
    setDialogOpen(true);
  };

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!userId) return <Welcome />;

  const models =
    LLM_MODELS[form.modelProvider as keyof typeof LLM_MODELS] || [];

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Bots</h1>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger
                render={<Button onClick={handleNewBot} />}
              >
                <Plus className="mr-2 h-4 w-4" /> New Bot
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingBot ? "Edit Bot" : "Create Bot"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="My Assistant"
                    />
                  </div>

                  <div>
                    <Label>Provider</Label>
                    <Select
                      value={form.modelProvider}
                      onValueChange={(v) => {
                        if (!v) return;
                        setForm({
                          ...form,
                          modelProvider: v as "openai" | "anthropic" | "google",
                          modelId:
                            LLM_MODELS[v as keyof typeof LLM_MODELS]?.[0]
                              ?.id || "",
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="google">Google</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Model</Label>
                    <Select
                      value={form.modelId}
                      onValueChange={(v) => { if (v) setForm({ ...form, modelId: v }); }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>System Prompt</Label>
                    <Textarea
                      value={form.systemPrompt}
                      onChange={(e) =>
                        setForm({ ...form, systemPrompt: e.target.value })
                      }
                      rows={4}
                    />
                  </div>

                  <Separator className="my-2" />
                  <p className="text-sm font-medium">Voice Settings</p>

                  <div>
                        <Label>TTS Provider</Label>
                        <Select
                          value={form.ttsProvider || ""}
                          onValueChange={(v) =>
                            setForm({
                              ...form,
                              ttsProvider: v ?? null,
                              ttsVoiceId:
                                TTS_VOICES[v as keyof typeof TTS_VOICES]?.[0]
                                  ?.id ?? null,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="elevenlabs">
                              ElevenLabs
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {form.ttsProvider && (
                        <div>
                          <Label>Voice</Label>
                          <Select
                            value={form.ttsVoiceId || ""}
                            onValueChange={(v) =>
                              setForm({ ...form, ttsVoiceId: v ?? null })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TTS_VOICES[
                                form.ttsProvider as keyof typeof TTS_VOICES
                              ]?.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div>
                        <Label>STT Provider</Label>
                        <Select
                          value={form.sttProvider || ""}
                          onValueChange={(v) =>
                            setForm({ ...form, sttProvider: v ?? null })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="openai">
                              OpenAI (Whisper)
                            </SelectItem>
                            <SelectItem value="deepgram">Deepgram</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                  <Button onClick={handleSave} className="w-full">
                    {editingBot ? "Update Bot" : "Create Bot"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {bots.map((bot) => (
              <Card key={bot.id}>
                <CardHeader className="flex flex-row items-center gap-4 py-4">
                  <Bot className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1">
                    <CardTitle className="text-base">{bot.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {bot.modelProvider} / {bot.modelId}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(bot)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(bot.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {bot.systemPrompt}
                  </p>
                </CardContent>
              </Card>
            ))}

            {bots.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-4" />
                <p>No bots yet. Create one to start chatting!</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
