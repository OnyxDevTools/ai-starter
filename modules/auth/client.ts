// filename: modules/auth/client.ts
"use client";
import { getApps, initializeApp } from "firebase/app";
import {
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from "firebase/auth";
let connected = false;
export async function firebaseClient() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  if (!projectId || !apiKey || !authDomain)
    throw new Error(
      "Configure the public Firebase application settings before signing in.",
    );
  const app = getApps()[0] || initializeApp({ projectId, apiKey, authDomain });
  const auth = getAuth(app);
  const emulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
  if (emulator && !connected) {
    if (
      !projectId.startsWith("demo-") ||
      !/^http:\/\/127\.0\.0\.1:\d+$/.test(emulator)
    )
      throw new Error("Invalid Firebase emulator configuration.");
    connectAuthEmulator(auth, emulator, { disableWarnings: true });
    connected = true;
  }
  await setPersistence(auth, browserSessionPersistence);
  return auth;
}
