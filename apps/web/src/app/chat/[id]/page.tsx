"use client";

import { use } from "react";
import { useApp } from "@/lib/context";
import { Welcome } from "@/components/Welcome";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";

export default function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { userId, userLoading } = useApp();

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!userId) return <Welcome />;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 relative overflow-hidden">
        <ChatView conversationId={id} />
      </main>
    </div>
  );
}
