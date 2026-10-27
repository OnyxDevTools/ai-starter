// filename: app/api/chat/route.ts
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { apiActor, endpoint, json, services } from "@/lib/api";
import { submitSchema } from "@/modules/models";
import { Generation } from "@/modules/generation/service";
export const runtime = "nodejs";
export const maxDuration = 150;
export function POST(request: Request) {
  return endpoint(async () => {
    const actor = await apiActor(),
      input = await json(request, submitSchema),
      generation = new Generation(services()),
      claim = await generation.claim(actor, input);
    return createUIMessageStreamResponse({
      headers: {
        "Cache-Control": "private, no-store",
        "X-Accel-Buffering": "no",
      },
      stream: createUIMessageStream({
        execute: async ({ writer }) =>
          generation.execute(
            actor,
            claim.run,
            request.signal,
            (chunk) => writer.write(chunk),
            claim.replay,
          ),
        onError: () =>
          "The stream could not complete. Reload to see its saved status.",
      }),
    });
  });
}
