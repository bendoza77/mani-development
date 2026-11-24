"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthScreen, FormAlert } from "@/components/admin/AuthScreen";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { nextAdminPath, signIn, useAdminSession } from "@/hooks/useAdminSession";
import { ApiError } from "@/lib/api";

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "INVALID_CREDENTIALS") return "The email or password is incorrect.";
    if (error.code === "RATE_LIMITED") return "Too many attempts. Please wait a few minutes and try again.";
    if (error.status === 400) return "Enter your email address and password.";
    return error.message;
  }
  return "Sign-in failed. Please try again.";
}

export function LoginForm() {
  const router = useRouter();
  const session = useAdminSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already signed in (or just signed in): go to the page that asked for sign-in, or the overview.
  useEffect(() => {
    if (session) router.replace(nextAdminPath(window.location.search));
  }, [session, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email address and password.");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      setPassword("");
    } catch (err) {
      setLoading(false);
      setError(messageFor(err));
    }
  }

  return (
    <AuthScreen title="Sign in to the studio" intro="Manage projects, pages and site content.">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        {error && <FormAlert>{error}</FormAlert>}
        <Field label="Email">
          {(a) => <Input {...a} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Password">
          {(a) => <Input {...a} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
          Sign in
        </Button>
        <Link href="/admin/forgot-password" className="justify-self-center text-[0.85rem] text-muted underline-offset-4 hover:text-ink hover:underline">
          Forgot password?
        </Link>
      </form>
    </AuthScreen>
  );
}
