"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cx } from "@/lib/format";

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; title: string; body?: string };
type Api = { toast: (t: Omit<Toast, "id">) => void };

const ToastContext = createContext<Api | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx.toast;
}

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { ...t, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), t.tone === "error" ? 7000 : 4500),
      );
    },
    [dismiss],
  );

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = ICONS[t.tone];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                role={t.tone === "error" ? "alert" : "status"}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-line bg-card px-4 py-3.5 text-ink shadow-card"
              >
                <Icon
                  aria-hidden
                  className={cx(
                    "mt-0.5 size-4.5 shrink-0",
                    t.tone === "success" && "text-ok",
                    t.tone === "error" && "text-danger",
                    t.tone === "info" && "text-info",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9rem] font-medium">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-[0.82rem] text-muted">{t.body}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="-m-1 grid size-7 place-items-center rounded-[3px] text-muted hover:bg-paper-2 hover:text-ink"
                  aria-label="Dismiss notification"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
