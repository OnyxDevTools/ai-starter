// filename: lib/http.ts
import "server-only";
import { ensure } from "./errors";
export function sameOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN;
  ensure(
    expected && new URL(expected).origin === expected,
    503,
    "Configure APP_ORIGIN as an exact trusted origin without a trailing slash.",
  );
  ensure(
    request.headers.get("origin") === expected &&
      request.headers.get("sec-fetch-site") !== "cross-site",
    403,
    "Same-origin requests are required.",
  );
}
export async function limitedText(request: Request, maximum = 65536) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  let total = 0;
  const chunks: Uint8Array[] = [];
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    for (;;) {
      ensure(!signal.aborted, 408, "Request timed out.");
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maximum) {
        cancel();
        ensure(false, 413, "Request body too large.");
      }
      chunks.push(value);
    }
    ensure(!signal.aborted, 408, "Request timed out.");
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
