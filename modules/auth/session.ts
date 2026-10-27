// filename: modules/auth/session.ts
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Actor } from "../models";
import { firebaseAdmin } from "./admin";
export const sessionCookie = "ai_session";
export const currentActor = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const auth = firebaseAdmin(),
      claims = await auth.verifySessionCookie(token, true),
      user = await auth.getUser(claims.uid);
    if (user.disabled || !user.email) return null;
    return {
      uid: user.uid,
      email: user.email.toLowerCase(),
      emailVerified: user.emailVerified,
      name: (user.displayName || user.email).slice(0, 80),
    };
  } catch {
    return null;
  }
});
export async function requireActor() {
  const actor = await currentActor();
  if (!actor) redirect("/sign-in");
  if (!actor.emailVerified) redirect("/verify-email");
  return actor;
}
