// filename: modules/generation/scope.test.ts
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { liveProvider } from "./provider";
import { aiMode } from "../../lib/config";
const actor = {
  uid: "verified-user",
  email: "owner@example.test",
  emailVerified: true,
  name: "Owner",
};
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "ai-scope-"));
  vi.stubEnv("AI_MODE", "live");
  vi.stubEnv("ONYX_DATABASE_ID", "");
  vi.stubEnv("ONYX_CONFIG_PATH", join(directory, "app.json"));
  vi.stubEnv("ONYX_AI_BINDINGS_PATH", join(directory, "bindings.json"));
  await writeFile(
    join(directory, "app.json"),
    JSON.stringify({ databaseId: "app-private" }),
  );
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});
async function binding(databaseId = "knowledge-private", ownerUid = actor.uid) {
  const configPath = join(directory, "ai.json");
  await writeFile(
    configPath,
    JSON.stringify({
      baseUrl: "https://fixture.invalid",
      aiBaseUrl: "https://fixture.invalid",
      databaseId,
      apiKey: "scoped-key",
      apiSecret: "scoped-secret",
    }),
  );
  await writeFile(
    join(directory, "bindings.json"),
    JSON.stringify([
      {
        ownerUid,
        workspaceId: "workspace",
        databaseId,
        configPath,
        agentIds: ["allowed-agent"],
        readOnlyPolicyReviewed: true,
        policyEvidence: "Reviewed key and agent permissions in test fixture",
      },
    ]),
  );
}
describe("live scope gate with mocked native SDK transport", () => {
  it("fails closed for a missing binding or a shared persistence database", async () => {
    await binding("knowledge-private", "someone-else");
    await expect(liveProvider(actor, "workspace")).rejects.toThrow("No scoped");
    await binding("app-private");
    await expect(liveProvider(actor, "workspace")).rejects.toThrow(
      "separate databases",
    );
  });
  it("checks model allowlist and never uses the application credential for AI", async () => {
    await binding();
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        requests.push(url);
        const headers = new Headers(init.headers);
        expect(headers.get("x-onyx-key")).toBe("scoped-key");
        expect(headers.get("x-onyx-secret")).toBe("scoped-secret");
        if (url.includes("/schemas/"))
          return Response.json({
            tables: [{ name: "KnowledgeArticle", attributes: [] }],
          });
        if (url.includes("/query/"))
          return Response.json({
            records: [
              {
                id: "kb",
                ownerUid: actor.uid,
                workspaceId: "workspace",
                title: "Example",
                body: "Safe content",
                createdAt: new Date().toISOString(),
              },
            ],
          });
        return Response.json({
          object: "list",
          data: [
            {
              id: "allowed-agent",
              object: "model",
              created: 1,
              owned_by: "onyx",
            },
            {
              id: "other-agent",
              object: "model",
              created: 1,
              owned_by: "onyx",
            },
          ],
        });
      }),
    );
    const provider = await liveProvider(actor, "workspace");
    expect(provider.models).toEqual(["allowed-agent"]);
    expect(requests).toHaveLength(3);
  });
  it("refuses a foreign row or extra table even with an operator attestation", async () => {
    await binding();
    let extra = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/schemas/")
          ? Response.json({
              tables: extra
                ? [{ name: "KnowledgeArticle" }, { name: "Message" }]
                : [{ name: "KnowledgeArticle" }],
            })
          : Response.json({
              records: [
                {
                  id: "kb",
                  ownerUid: "another-user",
                  workspaceId: "workspace",
                  title: "Private",
                  body: "Hidden",
                  createdAt: new Date().toISOString(),
                },
              ],
            }),
      ),
    );
    await expect(liveProvider(actor, "workspace")).rejects.toThrow("outside");
    extra = true;
    await expect(liveProvider(actor, "workspace")).rejects.toThrow(
      "only the scoped",
    );
  });
  it("does not silently fall back to demo in production", () => {
    vi.stubEnv("AI_MODE", "demo");
    vi.stubEnv("ALLOW_DEMO_AI", "1");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "production");
    expect(() => aiMode()).toThrow("non-production");
  });
});
