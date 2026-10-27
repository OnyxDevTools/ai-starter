// filename: modules/conversations/open.ts
import "server-only";
import { locked } from "@/lib/locks";
import { aiMode } from "@/lib/config";
import type { Actor } from "../models";
import type { Access } from "./access";
export async function openChat(access: Access, actor: Actor) {
  access.verified(actor);
  return locked(
    access.store,
    `chat-entry:${actor.uid}`,
    "open-chat",
    async () => {
      const workspaces = await access.workspaces(actor),
        workspace =
          workspaces[0] ||
          (await access.createWorkspace(actor, "My workspace"));
      const mode = aiMode() === "demo" ? "demo" : "live",
        page = await access.list(actor, workspace.id);
      const existing = page.items.find((c) => c.mode === mode);
      return (
        existing || (await access.createConversation(actor, workspace.id, mode))
      );
    },
  );
}
