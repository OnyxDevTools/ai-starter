// filename: app/api/conversations/open/route.ts
import { apiActor, endpoint, services } from "@/lib/api";
import { sameOrigin } from "@/lib/http";
import { openChat } from "@/modules/conversations/open";
export const runtime = "nodejs";
export function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    return Response.json(await openChat(services(), await apiActor()));
  });
}
