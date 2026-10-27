// filename: modules/generation/service.test.ts
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it, expect, vi } from "vitest";
import type { UIMessageChunk } from "ai";
import { MemoryStore } from "../../tests/fixture/memory";
import { Access } from "../conversations/access";
import { snapshot } from "../conversations/history";
import { Generation } from "./service";
import type { Provider, ProviderEvent } from "./provider";
import type { Actor, Submit } from "../models";
const actor: Actor = {
  uid: "owner",
  email: "owner@example.test",
  emailVerified: true,
  name: "Owner",
};
async function fixture(events: ProviderEvent[]) {
  const store = new MemoryStore(),
    access = new Access(store),
    workspace = await access.createWorkspace(actor, "Private workspace"),
    conversation = await access.createConversation(actor, workspace.id, "demo");
  const stream = vi.fn(async function* () {
      yield* events;
    }),
    factory = vi.fn(async () => ({ models: ["test"], stream }) as Provider),
    generation = new Generation(access, factory);
  const input: Submit = {
    conversationId: conversation.id,
    requestId: randomUUID(),
    messageId: randomUUID(),
    text: "Hello",
    model: "test",
    attachmentIds: [],
    useKnowledge: false,
  };
  return { store, access, workspace, conversation, stream, generation, input };
}
const success: ProviderEvent[] = [
  { type: "text", text: "Hello there" },
  { type: "finish", reason: "stop" },
  { type: "done" },
];
beforeEach(() => {
  vi.stubEnv("AI_MODE", "demo");
  vi.stubEnv("ALLOW_DEMO_AI", "1");
  vi.stubEnv("APP_ENV", "preview");
});
describe("durable generation", () => {
  it("completes, persists, replays duplicates without another provider call or user message", async () => {
    const f = await fixture(success),
      claim = await f.generation.claim(actor, f.input),
      chunks: UIMessageChunk[] = [];
    await f.generation.execute(
      actor,
      claim.run,
      new AbortController().signal,
      (c) => chunks.push(c),
    );
    const repeated = await f.generation.claim(actor, f.input);
    await f.generation.execute(
      actor,
      repeated.run,
      new AbortController().signal,
      () => {},
      repeated.replay,
    );
    expect(f.stream).toHaveBeenCalledTimes(1);
    const data = await snapshot(f.access, actor, f.conversation.id);
    expect(data.messages).toHaveLength(2);
    expect(data.runs[0]?.status).toBe("completed");
    expect(data.runs[0]?.totalTokens).toBeNull();
    expect(chunks).toContainEqual({
      type: "text-delta",
      id: claim.run.assistantMessageId,
      delta: "Hello there",
    });
  });
  it("doesn't complete a truncated stream and retries reuse the original user turn", async () => {
    const f = await fixture([{ type: "text", text: "Partial" }]),
      claim = await f.generation.claim(actor, f.input);
    await f.generation.execute(
      actor,
      claim.run,
      new AbortController().signal,
      () => {},
    );
    expect((await f.access.run(actor, claim.run.id)).status).toBe(
      "interrupted",
    );
    await f.generation.claim(actor, {
      ...f.input,
      requestId: randomUUID(),
      retryRunId: claim.run.id,
    });
    const data = await snapshot(f.access, actor, f.conversation.id);
    expect(data.messages.filter((m) => m.role === "user")).toHaveLength(1);
    expect(data.runs.at(-1)?.attempt).toBe(2);
  });
  it("cancels upstream and saves partial output", async () => {
    const f = await fixture(success),
      claim = await f.generation.claim(actor, f.input),
      controller = new AbortController();
    await f.generation.execute(actor, claim.run, controller.signal, (c) => {
      if (c.type === "text-delta") controller.abort();
    });
    expect((await f.access.run(actor, claim.run.id)).status).toBe("cancelled");
    expect(
      (await f.store.get("Message", claim.run.assistantMessageId))?.text,
    ).toBe("Hello there");
  });
  it("doesn't rerun Onyx-managed tools; records their exact identifiers and results", async () => {
    const f = await fixture([
      {
        type: "tool",
        index: 0,
        id: "native-call",
        name: "native_search",
        arguments: '{"query":"onboarding"}',
      },
      { type: "result", id: "native-call", text: "native result" },
      ...success,
    ]);
    const claim = await f.generation.claim(actor, f.input);
    await f.generation.execute(
      actor,
      claim.run,
      new AbortController().signal,
      () => {},
    );
    const data = await snapshot(f.access, actor, f.conversation.id);
    expect(data.tools[0]).toMatchObject({
      callId: "native-call",
      managedBy: "onyx",
      status: "completed",
      outputText: "native result",
    });
    expect(f.store.searches).toBe(0);
    await expect(
      f.generation.claim(actor, {
        ...f.input,
        requestId: randomUUID(),
        retryRunId: claim.run.id,
      }),
    ).rejects.toThrow("Automatic retry is disabled");
  });
  it("preserves approval IDs and refuses write/script approval", async () => {
    const f = await fixture([
      {
        type: "tool",
        index: 0,
        id: "call-approval",
        name: "request_script_approval",
        arguments: '{"approval_id":"approval-real","script":"untrusted"}',
      },
      ...success,
    ]);
    const claim = await f.generation.claim(actor, f.input),
      chunks: UIMessageChunk[] = [];
    await f.generation.execute(
      actor,
      claim.run,
      new AbortController().signal,
      (c) => chunks.push(c),
    );
    expect((await f.access.run(actor, claim.run.id)).status).toBe("failed");
    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: "tool-approval-request",
        approvalId: "approval-real",
        toolCallId: "call-approval",
      }),
    );
    expect(f.store.searches).toBe(0);
  });
  it("recovers an expired run and fences late workers", async () => {
    const f = await fixture(success),
      claim = await f.generation.claim(actor, f.input);
    await f.store.update("GenerationRun", {
      ...claim.run,
      expiresAt: new Date(0).toISOString(),
    });
    await snapshot(f.access, actor, f.conversation.id);
    await f.generation.execute(
      actor,
      claim.run,
      new AbortController().signal,
      () => {},
    );
    expect((await f.access.run(actor, claim.run.id)).status).toBe(
      "interrupted",
    );
  });
  it("isolates demo outputs and rejects switching their mode", async () => {
    const f = await fixture(success);
    expect((await f.generation.claim(actor, f.input)).run.mode).toBe("demo");
    vi.stubEnv("AI_MODE", "live");
    await expect(
      f.generation.claim(actor, { ...f.input, requestId: randomUUID() }),
    ).rejects.toThrow("AI mode");
  });
  it("retains native tool results even when the stream errors before DONE", async () => {
    const f = await fixture([
      {
        type: "tool",
        index: 0,
        id: "native-early",
        name: "native_search",
        arguments: "{}",
      },
      { type: "result", id: "native-early", text: "finished native read" },
    ]);
    const claim = await f.generation.claim(actor, f.input);
    await f.generation.execute(
      actor,
      claim.run,
      new AbortController().signal,
      () => {},
    );
    const data = await snapshot(f.access, actor, f.conversation.id);
    expect(data.runs[0]?.status).toBe("interrupted");
    expect(data.tools[0]).toMatchObject({
      managedBy: "onyx",
      status: "completed",
      outputText: "finished native read",
    });
  });
  it("reuses a completed application read on explicit retry", async () => {
    const f = await fixture([
      {
        type: "tool",
        index: 0,
        id: "app-1",
        name: "app_search_knowledge",
        arguments: '{"query":"onboarding"}',
      },
      ...success,
    ]);
    const input = { ...f.input, useKnowledge: true },
      claim = await f.generation.claim(actor, input);
    await f.generation.execute(
      actor,
      claim.run,
      new AbortController().signal,
      () => {},
    );
    const retry = await f.generation.claim(actor, {
      ...input,
      requestId: randomUUID(),
      retryRunId: claim.run.id,
    });
    await f.generation.execute(
      actor,
      retry.run,
      new AbortController().signal,
      () => {},
    );
    expect(f.store.searches).toBe(1);
    expect(
      (await snapshot(f.access, actor, f.conversation.id)).messages.filter(
        (m) => m.role === "user",
      ),
    ).toHaveLength(1);
  });
  it("honors a durable stop from another service instance", async () => {
    const f = await fixture(success);
    const upstream = vi.fn(async function* (
      _model: string,
      _messages: unknown,
      signal: AbortSignal,
    ) {
      yield { type: "text", text: "partial" } as const;
      await new Promise<void>((resolve) =>
        signal.addEventListener("abort", () => resolve(), { once: true }),
      );
      signal.throwIfAborted();
    });
    const generation = new Generation(f.access, async () => ({
      models: ["test"],
      stream: upstream,
    }));
    const claim = await generation.claim(actor, f.input);
    let stop: Promise<void> | undefined;
    await generation.execute(
      actor,
      claim.run,
      new AbortController().signal,
      (chunk) => {
        if (chunk.type === "text-delta")
          stop = new Generation(f.access).stop(actor, claim.run.id);
      },
    );
    await stop;
    expect((await f.access.run(actor, claim.run.id)).status).toBe("cancelled");
  });
});
