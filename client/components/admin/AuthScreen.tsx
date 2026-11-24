"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Img } from "@/components/ui/Img";
import { IMAGES } from "@/data/images";

/** The split layout shared by the sign-in and password screens. */
export function AuthScreen({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
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
          <h1 className="mt-4 font-display text-4xl tracking-tight">{title}</h1>
          <p className="mt-3 text-[0.95rem] text-muted">{intro}</p>
          <div className="mt-8">{children}</div>
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

export function FormAlert({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-[3px] bg-danger-soft px-3.5 py-2.5 text-[0.88rem] text-danger"
          : "rounded-[3px] bg-ok-soft px-3.5 py-2.5 text-[0.88rem] text-ok"
      }
    >
      {children}
    </div>
  );
}
