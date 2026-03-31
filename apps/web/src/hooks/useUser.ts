"use client";

import { useState, useEffect } from "react";
import { createUser, getUser } from "@/lib/api";

export function useUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("superchat_user_id");
    if (stored) {
      getUser(stored)
        .then((u) => {
          setUserId(u.id);
          setUserName(u.name);
        })
        .catch(() => {
          localStorage.removeItem("superchat_user_id");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const register = async (name: string) => {
    const user = await createUser(name);
    localStorage.setItem("superchat_user_id", user.id);
    setUserId(user.id);
    setUserName(user.name);
  };

  return { userId, userName, loading, register };
}
