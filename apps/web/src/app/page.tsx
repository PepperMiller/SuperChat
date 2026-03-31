"use client";

import { useApp } from "@/lib/context";
import { Welcome } from "@/components/Welcome";
import { Sidebar } from "@/components/Sidebar";
import { MessageSquare } from "lucide-react";

export default function Home() {
  const { userId, userLoading } = useApp();

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!userId) {
    return <Welcome />;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">Welcome to SuperChat</h2>
          <p className="text-muted-foreground max-w-md">
            Select a conversation from the sidebar or start a new chat to begin.
          </p>
        </div>
      </main>
    </div>
  );
}
