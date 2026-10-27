"use client";
import project from "@/project.json";

// filename: components/chat/shell.tsx
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Plus,
  MessageSquare,
  PanelLeft,
  ArrowUpRight,
  Sparkles,
  LockKeyhole,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "./theme";
import { SignOut } from "./sign-out";
import { request } from "./actions";
import type { Rows } from "@/modules/models";
type Page = { items: Rows["Conversation"][]; cursor?: string };
export function Shell({
  children,
  workspace,
  initial,
  name,
  mode,
}: {
  children: React.ReactNode;
  workspace: Rows["Workspace"] | null;
  initial: Page;
  name: string;
  mode: string;
}) {
  const router = useRouter(),
    params = useParams(),
    [more, setMore] = useState<Page | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false);
  // Reset pagination whenever a server navigation supplies a new initial page.
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setMore(null);
  }
  const page = more || initial;
  async function create() {
    setBusy(true);
    setError("");
    try {
      const ws =
        workspace ||
        (await request<Rows["Workspace"]>("/api/workspaces", "POST", {
          name: "My workspace",
        }));
      const c = await request<Rows["Conversation"]>(
        "/api/conversations",
        "POST",
        { workspaceId: ws.id },
      );
      setOpen(false);
      router.push(`/chat/${c.id}`);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not create conversation.",
      );
    } finally {
      setBusy(false);
    }
  }
  const sidebar = (
    <aside className="studio-sidebar flex h-full flex-col">
      <Link href="/chat" className="flex items-center gap-3 px-6 py-7">
        <span className="border-primary/40 bg-primary/10 text-primary grid size-9 place-items-center rounded-lg border">
          <Sparkles className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">
          {project.name}
          <span className="text-muted-foreground block text-[10px] font-normal tracking-[.2em] uppercase">
            Onyx / Idea studio
          </span>
        </span>
      </Link>
      <div className="px-4">
        <Button
          className="w-full justify-between"
          onClick={() => void create()}
          disabled={busy}
        >
          <span className="flex items-center gap-2">
            <Plus className="size-4" />
            New conversation
          </span>
          <span className="text-xs opacity-60">↗</span>
        </Button>
      </div>
      <div className="mt-7 flex items-center justify-between px-6">
        <h2 className="text-muted-foreground text-[10px] font-semibold tracking-[.18em] uppercase">
          Your conversations
        </h2>
        <span className="text-muted-foreground text-xs">
          {page.items.length}
        </span>
      </div>
      <nav
        aria-label="Conversations"
        className="mt-3 flex-1 space-y-1 overflow-y-auto px-3"
      >
        {page.items.map((c) => (
          <Link
            key={c.id}
            href={`/chat/${c.id}`}
            onClick={() => setOpen(false)}
            aria-current={params.id === c.id ? "page" : undefined}
            className={`hover:bg-secondary flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${params.id === c.id ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
          >
            <MessageSquare className="size-4 shrink-0" />
            <span className="truncate">{c.title}</span>
          </Link>
        ))}
        {!page.items.length && (
          <p className="text-muted-foreground px-3 py-6 text-sm leading-relaxed">
            A blank page for your next big idea.
          </p>
        )}
        {page.cursor && workspace && (
          <Button
            variant="ghost"
            disabled={busy}
            className="w-full"
            onClick={async () => {
              setBusy(true);
              try {
                const next = await request<Page>(
                  `/api/conversations?workspaceId=${workspace.id}&cursor=${encodeURIComponent(page.cursor!)}`,
                );
                setMore({
                  items: [...page.items, ...next.items],
                  ...(next.cursor ? { cursor: next.cursor } : {}),
                });
              } catch (e) {
                setError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Load more conversations
          </Button>
        )}
      </nav>
      {error && (
        <p role="alert" className="text-destructive px-5 py-3 text-xs">
          {error}
        </p>
      )}
      <div className="m-4 rounded-xl border p-3">
        <p className="text-primary flex items-center gap-2 text-xs font-medium">
          <LockKeyhole className="size-3" />
          Private by design
        </p>
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          {workspace?.name || "Your personal workspace"} ·{" "}
          {mode === "demo" ? "Local demo" : "Onyx agents"}
        </p>
      </div>
      <footer className="flex items-center gap-2 border-t p-4">
        <div className="bg-secondary grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold">
          {name[0]?.toUpperCase()}
        </div>
        <p className="min-w-0 flex-1 truncate text-xs">{name}</p>
        <ThemeToggle />
        <SignOut />
      </footer>
    </aside>
  );
  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="hidden w-68 shrink-0 border-r md:block">{sidebar}</div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          aria-label="Mobile navigation"
          className="bg-card flex h-14 shrink-0 items-center gap-3 border-b px-4 md:hidden"
        >
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <PanelLeft />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>
          <span className="flex-1 text-sm font-medium">{project.name}</span>
          <ArrowUpRight className="text-primary size-4" />
        </header>
        {children}
      </div>
    </div>
  );
}
