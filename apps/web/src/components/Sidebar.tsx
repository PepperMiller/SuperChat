"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  Bot,
  Settings,
  Plus,
  Menu,
  X,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { listConversations, listBots, createConversation } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ConvoItem {
  id: string;
  title: string;
  botId: string;
  updatedAt: string;
}

export function Sidebar() {
  const { userId } = useApp();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<ConvoItem[]>([]);
  const [bots, setBots] = useState<Array<{ id: string; name: string }>>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    listConversations().then((c) => setConversations(c as unknown as ConvoItem[]));
    listBots().then((b) => setBots(b as unknown as Array<{ id: string; name: string }>));
  }, [userId, pathname]);

  const handleNewChat = async () => {
    if (bots.length === 0) return;
    const convo = (await createConversation(bots[0].id)) as unknown as ConvoItem;
    window.location.href = `/chat/${convo.id}`;
  };

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-lg font-bold">SuperChat</h1>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen(false)}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="px-3 pb-2">
        <Button onClick={handleNewChat} className="w-full" disabled={bots.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-1">
          {conversations.map((c) => (
            <Link key={c.id} href={`/chat/${c.id}`} onClick={() => setOpen(false)}>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors",
                  pathname === `/chat/${c.id}` && "bg-accent"
                )}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate">{c.title}</span>
              </div>
            </Link>
          ))}
          {conversations.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No conversations yet
            </p>
          )}
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-3 space-y-1">
        <Link href="/bots" onClick={() => setOpen(false)}>
          <div
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors",
              pathname === "/bots" && "bg-accent"
            )}
          >
            <Bot className="h-4 w-4" />
            Bots
          </div>
        </Link>
        <Link href="/settings" onClick={() => setOpen(false)}>
          <div
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors",
              pathname === "/settings" && "bg-accent"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </div>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r bg-sidebar-background text-sidebar-foreground transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {nav}
      </aside>
    </>
  );
}
