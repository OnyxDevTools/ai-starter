// filename: modules/generation/provider.ts
import "server-only";
import { readFile } from "node:fs/promises";
import {
  onyx,
  type AiChatMessage,
  type IOnyxDatabase,
} from "@onyx.dev/onyx-database";
import { z } from "zod";
import { AppError, ensure } from "../../lib/errors";
import { aiMode } from "../../lib/config";
import { normalizeSSE } from "./sse";
import { collect, createStore } from "../../lib/onyx/store";
import type { Actor, Rows } from "../models";
const bindingSchema = z
  .object({
    ownerUid: z.string().min(1),
    workspaceId: z.string().min(1),
    databaseId: z.string().min(1),
    configPath: z.string().startsWith("/"),
    agentIds: z.array(z.string().min(1)).min(1),
    readOnlyPolicyReviewed: z.literal(true),
    policyEvidence: z.string().min(20),
  })
  .strict();
const configSchema = z.object({
  baseUrl: z.url(),
  aiBaseUrl: z.url(),
  databaseId: z.string().min(1),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
});
export type ProviderEvent =
  | { type: "text"; text: string }
  | { type: "tool"; index: number; id: string; name: string; arguments: string }
  | { type: "result"; id: string; text: string }
  | {
      type: "usage";
      prompt: number | null;
      completion: number | null;
      total: number | null;
    }
  | { type: "identity"; model: string; requestId: string }
  | { type: "finish"; reason: string }
  | { type: "done" }
  | { type: "source"; title: string; url: string; documentId: string };
export type Provider = {
  models: string[];
  stream(
    model: string,
    messages: AiChatMessage[],
    signal: AbortSignal,
    tools: boolean,
  ): AsyncGenerator<ProviderEvent>;
};
const usage = z.number().int().nonnegative().nullable().optional();
const chunkSchema = z.object({
  __onyxEvent: z.string().optional(),
  id: z.string().optional(),
  model: z.string().optional(),
  error: z.unknown().optional(),
  usage: z
    .object({
      prompt_tokens: usage,
      completion_tokens: usage,
      total_tokens: usage,
    })
    .optional(),
  sources: z
    .array(
      z.object({
        title: z.string().max(300),
        url: z.url().max(2000).optional(),
        document_id: z.string().max(256).optional(),
      }),
    )
    .max(20)
    .optional(),
  choices: z
    .array(
      z.object({
        index: z.number().optional(),
        finish_reason: z.string().nullable().optional(),
        delta: z.object({
          role: z.string().nullable().optional(),
          content: z.string().nullable().optional(),
          tool_call_id: z.string().nullable().optional(),
          tool_calls: z
            .array(
              z.object({
                index: z.number().int().optional(),
                id: z.string().optional(),
                function: z
                  .object({
                    name: z.string().optional(),
                    arguments: z.string().optional(),
                  })
                  .optional(),
              }),
            )
            .optional(),
        }),
      }),
    )
    .optional(),
});
export async function* decodeChunks(
  chunks: AsyncIterable<unknown>,
): AsyncGenerator<ProviderEvent> {
  let done = false,
    finish = false;
  for await (const raw of chunks) {
    const c = chunkSchema.parse(raw);
    if (
      ("error" in c && c.error !== undefined) ||
      c.__onyxEvent === "error" ||
      c.__onyxEvent === "protocol-error"
    )
      throw new AppError(
        502,
        "Onyx reported a stream error. Retry explicitly after reviewing the saved response.",
      );
    if (c.__onyxEvent === "done") {
      done = true;
      yield { type: "done" };
      continue;
    }
    if (done)
      throw new AppError(
        502,
        "Unexpected content after Onyx completed the stream.",
      );
    if (c.model || c.id)
      yield { type: "identity", model: c.model || "", requestId: c.id || "" };
    if (c.usage)
      yield {
        type: "usage",
        prompt: c.usage.prompt_tokens ?? null,
        completion: c.usage.completion_tokens ?? null,
        total: c.usage.total_tokens ?? null,
      };
    for (const source of c.sources || [])
      if (!source.url || /^https?:\/\//.test(source.url))
        yield {
          type: "source",
          title: source.title,
          url: source.url || "",
          documentId: source.document_id || "",
        };
    for (const choice of c.choices || []) {
      const d = choice.delta;
      if (d.role === "tool") {
        ensure(
          d.tool_call_id,
          502,
          "Onyx tool result was missing its call identifier.",
        );
        yield { type: "result", id: d.tool_call_id, text: d.content || "" };
      } else if (d.content) yield { type: "text", text: d.content };
      for (const [i, t] of (d.tool_calls || []).entries())
        yield {
          type: "tool",
          index: t.index ?? i,
          id: t.id || "",
          name: t.function?.name || "",
          arguments: t.function?.arguments || "",
        };
      if (choice.finish_reason) {
        finish = true;
        yield { type: "finish", reason: choice.finish_reason };
      }
    }
  }
  ensure(
    done && finish,
    502,
    "Onyx disconnected before a complete terminal event. The partial response is saved as interrupted.",
  );
}
export const knowledgeTool = {
  type: "function",
  function: {
    name: "app_search_knowledge",
    description:
      "Read the signed-in user's workspace knowledge. Scope is enforced by the server.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", maxLength: 500 } },
      required: ["query"],
      additionalProperties: false,
    },
  },
};
export async function liveProvider(
  actor: Actor,
  workspaceId: string,
): Promise<Provider> {
  ensure(
    aiMode() === "live",
    503,
    "Live Onyx AI is disabled. Configure AI_MODE and a scoped agent binding, or use explicit local demo mode.",
  );
  try {
    ensure(
      process.env.ONYX_AI_BINDINGS_PATH,
      503,
      "Configure ONYX_AI_BINDINGS_PATH with a reviewed read-only agent binding.",
    );
    const bindings = z
      .array(bindingSchema)
      .parse(
        JSON.parse(await readFile(process.env.ONYX_AI_BINDINGS_PATH, "utf8")),
      );
    const binding = bindings.find(
      (b) => b.ownerUid === actor.uid && b.workspaceId === workspaceId,
    );
    ensure(
      binding,
      503,
      "No scoped Onyx agent is configured for your account and workspace.",
    );
    const config = configSchema.parse(
      JSON.parse(await readFile(binding.configPath, "utf8")),
    );
    ensure(
      config.databaseId === binding.databaseId,
      503,
      "The Onyx agent database does not match its binding.",
    );
    // Explicit config for every credential; never inherit the application's broad persistence key.
    const persistencePath = process.env.ONYX_CONFIG_PATH;
    ensure(
      persistencePath,
      503,
      "Use a downloaded application configuration via ONYX_CONFIG_PATH.",
    );
    const appConfig = z
      .object({ databaseId: z.string() })
      .parse(JSON.parse(await readFile(persistencePath, "utf8")));
    ensure(
      (process.env.ONYX_DATABASE_ID?.trim() || appConfig.databaseId) !==
        config.databaseId,
      503,
      "Agent and application persistence must use separate databases.",
    );
    const init = (signal: AbortSignal) =>
      onyx.init<Rows>({
        ...config,
        wireFormat: "json",
        ttl: 0,
        retry: { enabled: false },
        requestLoggingEnabled: false,
        responseLoggingEnabled: false,
        fetch: async (input, options) => {
          const response = await fetch(input, {
            ...options,
            body:
              options?.body instanceof Uint8Array
                ? new Uint8Array(options.body).buffer
                : (options?.body ?? null),
            signal,
            cache: "no-store",
          });
          if (
            !response.body ||
            !response.ok ||
            !response.headers.get("content-type")?.includes("text/event-stream")
          )
            return response;
          return new Response(normalizeSSE(response.body), {
            status: response.status,
            headers: response.headers,
          });
        },
      });
    const db = init(AbortSignal.timeout(12000));
    const schema = await db.getSchema();
    const tables = z
      .array(z.object({ name: z.string() }))
      .parse(schema.tables || schema.entities || []);
    ensure(
      tables.length === 1 && tables[0]?.name === "KnowledgeArticle",
      503,
      "Agent databases may contain only the scoped KnowledgeArticle table.",
    );
    const rows = await collect(createStore(db), "KnowledgeArticle", {}, 1000);
    ensure(
      rows.every(
        (r) => r.ownerUid === actor.uid && r.workspaceId === workspaceId,
      ),
      503,
      "Agent knowledge contains data outside the bound user and workspace.",
    );
    const available = await db.ai.getModels();
    const models = available.data
      .map((m) => m.id)
      .filter((id) => binding.agentIds.includes(id));
    ensure(
      models.length,
      503,
      "The scoped key cannot access any configured published Onyx agents.",
    );
    return {
      models,
      async *stream(model, messages, signal, tools) {
        ensure(models.includes(model), 403, "Agent unavailable.");
        const active = init(signal);
        const result = await active.ai.chat({
          model,
          messages,
          stream: true,
          max_tokens: 4096,
          user: actor.uid,
          ...(tools ? { tools: [knowledgeTool] } : {}),
        });
        ensure(
          Symbol.asyncIterator in result,
          502,
          "Onyx did not return a streaming response.",
        );
        const cancel = () => result.cancel();
        signal.addEventListener("abort", cancel, { once: true });
        try {
          yield* decodeChunks(result);
        } finally {
          signal.removeEventListener("abort", cancel);
          result.cancel();
        }
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      "Scoped Onyx configuration could not be verified. Check binding, agent policy, SDK configuration, schema and credentials.",
    );
  }
}
export function demoProvider(attempt: number): Provider {
  return {
    models: ["demo-local"],
    async *stream(_model, messages, signal, tools) {
      const text =
        messages.filter((m) => m.role === "user").at(-1)?.content || "";
      if (tools && !messages.some((m) => m.role === "tool")) {
        yield {
          type: "tool",
          index: 0,
          id: "demo-search-1",
          name: "app_search_knowledge",
          arguments: JSON.stringify({ query: "onboarding" }),
        };
        yield { type: "finish", reason: "tool_calls" };
        yield { type: "done" };
        return;
      }
      const answer =
        "## A clean starting point\n\nThis is the **local demo**, not an Onyx model response. Your conversation and attachments use the configured Onyx storage.\n\n- Start with one clear goal.\n- Keep your data scoped to its workspace.\n- Build on the native Onyx agent integration.\n\n```ts\nconst nextStep = 'Make it yours';\n```\n";
      for (const part of answer.match(/.{1,12}|\n/g) || []) {
        signal.throwIfAborted();
        await new Promise((resolve) => setTimeout(resolve, 35));
        yield { type: "text", text: part };
        if (
          text.includes("[demo:error]") &&
          attempt === 1 &&
          part.includes("local")
        )
          throw new AppError(
            502,
            "Demonstration error. Use Retry to start an explicit new attempt.",
          );
      }
      yield { type: "finish", reason: "stop" };
      yield { type: "done" };
    },
  };
}
// Keep this type exported for injected contract tests; no alternate runtime persistence backend.
export type OnyxAIClient = IOnyxDatabase<Rows>;
