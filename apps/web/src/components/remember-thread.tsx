"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { rememberThread } from "@/lib/contact-local";
import { markThreadSeen, onThreadChanged, refreshThreads } from "@/lib/contact-live";

/**
 * Conversation page: keeps its link (the contact page and help bubble list it
 * next time), marks our replies as read, and redraws live when we reply.
 */
export default function RememberThread({ id, path, lastAt }: { id: string; path: string; lastAt: string }) {
  const router = useRouter();
  useEffect(() => {
    rememberThread(path);
    markThreadSeen(id, lastAt);
    void refreshThreads();
  }, [id, path, lastAt]);
  useEffect(
    () =>
      onThreadChanged((changed) => {
        if (changed === id) router.refresh();
      }),
    [id, router]
  );
  return null;
}
