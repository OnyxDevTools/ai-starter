// filename: modules/conversations/access.ts
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { ensure } from "../../lib/errors";
import { collect, type Store } from "../../lib/onyx/store";
import { locked } from "../../lib/locks";
import type { Actor } from "../models";
export const memberId = (workspaceId: string, uid: string) =>
  createHash("sha256").update(`${workspaceId}:${uid}`).digest("hex");
export const stableId = (namespace: string, value: string) => {
  const h = createHash("sha256").update(`${namespace}:${value}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export class Access {
  constructor(public readonly store: Store) {}
  verified(actor: Actor) {
    ensure(
      actor.uid && actor.emailVerified,
      403,
      "A verified application account is required.",
    );
  }
  async workspace(actor: Actor, id: string) {
    this.verified(actor);
    const member = await this.store.get("Membership", memberId(id, actor.uid));
    ensure(
      member &&
        member.workspaceId === id &&
        member.userId === actor.uid &&
        member.active,
      403,
      "You do not belong to this workspace.",
    );
    const workspace = await this.store.get("Workspace", id);
    ensure(workspace, 404, "Workspace unavailable.");
    return workspace;
  }
  async conversation(actor: Actor, id: string) {
    this.verified(actor);
    const row = await this.store.get("Conversation", id);
    ensure(
      row && !row.deleted && row.ownerUid === actor.uid,
      404,
      "Conversation unavailable.",
    );
    await this.workspace(actor, row.workspaceId);
    return row;
  }
  async run(actor: Actor, id: string) {
    const row = await this.store.get("GenerationRun", id);
    ensure(row && row.ownerUid === actor.uid, 404, "Run unavailable.");
    const conversation = await this.conversation(actor, row.conversationId);
    ensure(
      row.workspaceId === conversation.workspaceId,
      404,
      "Run unavailable.",
    );
    return row;
  }
  async workspaces(actor: Actor) {
    this.verified(actor);
    const members = await collect(
      this.store,
      "Membership",
      { userId: actor.uid, active: true },
      100,
    );
    return Promise.all(
      members.map((row) => this.workspace(actor, row.workspaceId)),
    );
  }
  async createWorkspace(actor: Actor, name: string) {
    this.verified(actor);
    const title = z.string().trim().min(2).max(80).parse(name),
      id = stableId("personal-workspace", actor.uid);
    return locked(
      this.store,
      `user:${actor.uid}`,
      "create-workspace",
      async () => {
        let row = await this.store.get("Workspace", id);
        const now = new Date().toISOString();
        if (!row) {
          row = { id, name: title, createdBy: actor.uid, createdAt: now };
          await this.store.insert("Workspace", row);
        }
        ensure(row.createdBy === actor.uid, 403, "Workspace unavailable.");
        const mid = memberId(id, actor.uid);
        if (!(await this.store.get("Membership", mid)))
          await this.store.insert("Membership", {
            id: mid,
            workspaceId: id,
            userId: actor.uid,
            active: true,
            createdAt: now,
          });
        return row;
      },
    );
  }
  async createConversation(
    actor: Actor,
    workspaceId: string,
    mode: "live" | "demo",
  ) {
    await this.workspace(actor, workspaceId);
    const now = new Date().toISOString(),
      row = {
        id: randomUUID(),
        workspaceId,
        ownerUid: actor.uid,
        title: "New conversation",
        mode,
        activeRunId: "",
        deleted: false,
        createdAt: now,
        updatedAt: now,
      };
    await this.store.insert("Conversation", row);
    return row;
  }
  async list(actor: Actor, workspaceId: string, cursor?: string) {
    await this.workspace(actor, workspaceId);
    return this.store.page(
      "Conversation",
      { workspaceId, ownerUid: actor.uid, deleted: false },
      20,
      cursor,
    );
  }
  async rename(actor: Actor, id: string, title: string) {
    const name = z.string().trim().min(1).max(100).parse(title);
    await this.conversation(actor, id);
    return locked(this.store, `conversation:${id}`, "rename", async () => {
      const row = await this.conversation(actor, id);
      await this.store.update("Conversation", {
        ...row,
        title: name,
        updatedAt: new Date().toISOString(),
      });
    });
  }
  async remove(actor: Actor, id: string) {
    await this.conversation(actor, id);
    return locked(this.store, `conversation:${id}`, "delete", async () => {
      const row = await this.conversation(actor, id);
      if (row.activeRunId) {
        const run = await this.store.get("GenerationRun", row.activeRunId);
        ensure(
          !run || !["pending", "streaming"].includes(run.status),
          409,
          "Stop the active response before deleting this conversation.",
        );
      }
      await this.store.update("Conversation", {
        ...row,
        deleted: true,
        updatedAt: new Date().toISOString(),
      });
    });
  }
}
