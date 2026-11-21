"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Img } from "@/components/ui/Img";
import { IMAGES } from "@/data/images";
import { ApiError } from "@/lib/api";
import { signIn, useSession } from "@/lib/session";

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
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) router.replace("/admin");
  }, [session, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setLoading(false);
      setError(messageFor(err));
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-[var(--gutter)] py-8">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href="/" className="inline-flex items-center gap-1.5 text-[0.85rem] text-muted hover:text-ink">
            <ArrowLeft aria-hidden className="size-4" /> Website
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <p className="t-eyebrow text-muted">Admin</p>
          <h1 className="mt-4 font-display text-4xl tracking-tight">Sign in to the studio</h1>
          <p className="mt-3 text-[0.95rem] text-muted">Manage projects, pages and site content.</p>

          <form onSubmit={submit} className="mt-8 grid gap-4" noValidate>
            {error && (
              <p role="alert" className="rounded-[3px] bg-danger-soft px-3.5 py-2.5 text-[0.88rem] text-danger">
                {error}
              </p>
            )}
            <Field label="Email">
              {(a) => <Input {...a} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
            <Field label="Password">
              {(a) => (
                <Input {...a} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              )}
            </Field>
            <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
              Sign in
            </Button>
          </form>
        </div>
      </div>
      <div className="relative hidden lg:block">
        <Img src={IMAGES["white-stacked-tower"].src} alt="" sizes="50vw" preload />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <p className="absolute right-10 bottom-10 left-10 font-display text-3xl leading-tight text-white">
          &ldquo;Every detail is drawn before it is poured.&rdquo;
        </p>
      </div>
    </main>
  );
}
