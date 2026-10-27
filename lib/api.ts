// filename: lib/api.ts
import "server-only";
import { z } from "zod";
import { currentActor } from "../modules/auth/session";
import { Access } from "../modules/conversations/access";
import { createStore } from "./onyx/store";
import { AppError, ensure, safeMessage } from "./errors";
import { limitedText, sameOrigin } from "./http";
export const services = () => new Access(createStore());
export async function apiActor() {
  const actor = await currentActor();
  ensure(
    actor && actor.emailVerified,
    401,
    "Sign in with a verified application account.",
  );
  return actor;
}
export async function json<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  sameOrigin(request);
  return schema.parse(JSON.parse(await limitedText(request)));
}
export async function endpoint(work: () => Promise<Response>) {
  try {
    return await work();
  } catch (error) {
    const status =
      error instanceof AppError
        ? error.status
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? 422
          : 503;
    return Response.json(
      {
        error:
          error instanceof z.ZodError || error instanceof SyntaxError
            ? "Invalid request."
            : safeMessage(error),
      },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
