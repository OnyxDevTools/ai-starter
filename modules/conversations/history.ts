// filename: modules/conversations/history.ts
import "server-only";
import type { UIMessage } from "ai";
import { collect } from "../../lib/onyx/store";
import { locked } from "../../lib/locks";
import { Access } from "./access";
import type { Actor } from "../models";
export async function snapshot(access: Access, actor: Actor, id: string) {
  let conversation = await access.conversation(actor, id);
  if (conversation.activeRunId) {
    const active = await access.run(actor, conversation.activeRunId);
    if (
      ["pending", "streaming"].includes(active.status) &&
      Date.parse(active.expiresAt) < Date.now()
    ) {
      await locked(
        access.store,
        `conversation:${id}`,
        "recover-interrupted",
        async () => {
          conversation = await access.conversation(actor, id);
          const run = await access.run(actor, active.id);
          if (
            conversation.activeRunId === run.id &&
            ["pending", "streaming"].includes(run.status) &&
            Date.parse(run.expiresAt) < Date.now()
          ) {
            const now = new Date().toISOString();
            await access.store.update("GenerationRun", {
              ...run,
              status: "interrupted",
              errorCode: "worker-disconnected",
              updatedAt: now,
            });
            const activities = await collect(access.store, "ToolActivity", {
              runId: run.id,
              ownerUid: actor.uid,
              workspaceId: run.workspaceId,
              conversationId: run.conversationId,
            });
            for (const activity of activities)
              if (activity.status === "input" || activity.status === "running")
                await access.store.update("ToolActivity", {
                  ...activity,
                  status: "failed",
                  outputText:
                    activity.outputText ||
                    "The worker disconnected before this tool completed.",
                  updatedAt: now,
                });
            const message = await access.store.get(
              "Message",
              run.assistantMessageId,
            );
            if (message)
              await access.store.update("Message", {
                ...message,
                state: "interrupted",
                updatedAt: now,
              });
            await access.store.update("Conversation", {
              ...conversation,
              activeRunId: "",
              updatedAt: now,
            });
          }
        },
      );
    }
  }
  const where = {
    conversationId: id,
    workspaceId: conversation.workspaceId,
    ownerUid: actor.uid,
  };
  const [messages, runs, tools, attachments, sources, links] =
    await Promise.all([
      collect(access.store, "Message", where),
      collect(access.store, "GenerationRun", where),
      collect(access.store, "ToolActivity", where),
      collect(access.store, "Attachment", { ...where, status: "ready" }),
      collect(access.store, "Source", where),
      collect(access.store, "MessageAttachment", where),
    ]);
  messages.sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || (a.role === "user" ? -1 : 1),
  );
  runs.sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.attempt - b.attempt,
  );
  return {
    conversation: await access.conversation(actor, id),
    messages,
    runs,
    tools,
    attachments,
    sources,
    links,
  };
}
export type Snapshot = Awaited<ReturnType<typeof snapshot>>;
export function uiMessages(data: Snapshot): UIMessage[] {
  return data.messages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.text }],
  }));
}
