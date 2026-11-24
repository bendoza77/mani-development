"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { API_URL } from "@/lib/api";
import { CHROME_STYLE } from "@/lib/style";

// The editor (Tiptap, drag and drop, pickers) is a separate bundle, fetched only when an admin
// starts editing. Visitors without a session never download it.
const LiveEditor = dynamic(() => import("./LiveEditor").then((m) => m.LiveEditor), {
  ssr: false,
  loading: () => (
    <div style={CHROME_STYLE} role="status" className="fixed right-4 bottom-4 z-[60] rounded-full bg-card px-4 py-2 text-[0.85rem] shadow-card">
      Loading editor…
    </div>
  ),
});

/**
 * Wraps an admin-built page. For a signed-in admin it adds an "Edit page" button that switches the
 * page into in-place editing; everyone else just sees the page.
 */
export function EditablePage({ pageId, children }: { pageId: string; children: ReactNode }) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const ctrl = new AbortController();
    // Browser only, with the session cookie. Visitors get a 401 and nothing changes.
    fetch(`${API_URL}/api/auth/session`, { credentials: "include", signal: ctrl.signal }).then(
      (res) => {
        if (res.ok) setIsAdmin(true);
      },
      () => {},
    );
    return () => ctrl.abort();
  }, []);

  if (editing) {
    return (
      <LiveEditor
        pageId={pageId}
        onClose={(saved) =>
          // After a save, fetch the page again from the server and swap it in together,
          // so the saved result shows without a full reload.
          startTransition(() => {
            if (saved) router.refresh();
            setEditing(false);
          })
        }
      />
    );
  }

  return (
    <>
      {children}
      {isAdmin && (
        <div style={CHROME_STYLE} className="fixed right-4 bottom-4 z-[60] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[0.9rem] font-medium text-paper shadow-card hover:bg-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Pencil aria-hidden className="size-4" /> Edit page
          </button>
        </div>
      )}
    </>
  );
}
