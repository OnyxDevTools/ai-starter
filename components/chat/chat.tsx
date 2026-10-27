"use client";
// filename: components/chat/chat.tsx
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Square,
  Paperclip,
  Sparkles,
  Copy,
  RefreshCw,
  Pencil,
  Trash2,
  Check,
  FileText,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageAction,
  MessageActions,
  MessageResponse,
} from "@/components/ai-elements/message";
import { request } from "./actions";
import type { Snapshot } from "@/modules/conversations/history";
import type { Rows } from "@/modules/models";
const isActive = (s: string) => s === "streaming" || s === "pending";
export function Chat({
  initial,
  initialMessages,
  models,
  configuration,
}: {
  initial: Snapshot;
  initialMessages: UIMessage[];
  models: string[];
  configuration: string;
}) {
  const router = useRouter(),
    [data, setData] = useState(initial),
    [text, setText] = useState(""),
    [model, setModel] = useState(models[0] || ""),
    [knowledge, setKnowledge] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState(false),
    [remove, setRemove] = useState(false),
    [title, setTitle] = useState(initial.conversation.title),
    [copied, setCopied] = useState("");
  const id = initial.conversation.id;
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ body }) => ({ body: body || {} }),
      }),
    [],
  );
  const chat = useChat({
    id,
    messages: initialMessages,
    generateId: () => crypto.randomUUID(),
    transport,
    onError: (e) => setError(e.message),
    onFinish: () => {
      void refresh();
    },
  });
  const streaming = chat.status === "submitted" || chat.status === "streaming",
    lastRun = data.runs.at(-1),
    serverActive = data.runs.find(
      (r) => r.id === data.conversation.activeRunId && isActive(r.status),
    ),
    working = streaming || !!serverActive;
  const refresh = useCallback(async () => {
    try {
      const next = await request<Snapshot>(`/api/conversations/${id}`);
      setData(next);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reload history.");
      return null;
    }
  }, [id]);
  const activeRunId = serverActive?.id,
    setMessages = chat.setMessages;
  useEffect(() => {
    if (!activeRunId) return;
    const timer = setInterval(() => void refresh(), 1000);
    return () =>
      clearInterval(
        timer,
      ); /* Refreshes durable run state after reconnect or a stop from another tab. */
  }, [activeRunId, refresh]);
  useEffect(() => {
    if (!streaming) {
      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          role: m.role,
          parts: [{ type: "text", text: m.text }],
        })),
      );
    }
  }, [data, streaming, setMessages]);
  async function submit(retry = false) {
    if (busy || working || (!retry && !text.trim())) return;
    setError("");
    const messageId = retry ? lastRun?.userMessageId : crypto.randomUUID();
    if (!messageId) return;
    const content = retry
        ? data.messages.find((m) => m.id === messageId)?.text || ""
        : text.trim(),
      body = {
        conversationId: id,
        requestId: crypto.randomUUID(),
        messageId,
        text: content,
        model,
        attachmentIds: retry ? [] : selected,
        useKnowledge: knowledge,
        ...(retry && lastRun ? { retryRunId: lastRun.id } : {}),
      };
    setText("");
    setSelected([]);
    if (retry) await chat.regenerate({ body });
    else
      await chat.sendMessage(
        {
          id: messageId,
          role: "user",
          parts: [{ type: "text", text: content }],
        },
        { body },
      );
    await refresh();
    router.refresh();
  }
  async function stop() {
    setBusy(true);
    try {
      const latest = await refresh(),
        run = latest?.runs.find((r) => isActive(r.status));
      if (run) await request(`/api/runs/${run.id}/stop`, "POST");
      await chat.stop();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const liveTools = chat.messages.flatMap((m) =>
    m.parts
      .filter((p) => p.type === "data-tool")
      .flatMap((p) =>
        p.type === "data-tool" ? [p.data as Rows["ToolActivity"]] : [],
      ),
  );
  const toolMap = new Map(data.tools.map((t) => [t.id, t]));
  for (const tool of liveTools) toolMap.set(tool.id, tool);
  return (
    <main id="main" className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-19 shrink-0 items-center gap-3 border-b px-5 sm:px-8">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">
            {data.conversation.title}
          </h1>
          <p className="text-muted-foreground mt-1 text-xs">
            {data.conversation.mode === "demo"
              ? "Local demo · simulated generation"
              : "Onyx · private conversation"}
          </p>
        </div>
        <span className="text-primary bg-primary/10 hidden rounded-full px-3 py-1 text-[10px] font-medium sm:inline">
          {data.conversation.mode === "demo" ? "DEMO" : "ONYX AGENT"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Rename conversation"
          onClick={() => setEdit(true)}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={working}
          aria-label="Delete conversation"
          onClick={() => setRemove(true)}
        >
          <Trash2 className="size-4" />
        </Button>
      </header>
      <Conversation className="chat-welcome min-h-0">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-7 px-5 py-10 sm:px-8">
          {!chat.messages.length ? (
            <div className="flex min-h-70 flex-col justify-center">
              <Sparkles className="text-primary mb-5 size-8" />
              <p className="text-primary text-[10px] tracking-[.2em] uppercase">
                Start somewhere interesting
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                What’s on your mind?
              </h2>
              <p className="text-muted-foreground mt-3 text-sm">
                Ask a question, add context, and see where it takes you.
              </p>
              <div className="mt-7 grid gap-2 sm:grid-cols-2">
                {[
                  "Help me plan a product launch",
                  "Find a clear next step for my idea",
                  ...(data.conversation.mode === "demo"
                    ? ["[demo:error] Show a recoverable error"]
                    : []),
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setText(prompt)}
                    className="bg-card hover:bg-secondary rounded-xl border p-4 text-left text-xs"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chat.messages.map((m) => {
              const saved = data.messages.find((row) => row.id === m.id),
                content = m.parts
                  .filter((p) => p.type === "text")
                  .map((p) => p.text)
                  .join("");
              return (
                <Message key={m.id} from={m.role}>
                  <div className="text-muted-foreground mb-1 flex items-center gap-2 text-[10px] font-medium tracking-widest uppercase">
                    {m.role === "user" ? (
                      "You"
                    ) : (
                      <>
                        <Sparkles className="text-primary size-3" />
                        {data.conversation.mode === "demo"
                          ? "Demo assistant"
                          : "Onyx assistant"}
                      </>
                    )}
                  </div>
                  <MessageContent>
                    {m.role === "assistant" ? (
                      <MessageResponse
                        isAnimating={
                          streaming && m.id === chat.messages.at(-1)?.id
                        }
                      >
                        {content}
                      </MessageResponse>
                    ) : (
                      <p className="whitespace-pre-wrap">{content}</p>
                    )}
                  </MessageContent>
                  {data.links
                    .filter((l) => l.messageId === m.id)
                    .map((l) => {
                      const file = data.attachments.find(
                        (a) => a.id === l.attachmentId,
                      );
                      return (
                        file && (
                          <a
                            key={file.id}
                            className="text-primary text-xs underline"
                            href={`/api/attachments/${file.id}`}
                          >
                            {file.name}
                          </a>
                        )
                      );
                    })}
                  {m.role === "assistant" && (
                    <MessageActions>
                      <MessageAction
                        label={copied === m.id ? "Copied" : "Copy message"}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(content);
                            setCopied(m.id);
                          } catch {
                            setError(
                              "Clipboard unavailable. Select and copy the text manually.",
                            );
                          }
                        }}
                      >
                        {copied === m.id ? (
                          <Check className="size-3" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </MessageAction>
                      <span className="text-muted-foreground text-[10px]">
                        {streaming && m.id === chat.messages.at(-1)?.id
                          ? chat.status
                          : saved?.state || "pending"}
                      </span>
                    </MessageActions>
                  )}
                </Message>
              );
            })
          )}
          {Array.from(toolMap.values()).map((tool) => (
            <details
              key={tool.id}
              className="bg-card rounded-xl border p-4 text-xs"
            >
              <summary className="flex cursor-pointer items-center gap-2">
                <Search className="text-primary size-3" />
                <span className="flex-1">
                  {tool.name} ·{" "}
                  {tool.managedBy === "onyx"
                    ? "Onyx managed"
                    : "Application read tool"}
                </span>
                <span className="text-muted-foreground">{tool.status}</span>
              </summary>
              <div className="text-muted-foreground mt-4 space-y-3">
                <p>
                  Call {tool.callId}
                  {tool.approvalId ? ` · Approval ${tool.approvalId}` : ""}
                </p>
                <pre className="max-h-48 overflow-auto break-all whitespace-pre-wrap">
                  {tool.argumentsText}
                </pre>
                <pre className="max-h-64 overflow-auto break-all whitespace-pre-wrap">
                  {tool.outputText}
                </pre>
              </div>
            </details>
          ))}
          {data.sources.length > 0 && (
            <div className="space-y-2 text-xs">
              <p className="text-muted-foreground">Sources reported by Onyx</p>
              {data.sources.map((s) =>
                s.url ? (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary block underline"
                  >
                    {s.title}
                  </a>
                ) : (
                  <p key={s.id}>
                    {s.title} · {s.documentId}
                  </p>
                ),
              )}
            </div>
          )}
          {lastRun && (
            <div
              className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs"
              role="status"
            >
              <span>
                Response {lastRun.status} · attempt {lastRun.attempt}
              </span>
              {lastRun.actualModel && <span>{lastRun.actualModel}</span>}
              {lastRun.totalTokens !== null && (
                <span>{lastRun.totalTokens} tokens reported by Onyx</span>
              )}
              {!working && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={
                    !model ||
                    busy ||
                    data.tools.some(
                      (t) => t.runId === lastRun.id && t.managedBy === "onyx",
                    )
                  }
                  onClick={() => void submit(true)}
                >
                  <RefreshCw className="size-3" />
                  Retry response
                </Button>
              )}
              {data.tools.some(
                (t) => t.runId === lastRun.id && t.managedBy === "onyx",
              ) && (
                <p className="w-full">
                  Retry is unavailable after Onyx-managed tools. Review their
                  results before starting a new request.
                </p>
              )}
              {lastRun.errorCode && (
                <p className="text-destructive w-full">{lastRun.errorCode}</p>
              )}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-2 pb-4 sm:px-7">
        {configuration && (
          <p
            role="status"
            className="text-muted-foreground mb-3 rounded-xl border px-4 py-3 text-xs leading-relaxed"
          >
            {configuration}
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive mb-3 text-xs">
            {error}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="bg-card rounded-2xl border p-3 shadow-sm"
        >
          <Label htmlFor="prompt" className="sr-only">
            Message
          </Label>
          <Textarea
            id="prompt"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={12000}
            placeholder="Ask anything. Make it yours."
            className="max-h-40 min-h-18 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
            disabled={busy || working || !model}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`hover:bg-secondary text-muted-foreground inline-flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs ${busy || working ? "pointer-events-none opacity-50" : ""}`}
            >
              <Paperclip className="size-4" />
              <span className="sr-only">Attach file</span>
              <input
                type="file"
                aria-label="Attach file"
                className="sr-only"
                disabled={busy || working}
                accept=".txt,.md,.pdf,.png,.jpg,.jpeg"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  setError("");
                  try {
                    const response = await fetch(
                      `/api/conversations/${id}/attachments`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type":
                            file.type ||
                            (/\.md$/i.test(file.name)
                              ? "text/markdown"
                              : "application/octet-stream"),
                          "X-File-Name": encodeURIComponent(file.name),
                        },
                        body: file,
                      },
                    );
                    const body = await response.json();
                    if (!response.ok)
                      throw new Error(body.error || "Upload failed.");
                    setSelected((ids) => [...ids, body.id].slice(-4));
                    await refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Upload failed.");
                  } finally {
                    setBusy(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            <div className="w-40 sm:w-48">
              <Select
                value={model}
                onValueChange={setModel}
                disabled={working || !models.length}
              >
                <SelectTrigger
                  aria-label="Onyx agent"
                  className="h-8 border-0 text-xs shadow-none"
                >
                  <SelectValue placeholder="Agent unavailable" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m === "demo-local" ? "Demo · no model calls" : m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
              <input
                type="checkbox"
                checked={knowledge}
                onChange={(e) => setKnowledge(e.target.checked)}
                disabled={working}
              />
              Search knowledge
            </label>
            <div className="ml-auto">
              {working ? (
                <Button
                  size="icon"
                  type="button"
                  aria-label="Stop response"
                  disabled={busy}
                  onClick={() => void stop()}
                >
                  <Square className="size-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Send message"
                  disabled={busy || !model || !text.trim()}
                >
                  <ArrowUp className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </form>
        {data.attachments.length > 0 && (
          <div className="mt-2 flex max-h-20 flex-wrap gap-2 overflow-y-auto">
            {data.attachments.map((file) => (
              <label
                key={file.id}
                className="text-muted-foreground flex items-center gap-2 rounded-lg border px-2 py-1 text-[10px]"
              >
                <input
                  aria-label={`Include ${file.name}`}
                  type="checkbox"
                  checked={selected.includes(file.id)}
                  disabled={working}
                  onChange={(e) =>
                    setSelected((ids) =>
                      e.target.checked
                        ? [...ids, file.id].slice(-4)
                        : ids.filter((id) => id !== file.id),
                    )
                  }
                />
                <FileText className="size-3" />
                <a className="underline" href={`/api/attachments/${file.id}`}>
                  {file.name}
                </a>
                <span>
                  {file.mimeType.startsWith("text/")
                    ? "Text excerpt"
                    : "Stored only"}
                </span>
              </label>
            ))}
          </div>
        )}
        <p className="text-muted-foreground mt-2 text-center text-[10px]">
          {data.conversation.mode === "demo"
            ? "Deterministic demo. No live AI calls."
            : "Onyx agents can make mistakes. Review important results."}{" "}
          · Files up to 2 MiB · PDF/images stored only
        </p>
      </div>
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent>
          <DialogTitle>Rename conversation</DialogTitle>
          <DialogDescription>
            Give this conversation a useful name.
          </DialogDescription>
          <Label htmlFor="title">Name</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />
          <DialogFooter>
            <Button
              disabled={busy || !title.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await request(`/api/conversations/${id}`, "PATCH", { title });
                  setEdit(false);
                  await refresh();
                  router.refresh();
                } catch (e) {
                  setError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={remove} onOpenChange={setRemove}>
        <DialogContent>
          <DialogTitle>Delete this conversation?</DialogTitle>
          <DialogDescription>
            This removes it from your history and revokes access to its messages
            and files. Storage retention is managed by your server operator.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemove(false)}>
              Keep conversation
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await request(`/api/conversations/${id}`, "DELETE");
                  router.push("/chat");
                  router.refresh();
                } catch (e) {
                  setError(String(e));
                  setRemove(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
