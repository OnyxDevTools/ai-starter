// filename: modules/generation/sse.test.ts
import { describe, it, expect } from "vitest";
import { onyx } from "@onyx.dev/onyx-database";
import { normalizeSSE } from "./sse";
import { decodeChunks } from "./provider";
function input(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
      c.close();
    },
  });
}
async function actualSDK(text: string) {
  const db = onyx.init({
    baseUrl: "https://fixture.invalid",
    aiBaseUrl: "https://fixture.invalid",
    databaseId: "unit",
    apiKey: "unit",
    apiSecret: "unit",
    ttl: 0,
    retry: { enabled: false },
    fetch: async () =>
      new Response(normalizeSSE(input(text)), {
        headers: { "content-type": "text/event-stream" },
      }),
  });
  const stream = await db.ai.chat({
    model: "unit",
    stream: true,
    messages: [{ role: "user", content: "hi" }],
  });
  if (!(Symbol.asyncIterator in stream)) throw new Error("No stream");
  return Array.fromAsync(decodeChunks(stream));
}
const frame = (value: unknown) => `data: ${JSON.stringify(value)}\r\n\r\n`;
const end =
  frame({ choices: [{ delta: {}, finish_reason: "stop" }] }) +
  "data: [DONE]\r\n\r\n";
describe("native Onyx SDK → UI adapter boundary (mocked HTTP)", () => {
  it("handles byte fragments, CRLF and split Unicode without losing IDs or usage", async () => {
    const result = await actualSDK(
      ": comment\r\n\r\n" +
        frame({
          id: "request-1",
          model: "agent-1",
          choices: [{ delta: { content: "héllo 🌿" } }],
        }) +
        frame({ usage: { prompt_tokens: 12, total_tokens: 19 }, choices: [] }) +
        end,
    );
    expect(result).toContainEqual({ type: "text", text: "héllo 🌿" });
    expect(result).toContainEqual({
      type: "identity",
      model: "agent-1",
      requestId: "request-1",
    });
    expect(result).toContainEqual({
      type: "usage",
      prompt: 12,
      completion: null,
      total: 19,
    });
  });
  it("keeps a named error sticky even if DONE follows", async () => {
    await expect(
      actualSDK(
        'event: error\r\ndata: {"message":"private error"}\r\n\r\n' + end,
      ),
    ).rejects.toThrow("stream error");
  });
  it("rejects invalid JSON and EOF without a real terminal event", async () => {
    await expect(actualSDK("data: nope\n\n" + end)).rejects.toThrow();
    await expect(
      actualSDK(frame({ choices: [{ delta: { content: "partial" } }] })),
    ).rejects.toThrow("disconnected");
    await expect(actualSDK("data: [DONE]\n\n")).rejects.toThrow("disconnected");
  });
  it("preserves fragmented tool arguments and provider-executed results", async () => {
    const result = await actualSDK(
      frame({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call-7",
                  function: { name: "native_search", arguments: '{"q":' },
                },
              ],
            },
          },
        ],
      }) +
        frame({
          choices: [
            {
              delta: {
                tool_calls: [{ index: 0, function: { arguments: '"one"}' } }],
              },
            },
          ],
        }) +
        frame({
          choices: [
            {
              delta: { role: "tool", tool_call_id: "call-7", content: "found" },
            },
          ],
        }) +
        end,
    );
    expect(result).toContainEqual({
      type: "tool",
      index: 0,
      id: "call-7",
      name: "native_search",
      arguments: '{"q":',
    });
    expect(result).toContainEqual({
      type: "result",
      id: "call-7",
      text: "found",
    });
  });
});
