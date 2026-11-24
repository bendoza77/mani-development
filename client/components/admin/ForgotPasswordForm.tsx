"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthScreen, FormAlert } from "@/components/admin/AuthScreen";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { api, ApiError } from "@/lib/api";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!EMAIL.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      // The server answers the same way whether or not the address has an account.
      await api("/api/auth/password-reset/request", { method: "POST", body: { email: email.trim() } });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "RATE_LIMITED") setError("Too many requests. Please wait a while and try again.");
      else if (err instanceof ApiError && err.status === 400) setError("Enter a valid email address.");
      else setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen title="Forgot your password?" intro="Enter the email you sign in with. We'll send you a link to choose a new password.">
      {sent ? (
        <div className="grid gap-4">
          <FormAlert tone="success">If that address is registered, a link is on its way. It works for 30 minutes.</FormAlert>
          <p className="text-[0.88rem] text-muted">No email after a few minutes? Check the spam folder, or try again.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
            >
              Send again
            </Button>
            <Link href="/admin/login" className="inline-flex h-9 items-center px-3.5 text-[0.82rem] text-muted hover:text-ink">
              Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4" noValidate>
          {error && <FormAlert>{error}</FormAlert>}
          <Field label="Email">
            {(a) => <Input {...a} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
            Send reset link
          </Button>
          <Link href="/admin/login" className="justify-self-center text-[0.85rem] text-muted underline-offset-4 hover:text-ink hover:underline">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthScreen>
  );
}
