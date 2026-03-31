"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/context";
import { Welcome } from "@/components/Welcome";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Key, Trash2, Check } from "lucide-react";
import { listApiKeys, setApiKey, deleteApiKey } from "@/lib/api";
import { PROVIDER_LABELS } from "@superchat/shared";

const PROVIDERS = ["openai", "anthropic", "google", "elevenlabs", "deepgram"] as const;

interface ApiKeyItem {
  id: string;
  provider: string;
  createdAt: string;
}

export default function SettingsPage() {
  const { userId, userName, userLoading } = useApp();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (userId) loadKeys();
  }, [userId]);

  const loadKeys = () => {
    listApiKeys().then((k) => setKeys(k as unknown as ApiKeyItem[]));
  };

  const handleSave = async (provider: string) => {
    const key = inputValues[provider];
    if (!key?.trim()) return;

    setSaving({ ...saving, [provider]: true });
    await setApiKey(provider, key.trim());
    setInputValues({ ...inputValues, [provider]: "" });
    setSaving({ ...saving, [provider]: false });
    loadKeys();
  };

  const handleDelete = async (id: string) => {
    await deleteApiKey(id);
    loadKeys();
  };

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!userId) return <Welcome />;

  const hasKey = (provider: string) =>
    keys.some((k) => k.provider === provider);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground mb-6">
            Logged in as <strong>{userName}</strong>
          </p>

          <h2 className="text-lg font-semibold mb-4">API Keys</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Add your API keys to use different providers. Keys are encrypted and
            stored securely.
          </p>

          <div className="space-y-4">
            {PROVIDERS.map((provider) => {
              const existing = keys.find((k) => k.provider === provider);
              return (
                <Card key={provider}>
                  <CardHeader className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        <CardTitle className="text-base">
                          {PROVIDER_LABELS[provider] || provider}
                        </CardTitle>
                      </div>
                      {existing && (
                        <Badge variant="secondary" className="gap-1">
                          <Check className="h-3 w-3" /> Configured
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder={
                          existing
                            ? "Replace existing key..."
                            : "Enter API key..."
                        }
                        value={inputValues[provider] || ""}
                        onChange={(e) =>
                          setInputValues({
                            ...inputValues,
                            [provider]: e.target.value,
                          })
                        }
                      />
                      <Button
                        onClick={() => handleSave(provider)}
                        disabled={
                          !inputValues[provider]?.trim() || saving[provider]
                        }
                      >
                        Save
                      </Button>
                      {existing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(existing.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
