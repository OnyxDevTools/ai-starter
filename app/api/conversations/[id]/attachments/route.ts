// filename: app/api/conversations/[id]/attachments/route.ts
import { z } from "zod";
import { apiActor, endpoint, services } from "@/lib/api";
import { sameOrigin } from "@/lib/http";
import { ensure } from "@/lib/errors";
import { Attachments, maximumFileBytes } from "@/modules/attachments/service";
export const runtime = "nodejs";
export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const actor = await apiActor(),
      id = z.uuid().parse((await context.params).id),
      access = services();
    await access.conversation(actor, id);
    const reader = request.body?.getReader();
    ensure(reader, 422, "Upload a file.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    const timeout = AbortSignal.timeout(10000);
    const cancel = () => void reader.cancel();
    const signal = AbortSignal.any([timeout, request.signal]);
    signal.addEventListener("abort", cancel, { once: true });
    try {
      for (;;) {
        ensure(!signal.aborted, 408, "Upload timed out.");
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maximumFileBytes) {
          await reader.cancel();
          ensure(false, 413, "Files must be at most 2 MiB.");
        }
        chunks.push(value);
      }
      ensure(!signal.aborted, 408, "Upload timed out.");
    } finally {
      signal.removeEventListener("abort", cancel);
      reader.releaseLock();
    }
    const name = decodeURIComponent(
        request.headers.get("x-file-name") || "attachment",
      ),
      mime = (request.headers.get("content-type") || "").split(";")[0] || "";
    return Response.json(
      await new Attachments(access).upload(
        actor,
        id,
        name,
        mime,
        Buffer.concat(chunks),
      ),
    );
  });
}
