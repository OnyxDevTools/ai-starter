// filename: app/api/attachments/[id]/route.ts
import { z } from "zod";
import { apiActor, endpoint, services } from "@/lib/api";
import { Attachments, maximumFileBytes } from "@/modules/attachments/service";
import { ensure } from "@/lib/errors";
export const runtime = "nodejs";
export function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const access = services(),
      file = await new Attachments(access).get(
        await apiActor(),
        z.uuid().parse((await context.params).id),
      ),
      content = await access.store.document(file.documentId);
    ensure(
      content.length === file.size && content.length <= maximumFileBytes,
      503,
      "Stored file is unavailable.",
    );
    return new Response(new Uint8Array(content), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  });
}
