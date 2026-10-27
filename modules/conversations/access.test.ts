// filename: modules/conversations/access.test.ts
import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { MemoryStore } from "../../tests/fixture/memory";
import { Access, memberId } from "./access";
import { Attachments, validateFile } from "../attachments/service";
import { searchKnowledge } from "../tools/search";
import type { Actor } from "../models";
const actor: Actor = {
    uid: "a",
    email: "a@example.test",
    emailVerified: true,
    name: "A",
  },
  other = { ...actor, uid: "b" };
describe("verified user and workspace boundaries", () => {
  it("denies cross-user conversations and attachments even to another member of the same workspace", async () => {
    const store = new MemoryStore(),
      access = new Access(store),
      ws = await access.createWorkspace(actor, "Workspace A"),
      c = await access.createConversation(actor, ws.id, "demo");
    await store.insert("Membership", {
      id: memberId(ws.id, other.uid),
      workspaceId: ws.id,
      userId: other.uid,
      active: true,
      createdAt: new Date().toISOString(),
    });
    const files = new Attachments(access),
      file = await files.upload(
        actor,
        c.id,
        "hello.txt",
        "text/plain",
        Buffer.from("Hello"),
      );
    await expect(access.conversation(other, c.id)).rejects.toThrow(
      "unavailable",
    );
    await expect(files.get(other, file.id)).rejects.toThrow("unavailable");
    expect(await files.context(actor, c.id, [file.id])).toContain("Hello");
  });
  it("rechecks membership and rejects cross-workspace attachment references", async () => {
    const store = new MemoryStore(),
      access = new Access(store),
      a = await access.createWorkspace(actor, "A workspace"),
      b = await access.createWorkspace(other, "B workspace"),
      c = await access.createConversation(actor, a.id, "demo"),
      d = await access.createConversation(other, b.id, "demo");
    await expect(access.workspace(actor, b.id)).rejects.toThrow("belong");
    const files = new Attachments(access),
      file = await files.upload(
        other,
        d.id,
        "x.md",
        "text/markdown",
        Buffer.from("private"),
      );
    await expect(files.context(actor, c.id, [file.id])).rejects.toThrow(
      "unavailable",
    );
    await store.update("Membership", {
      id: memberId(a.id, actor.uid),
      workspaceId: a.id,
      userId: actor.uid,
      active: false,
      createdAt: new Date().toISOString(),
    });
    await expect(access.conversation(actor, c.id)).rejects.toThrow("belong");
  });
  it("filters the example tool by verified owner and workspace and rejects injected scope", async () => {
    const store = new MemoryStore(),
      access = new Access(store),
      a = await access.createWorkspace(actor, "A workspace"),
      b = await access.createWorkspace(other, "B workspace"),
      c = await access.createConversation(actor, a.id, "demo");
    for (const [uid, workspaceId] of [
      [actor.uid, a.id],
      [other.uid, b.id],
    ] as const)
      await store.insert("KnowledgeArticle", {
        id: randomUUID(),
        ownerUid: uid,
        workspaceId,
        title: "onboarding",
        body: "article",
        createdAt: new Date().toISOString(),
      });
    expect(
      await searchKnowledge(access, actor, c.id, { query: "onboarding" }),
    ).toHaveLength(1);
    await expect(
      searchKnowledge(access, actor, c.id, {
        query: "onboarding",
        workspaceId: b.id,
      }),
    ).rejects.toThrow();
    store.search = async () => [
      {
        id: "bad",
        workspaceId: b.id,
        ownerUid: other.uid,
        title: "bad",
        body: "bad",
        createdAt: new Date().toISOString(),
      },
    ];
    await expect(
      searchKnowledge(access, actor, c.id, { query: "onboarding" }),
    ).rejects.toThrow("outside");
  });
  it("hides deleted history and its files, validates content, and never forwards binary content", async () => {
    const store = new MemoryStore(),
      access = new Access(store),
      ws = await access.createWorkspace(actor, "Workspace"),
      c = await access.createConversation(actor, ws.id, "demo"),
      files = new Attachments(access),
      pdf = await files.upload(
        actor,
        c.id,
        "x.pdf",
        "application/pdf",
        Buffer.from("%PDF-1.7 demo"),
      );
    expect(await files.context(actor, c.id, [pdf.id])).toBe("");
    expect(() =>
      validateFile("x.pdf", "application/pdf", Buffer.from("no")),
    ).toThrow();
    expect(() =>
      validateFile("x.html", "text/html", Buffer.from("<script>")),
    ).toThrow();
    expect(() =>
      validateFile("x.txt", "text/plain", Buffer.from([255])),
    ).toThrow();
    await access.remove(actor, c.id);
    await expect(files.get(actor, pdf.id)).rejects.toThrow("unavailable");
  });
});
