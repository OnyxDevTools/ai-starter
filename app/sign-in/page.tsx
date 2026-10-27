import project from "@/project.json";
// filename: app/sign-in/page.tsx
import Link from "next/link";
import { AuthForm } from "@/components/chat/auth-form";
import { Setup } from "@/components/chat/setup";
export default function SignIn() {
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
    return (
      <Setup message="Configure the public Firebase application settings to enable sign-in." />
    );
  return (
    <main
      id="main"
      className="chat-welcome flex min-h-dvh items-center justify-center p-6"
    >
      <div className="bg-card w-full max-w-md space-y-6 rounded-2xl border p-8">
        <p className="text-primary text-xs tracking-[.2em] uppercase">
          {project.name}
        </p>
        <h1 className="text-3xl font-semibold">Room for your next idea.</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to your private Onyx chat workspace.
        </p>
        <AuthForm />
        <p className="text-muted-foreground text-sm">
          New here?{" "}
          <Link className="text-primary underline" href="/sign-up">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
