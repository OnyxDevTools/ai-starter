// filename: components/chat/setup.tsx
import { Sparkles } from "lucide-react";
export function Setup({ message }: { message: string }) {
  return (
    <main
      id="main"
      className="chat-welcome flex min-h-dvh items-center justify-center p-6"
    >
      <div className="bg-card max-w-lg space-y-5 rounded-2xl border p-8">
        <Sparkles className="text-primary size-9" />
        <p className="text-muted-foreground text-xs tracking-[.2em] uppercase">
          AI Starter / Setup
        </p>
        <h1 className="text-3xl font-semibold">
          A little setup. A lot of possibility.
        </h1>
        <p role="status" className="text-muted-foreground leading-relaxed">
          {message}
        </p>
        <p className="text-muted-foreground text-sm">
          Follow the local setup in README.md. Connect your application’s
          Firebase project and an Onyx database, publish the included schema,
          then choose live Onyx agents or explicit development demo mode.
        </p>
      </div>
    </main>
  );
}
