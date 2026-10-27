"use client";
// filename: components/chat/entry.tsx
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Rows } from "@/modules/models";
import { request } from "./actions";
export function ChatEntry() {
  const router = useRouter(),
    [error, setError] = useState("");
  const open = useCallback(
    () =>
      request<Rows["Conversation"]>("/api/conversations/open", "POST")
        .then((chat) => {
          router.replace(`/chat/${chat.id}`);
          router.refresh();
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Chat could not open.");
        }),
    [router],
  );
  useEffect(() => {
    void open();
  }, [open]);
  return (
    <main
      id="main"
      className="flex min-h-0 flex-1 items-center justify-center p-6"
    >
      <div className="space-y-4 text-center">
        {error ? (
          <>
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
            <Button
              onClick={() => {
                setError("");
                void open();
              }}
            >
              Try again
            </Button>
          </>
        ) : (
          <p
            role="status"
            className="text-muted-foreground flex items-center gap-2 text-sm"
          >
            <LoaderCircle className="size-4 animate-spin" />
            Opening your chat…
          </p>
        )}
      </div>
    </main>
  );
}
