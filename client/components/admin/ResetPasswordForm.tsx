"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { AuthScreen, FormAlert } from "@/components/admin/AuthScreen";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { api, ApiError, describeIssue } from "@/lib/api";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

// The token is in the address fragment (#token=…), which browsers never send to any server.
function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const readToken = () => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";

export function ResetPasswordForm() {
  // null on the server and during hydration; "" when the address has no token.
  const token = useSyncExternalStore(subscribe, readToken, () => null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; general?: string }>({});
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (Array.from(password).length < 12) next.password = "Use at least 12 characters.";
    if (confirm !== password) next.confirm = "The two passwords don't match.";
    setErrors(next);
    if (next.password || next.confirm || !token) return;
    setLoading(true);
    try {
      await api("/api/auth/password-reset/confirm", { method: "POST", body: { token, newPassword: password } });
      setPassword("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "INVALID_OR_EXPIRED_TOKEN" || err.fieldErrors.token)) setExpired(true);
      else if (err instanceof ApiError && err.fieldErrors.newPassword?.[0]) setErrors({ password: describeIssue(err.fieldErrors.newPassword[0]) });
      else if (err instanceof ApiError && err.code === "RATE_LIMITED") setErrors({ general: "Too many attempts. Please wait a while and try again." });
      else setErrors({ general: err instanceof ApiError ? err.message : "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  const badLink = token !== null && !TOKEN.test(token);

  return (
    <AuthScreen title="Choose a new password" intro="Use at least 12 characters. A short sentence is easy to remember and hard to guess.">
      {token === null ? (
        <p className="text-[0.9rem] text-muted">Loading…</p>
      ) : done ? (
        <div className="grid gap-4">
          <FormAlert tone="success">Your password has been changed. Other signed-in devices were signed out.</FormAlert>
          <ButtonLink href="/admin/login" size="lg" className="w-full">
            Go to sign in
          </ButtonLink>
        </div>
      ) : badLink || expired ? (
        <div className="grid gap-4">
          <FormAlert>
            {badLink ? "This reset link is incomplete. Open the link from the email again, or request a new one." : "This reset link is invalid or has expired. Please request a new one."}
          </FormAlert>
          <ButtonLink href="/admin/forgot-password" variant="outline" size="lg" className="w-full">
            Request a new link
          </ButtonLink>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4" noValidate>
          {errors.general && <FormAlert>{errors.general}</FormAlert>}
          <Field label="New password" error={errors.password} hint="At least 12 characters.">
            {(a) => <Input {...a} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Field label="Repeat new password" error={errors.confirm}>
            {(a) => <Input {...a} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </Field>
          <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
            Save new password
          </Button>
          <Link href="/admin/login" className="justify-self-center text-[0.85rem] text-muted underline-offset-4 hover:text-ink hover:underline">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthScreen>
  );
}
