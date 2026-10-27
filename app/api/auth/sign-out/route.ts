// filename: app/api/auth/sign-out/route.ts
import { cookies } from "next/headers";
import { AppError, safeMessage } from "@/lib/errors";
import { sameOrigin } from "@/lib/http";
import { sessionCookie } from "@/modules/auth/session";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    (await cookies()).set(sessionCookie, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(process.env.APP_ORIGIN!).protocol === "https:",
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: safeMessage(error) },
      { status: error instanceof AppError ? error.status : 400 },
    );
  }
}
