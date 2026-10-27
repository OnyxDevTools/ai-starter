// filename: app/api/conversations/[id]/route.ts
import { z } from "zod";
import { apiActor, endpoint, json, services } from "@/lib/api";
import { sameOrigin } from "@/lib/http";
import { snapshot } from "@/modules/conversations/history";
type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export function GET(_request: Request, context: Context) {
  return endpoint(async () =>
    Response.json(
      await snapshot(
        services(),
        await apiActor(),
        z.uuid().parse((await context.params).id),
      ),
    ),
  );
}
export function PATCH(request: Request, context: Context) {
  return endpoint(async () => {
    const actor = await apiActor(),
      input = await json(
        request,
        z.object({ title: z.string().trim().min(1).max(100) }).strict(),
      );
    await services().rename(
      actor,
      z.uuid().parse((await context.params).id),
      input.title,
    );
    return Response.json({ ok: true });
  });
}
export function DELETE(request: Request, context: Context) {
  return endpoint(async () => {
    sameOrigin(request);
    await services().remove(
      await apiActor(),
      z.uuid().parse((await context.params).id),
    );
    return Response.json({ ok: true });
  });
}
