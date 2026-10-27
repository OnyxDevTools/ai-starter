// filename: modules/auth/admin.ts
import "server-only";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { z } from "zod";
import { ensure } from "../../lib/errors";
import { applicationEnvironment } from "../../lib/config";
export function firebaseAdmin() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  ensure(
    projectId,
    503,
    "Configure your application's Firebase project. Private Onyx preview identity is separate from application sign-in.",
  );
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (emulator)
    ensure(
      applicationEnvironment() !== "production" &&
        projectId.startsWith("demo-") &&
        /^127\.0\.0\.1:\d+$/.test(emulator),
      503,
      "Firebase emulator use is restricted to explicit non-production demo projects on loopback.",
    );
  let app = getApps().find((app) => app.name === "ai-starter");
  if (!app) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    const account = raw
      ? z
          .object({
            project_id: z.string(),
            client_email: z.email(),
            private_key: z.string(),
          })
          .parse(JSON.parse(Buffer.from(raw, "base64").toString("utf8")))
      : null;
    ensure(
      !account || account.project_id === projectId,
      503,
      "Firebase service account project mismatch.",
    );
    app = initializeApp(
      {
        projectId,
        ...(emulator
          ? {}
          : {
              credential: account
                ? cert({
                    projectId: account.project_id,
                    clientEmail: account.client_email,
                    privateKey: account.private_key.replace(/\\n/g, "\n"),
                  })
                : applicationDefault(),
            }),
      },
      "ai-starter",
    );
  }
  return getAuth(app);
}
