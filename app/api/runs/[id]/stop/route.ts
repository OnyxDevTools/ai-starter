// filename: app/api/runs/[id]/stop/route.ts
import { z } from "zod";
import { apiActor, endpoint, services } from "@/lib/api";
import { sameOrigin } from "@/lib/http";
import { Generation } from "@/modules/generation/service";
export const runtime = "nodejs";
export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    await new Generation(services()).stop(
      await apiActor(),
      z.uuid().parse((await context.params).id),
    );
    return Response.json({ ok: true });
  });
}
