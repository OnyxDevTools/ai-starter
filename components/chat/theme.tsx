"use client";
// filename: components/chat/theme.tsx
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
function subscribe(callback: () => void) {
  window.addEventListener("ai-studio-theme", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("ai-studio-theme", callback);
    window.removeEventListener("storage", callback);
  };
}
export function ThemeToggle() {
  const light = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme === "light",
    () => false,
  );
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={light ? "Use dark theme" : "Use light theme"}
      onClick={() => {
        const next = !light;
        try {
          localStorage.setItem("ai-studio-theme", next ? "light" : "dark");
        } catch {}
        document.documentElement.dataset.theme = next ? "light" : "dark";
        document.documentElement.classList.toggle("dark", !next);
        window.dispatchEvent(new Event("ai-studio-theme"));
      }}
    >
      {light ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
    </Button>
  );
}
