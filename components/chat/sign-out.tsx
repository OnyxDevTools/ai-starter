"use client";
// filename: components/chat/sign-out.tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { firebaseClient } from "@/modules/auth/client";
import { Button } from "@/components/ui/button";
export function SignOut() {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    router = useRouter();
  return (
    <div>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const response = await fetch("/api/auth/sign-out", {
              method: "POST",
            });
            if (!response.ok) throw new Error("Sign-out failed");
            try {
              await signOut(await firebaseClient());
            } catch {
              /* Server session is already cleared; client state has no server authority. */
            }
            router.push("/sign-in");
            router.refresh();
          } catch {
            setError("Sign-out could not complete. Try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        Sign out
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
