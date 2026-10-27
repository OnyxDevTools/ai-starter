// filename: app/api/conversations/route.ts
import { z } from "zod";
import { apiActor, endpoint, json, services } from "@/lib/api";
import { aiMode } from "@/lib/config";
export const runtime = "nodejs";
export function GET(request: Request) {
  return endpoint(async () => {
    const actor = await apiActor(),
      url = new URL(request.url),
      id = z.uuid().parse(url.searchParams.get("workspaceId"));
    return Response.json(
      await services().list(
        actor,
        id,
        url.searchParams.get("cursor") || undefined,
      ),
    );
  });
}
export function POST(request: Request) {
  return endpoint(async () => {
    const actor = await apiActor(),
      input = await json(request, z.object({ workspaceId: z.uuid() }).strict());
    return Response.json(
      await services().createConversation(
        actor,
        input.workspaceId,
        aiMode() === "demo" ? "demo" : "live",
      ),
    );
  });
}
