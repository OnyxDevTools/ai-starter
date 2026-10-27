// filename: app/api/auth/session/route.ts
import { cookies } from "next/headers";
import { z } from "zod";
import { AppError, ensure, safeMessage } from "@/lib/errors";
import { limitedText, sameOrigin } from "@/lib/http";
import { firebaseAdmin } from "@/modules/auth/admin";
import { sessionCookie } from "@/modules/auth/session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    ensure(
      request.headers.get("content-type")?.includes("application/json"),
      415,
      "JSON is required.",
    );
    const { idToken } = z
      .object({ idToken: z.string().min(1).max(20000) })
      .strict()
      .parse(JSON.parse(await limitedText(request, 24000)));
    const auth = firebaseAdmin();
    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken, true);
    } catch {
      throw new AppError(401, "Firebase sign-in could not be verified.");
    }
    ensure(
      Date.now() / 1000 - decoded.auth_time < 300,
      401,
      "Sign in again to create a session.",
    );
    const expiresIn = 5 * 86400000,
      session = await auth.createSessionCookie(idToken, { expiresIn });
    (await cookies()).set(sessionCookie, session, {
      httpOnly: true,
      secure: new URL(process.env.APP_ORIGIN!).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn / 1000,
    });
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: safeMessage(error) },
      {
        status: error instanceof AppError ? error.status : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
