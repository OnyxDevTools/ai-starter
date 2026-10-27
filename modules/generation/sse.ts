// filename: modules/generation/sse.ts
// Normalize SSE before the native SDK parser: preserve named errors and real DONE.
export function normalizeSSE(body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const encoder = new TextEncoder();
  let pending = "",
    lines: string[] = [],
    bytes = 0,
    totalBytes = 0;
  const frame = (controller: TransformStreamDefaultController<Uint8Array>) => {
    let event = "message",
      id = "";
    const data: string[] = [];
    for (const line of lines) {
      if (line.startsWith(":")) continue;
      const at = line.indexOf(":"),
        key = at < 0 ? line : line.slice(0, at);
      let value = at < 0 ? "" : line.slice(at + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (key === "data") data.push(value);
      else if (key === "event") event = value;
      else if (key === "id") id = value;
    }
    lines = [];
    bytes = 0;
    if (!data.length) return;
    const text = data.join("\n");
    if (text === "[DONE]") {
      controller.enqueue(
        encoder.encode('data: {"__onyxEvent":"done"}\n\ndata: [DONE]\n\n'),
      );
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      value = { __onyxEvent: "protocol-error" };
    }
    if (!value || typeof value !== "object" || Array.isArray(value))
      value = { __onyxEvent: "protocol-error" };
    const payload = {
      ...(value as object),
      ...(event !== "message" ? { __onyxEvent: event } : {}),
      ...(id ? { __sseId: id } : {}),
    };
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  };
  const consume = (
    controller: TransformStreamDefaultController<Uint8Array>,
    final = false,
  ) => {
    for (;;) {
      const match = /[\r\n]/.exec(pending);
      if (!match) break;
      const at = match.index;
      if (!final && pending[at] === "\r" && at === pending.length - 1) break;
      const line = pending.slice(0, at),
        length = pending[at] === "\r" && pending[at + 1] === "\n" ? 2 : 1;
      pending = pending.slice(at + length);
      bytes += line.length;
      if (bytes > 262144) throw new Error("SSE frame exceeds budget");
      if (!line) frame(controller);
      else lines.push(line);
    }
    if (pending.length > 262144) throw new Error("SSE line exceeds budget");
  };
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        totalBytes += chunk.byteLength;
        if (totalBytes > 4 * 1024 * 1024)
          throw new Error("SSE stream exceeds budget");
        pending += decoder.decode(chunk, { stream: true });
        consume(controller);
      },
      flush(controller) {
        pending += decoder.decode();
        consume(
          controller,
          true,
        ); /* Unterminated frames intentionally don't count as a terminal event. */
      },
    }),
  );
}
