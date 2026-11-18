"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Img } from "@/components/ui/Img";
import { IMAGES } from "@/data/images";
import { DEMO_CREDENTIALS, signIn, useSession } from "@/lib/session";

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
    await new Promise((r) => setTimeout(r, 500));
    if (email.trim().toLowerCase() !== DEMO_CREDENTIALS.email || password !== DEMO_CREDENTIALS.password) {
      setLoading(false);
      setError("Those details don't match the demo account shown below.");
      return;
    }
    signIn(DEMO_CREDENTIALS.email);
  }

  function enterDemo() {
    signIn(DEMO_CREDENTIALS.email);
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
          <p className="t-eyebrow text-muted">Admin · Prototype</p>
          <h1 className="mt-4 font-display text-4xl tracking-tight">Sign in to the studio</h1>
          <p className="mt-3 text-[0.95rem] text-muted">Manage projects, services, inquiries and site settings.</p>

          <form onSubmit={submit} className="mt-8 grid gap-4" noValidate>
            {error && (
              <p role="alert" className="rounded-[3px] bg-danger-soft px-3.5 py-2.5 text-[0.88rem] text-danger">
                {error}
              </p>
            )}
            <Field label="Email">
              {(a) => <Input {...a} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
            <Field label="Password">
              {(a) => (
                <Input {...a} type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
              )}
            </Field>
            <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
              Sign in
            </Button>
            <Button type="button" variant="outline" size="lg" className="w-full" onClick={enterDemo}>
              Enter demo without signing in
            </Button>
          </form>

          <div className="mt-8 flex gap-3 rounded-[3px] border border-line bg-card p-4 text-[0.85rem]">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
            <div className="text-ink-soft">
              <p className="font-medium text-ink">Demo credentials</p>
              <p className="mt-1 font-mono text-[0.8rem]">
                {DEMO_CREDENTIALS.email}
                <br />
                {DEMO_CREDENTIALS.password}
              </p>
              <p className="mt-2 text-muted">
                This is a simulated sign-in stored in your browser. It is not real authentication and does not protect anything.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="relative hidden lg:block">
        <Img src={IMAGES["white-stacked-tower"].src} alt="" sizes="50vw" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <p className="absolute right-10 bottom-10 left-10 font-display text-3xl leading-tight text-white">
          &ldquo;Every detail is drawn before it is poured.&rdquo;
        </p>
      </div>
    </main>
  );
}
