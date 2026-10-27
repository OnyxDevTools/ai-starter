// filename: tests/fixture/users.ts
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
if (
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9199" ||
  process.env.FIREBASE_PROJECT_ID !== "demo-ai-starter"
)
  throw new Error(
    "Test identities are restricted to the local Firebase Auth Emulator.",
  );
const auth = getAuth(initializeApp({ projectId: "demo-ai-starter" }));
await fetch(
  "http://127.0.0.1:9199/emulator/v1/projects/demo-ai-starter/accounts",
  { method: "DELETE" },
);
for (const [uid, email, name] of [
  ["owner-test", "owner@example.test", "Alex Owner"],
  ["member-test", "member@example.test", "Sam Member"],
  ["other-test", "other@example.test", "Other Owner"],
])
  await auth.createUser({
    uid: uid!,
    email: email!,
    displayName: name!,
    password: "development-test-password",
    emailVerified: true,
  });
