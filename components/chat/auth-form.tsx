"use client";
// filename: components/chat/auth-form.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { firebaseClient } from "@/modules/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
const schema = z.object({
  name: z.string().max(80),
  email: z.email(),
  password: z.string().min(1, "Enter your password.").max(128),
});
export function AuthForm({
  signUp = false,
  next = "/chat",
}: {
  signUp?: boolean;
  next?: string;
}) {
  const [error, setError] = useState("");
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(
      signUp
        ? schema.extend({
            password: z
              .string()
              .min(10, "Use at least 10 characters.")
              .max(128),
          })
        : schema,
    ),
    defaultValues: { name: "", email: "", password: "" },
  });
  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(async (values) => {
        setError("");
        try {
          const auth = await firebaseClient();
          const credential = signUp
            ? await createUserWithEmailAndPassword(
                auth,
                values.email,
                values.password,
              )
            : await signInWithEmailAndPassword(
                auth,
                values.email,
                values.password,
              );
          if (signUp) {
            await updateProfile(credential.user, {
              displayName:
                values.name || values.email.split("@")[0] || "Teammate",
            });
            await sendEmailVerification(credential.user);
          }
          const response = await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idToken: await credential.user.getIdToken(true),
            }),
          });
          if (!response.ok)
            throw new Error(
              "Session could not be created. Check Firebase configuration or sign in again.",
            );
          const destination = next === "/chat" ? next : "/chat";
          if (credential.user.emailVerified) await signOut(auth);
          window.location.assign(
            credential.user.emailVerified ? destination : "/verify-email",
          );
        } catch {
          setError(
            "Sign-in could not complete. Check your credentials and Firebase setup. Existing accounts should use Sign in.",
          );
        }
      })}
      noValidate
    >
      {signUp && (
        <div className="space-y-2">
          <Label htmlFor="auth-name">Your name</Label>
          <Input
            id="auth-name"
            autoComplete="name"
            {...form.register("name")}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          autoComplete="email"
          {...form.register("email")}
          aria-invalid={!!form.formState.errors.email}
        />
        {form.formState.errors.email && (
          <p className="text-destructive text-sm">Enter a valid email.</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="auth-password">Password</Label>
        <Input
          id="auth-password"
          type="password"
          autoComplete={signUp ? "new-password" : "current-password"}
          {...form.register("password")}
          aria-invalid={!!form.formState.errors.password}
        />
        {form.formState.errors.password && (
          <p className="text-destructive text-sm">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button
        className="w-full"
        type="submit"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting
          ? "Please wait…"
          : signUp
            ? "Create account"
            : "Sign in"}
      </Button>
    </form>
  );
}
export function VerificationControls() {
  const [message, setMessage] = useState(""),
    [pending, setPending] = useState(false),
    router = useRouter();
  async function run(resend: boolean) {
    setPending(true);
    try {
      const auth = await firebaseClient();
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user) throw new Error("Sign in again.");
      if (resend) {
        await sendEmailVerification(user);
        setMessage("Verification message requested. Check your inbox.");
      } else {
        await user.reload();
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: await user.getIdToken(true) }),
        });
        if (!response.ok) throw new Error("Sign in again.");
        if (user.emailVerified) {
          await signOut(auth);
          router.push("/chat");
          router.refresh();
        } else setMessage("Your email is not verified yet.");
      }
    } catch {
      setMessage(
        "Verification could not complete. Check Firebase setup or sign in again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => void run(false)}>
          I verified my email
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => void run(true)}
        >
          Resend verification
        </Button>
      </div>
      <p role="status" className="text-muted-foreground text-sm">
        {message}
      </p>
    </div>
  );
}
