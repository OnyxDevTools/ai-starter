import project from "@/project.json";
// filename: app/sign-up/page.tsx
import Link from "next/link";
import { AuthForm } from "@/components/chat/auth-form";
export default function SignUp() {
  return (
    <main
      id="main"
      className="chat-welcome flex min-h-dvh items-center justify-center p-6"
    >
      <div className="bg-card w-full max-w-md space-y-6 rounded-2xl border p-8">
        <p className="text-primary text-xs tracking-[.2em] uppercase">
          {project.name}
        </p>
        <h1 className="text-3xl font-semibold">Make space to think.</h1>
        <AuthForm signUp />
        <Link className="text-primary text-sm underline" href="/sign-in">
          Already have an account? Sign in
        </Link>
      </div>
    </main>
  );
}
