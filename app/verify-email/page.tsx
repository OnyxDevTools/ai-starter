// filename: app/verify-email/page.tsx
import Link from "next/link";
import { VerificationControls } from "@/components/chat/auth-form";
export default function VerifyEmail() {
  return (
    <main id="main" className="mx-auto max-w-lg space-y-6 px-6 py-24">
      <h1 className="text-3xl font-semibold">Check your inbox.</h1>
      <p className="text-muted-foreground">
        Verify your email before opening your private workspace.
      </p>
      <VerificationControls />
      <Link href="/sign-in" className="text-primary underline">
        Back to sign in
      </Link>
    </main>
  );
}
