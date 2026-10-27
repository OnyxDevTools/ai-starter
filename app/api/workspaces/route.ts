// filename: app/api/workspaces/route.ts
import { z } from "zod";
import { apiActor, endpoint, json, services } from "@/lib/api";
export const runtime = "nodejs";
export function POST(request: Request) {
  return endpoint(async () => {
    const actor = await apiActor(),
      input = await json(
        request,
        z.object({ name: z.string().trim().min(2).max(80) }).strict(),
      );
    return Response.json(await services().createWorkspace(actor, input.name));
  });
}
