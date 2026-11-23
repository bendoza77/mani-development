"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Briefcase,
  Building2,
  ChevronRight,
  ExternalLink,
  FileText,
  GalleryHorizontalEnd,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ListTree,
  LogOut,
  Menu,
  MessageSquareQuote,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Signpost,
  Star,
  Sun,
  Users,
  X,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { Popover } from "@/components/ui/Popover";
import { useToast } from "@/components/ui/Toast";
import { useAdminPoll } from "@/hooks/useAdminPoll";
import { signOut, useAdminSession } from "@/hooks/useAdminSession";
import { useDebounced } from "@/hooks/useDebounced";
import { useNow } from "@/hooks/useNow";
import { useStoredPref } from "@/hooks/useStoredPref";
import { useApplyTheme, useThemePref, type ThemePreference } from "@/hooks/useThemePref";
import { api, errorMessage, type InquiryList, type NotificationList, type ReviewList, type SearchResult } from "@/lib/api";
import { cx, timeAgo } from "@/lib/format";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/projects", label: "Projects", icon: Building2 },
  { href: "/admin/pages", label: "Pages", icon: FileText },
  { href: "/admin/slider", label: "Homepage slider", icon: GalleryHorizontalEnd },
  { href: "/admin/navigation", label: "Menus", icon: ListTree },
  { href: "/admin/services", label: "Services", icon: Briefcase },
  { href: "/admin/inquiries", label: "Inquiries", icon: Inbox, badge: "inquiries" as const },
  { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquareQuote },
  { href: "/admin/reviews", label: "Reviews", icon: Star, badge: "reviews" as const },
  { href: "/admin/team", label: "Team", icon: Users },
  { href: "/admin/media", label: "Media", icon: ImageIcon },
  { href: "/admin/redirects", label: "Redirects", icon: Signpost },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const SEGMENT_LABEL: Record<string, string> = {
  admin: "Admin",
  projects: "Projects",
  pages: "Pages",
  slider: "Homepage slider",
  navigation: "Menus",
  services: "Services",
  inquiries: "Inquiries",
  testimonials: "Testimonials",
  reviews: "Reviews",
  team: "Team",
  media: "Media",
  redirects: "Redirects",
  settings: "Settings",
  new: "New",
  edit: "Edit",
};

export function AdminShell({ children }: { children: ReactNode }) {
  const session = useAdminSession();
  const pathname = usePathname();
  const [sidebarPref, setSidebarPref] = useStoredPref("lintel:sidebar", "open");
  const collapsed = sidebarPref === "collapsed";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  useApplyTheme();

  // Signed out (or the session ended on the server): a full reload onto the sign-in page, so no
  // admin data stays in memory. The current address comes back after signing in.
  useEffect(() => {
    if (session !== null) return;
    const here = window.location.pathname + window.location.search;
    window.location.replace(`/admin/login?next=${encodeURIComponent(here)}`);
  }, [session]);

  const signedIn = !!session;
  const inbox = useAdminPoll<InquiryList>(signedIn ? "/api/admin/inquiries?status=new&pageSize=1" : null, { refreshKey: pathname });
  const newInquiries = inbox.data?.counts.new ?? 0;
  const reviewsPoll = useAdminPoll<ReviewList>(signedIn ? "/api/admin/reviews?status=pending" : null, { refreshKey: pathname });
  const pendingReviews = reviewsPoll.data?.counts.pending ?? 0;

  const toggleCollapsed = () => setSidebarPref(collapsed ? "open" : "collapsed");

  useEffect(() => {
    const d = drawer.current;
    if (!d) return;
    if (drawerOpen && !d.open) d.showModal();
    if (!drawerOpen && d.open) d.close();
  }, [drawerOpen]);

  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setDrawerOpen(false);
  }

  // The panel always renders (so route segments render on the server and prefetch normally);
  // it stays hidden and inert until the server has confirmed the session.
  const gated = !session;

  return (
    <>
      {gated && (
        <div className="grid min-h-dvh place-items-center" aria-busy="true">
          <div className="flex flex-col items-center gap-4 text-muted">
            <LogoMark className="size-10 animate-pulse text-ink" />
            <p className="t-meta">{session === null ? "Redirecting to sign in…" : "Checking your session…"}</p>
          </div>
        </div>
      )}
      <div className="flex min-h-dvh" hidden={gated} inert={gated}>
        <aside
          className={cx(
            "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-card transition-[width] duration-300 ease-(--ease-arch) lg:flex",
            collapsed ? "w-[4.5rem]" : "w-64",
          )}
          aria-label="Admin navigation"
        >
          <SidebarContent collapsed={collapsed} pathname={pathname} newInquiries={newInquiries} pendingReviews={pendingReviews} />
          <button
            type="button"
            onClick={toggleCollapsed}
            className="mx-3 mb-3 flex h-10 items-center gap-3 rounded-[3px] px-3 text-[0.85rem] text-muted hover:bg-paper-2 hover:text-ink"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen aria-hidden className="size-4.5" /> : <PanelLeftClose aria-hidden className="size-4.5" />}
            {!collapsed && "Collapse"}
          </button>
        </aside>

        <dialog
          ref={drawer}
          aria-label="Admin navigation"
          onCancel={(e) => {
            e.preventDefault();
            setDrawerOpen(false);
          }}
          onClick={(e) => e.target === e.currentTarget && setDrawerOpen(false)}
          className="drawer m-0 h-dvh max-h-none w-[min(20rem,86vw)] border-0 bg-transparent p-0 lg:hidden"
        >
          <div className="flex h-full flex-col border-r border-line bg-card text-ink">
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="grid size-11 place-items-center rounded-[3px] hover:bg-paper-2"
                aria-label="Close navigation"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <SidebarContent collapsed={false} pathname={pathname} newInquiries={newInquiries} pendingReviews={pendingReviews} />
          </div>
        </dialog>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            onMenu={() => setDrawerOpen(true)}
            pathname={pathname}
            email={session?.email ?? ""}
            name={session?.name ?? ""}
            signedIn={signedIn}
          />
          <main id="admin-main" className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

function SidebarContent({ collapsed, pathname, newInquiries, pendingReviews }: { collapsed: boolean; pathname: string; newInquiries: number; pendingReviews: number }) {
  return (
    <>
      <div className={cx("flex h-16 items-center border-b border-line", collapsed ? "justify-center" : "px-5")}>
        <Link href="/admin" aria-label="Admin overview">
          {collapsed ? <LogoMark className="size-7" /> : <Logo compact />}
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const count = item.badge === "inquiries" ? newInquiries : item.badge === "reviews" ? pendingReviews : 0;
            const badge = count > 0 ? count : null;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cx(
                    "relative flex h-10 items-center gap-3 rounded-[3px] text-[0.9rem] transition-colors",
                    collapsed ? "justify-center" : "px-3",
                    active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-2 hover:text-ink",
                  )}
                >
                  <item.icon aria-hidden className="size-4.5 shrink-0" />
                  {collapsed ? <span className="sr-only">{item.label}</span> : <span className="flex-1">{item.label}</span>}
                  {badge !== null && (
                    <span
                      className={cx(
                        "grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[0.7rem] font-semibold text-accent-ink tabular-nums",
                        collapsed && "absolute top-1 right-1 h-4 min-w-4 px-1 text-[0.6rem]",
                      )}
                    >
                      {badge}
                      <span className="sr-only"> new</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-line p-3">
        <Link
          href="/"
          target="_blank"
          title={collapsed ? "View website" : undefined}
          className={cx(
            "flex h-10 items-center gap-3 rounded-[3px] text-[0.85rem] text-muted hover:bg-paper-2 hover:text-ink",
            collapsed ? "justify-center" : "px-3",
          )}
        >
          <ExternalLink aria-hidden className="size-4.5 shrink-0" />
          {collapsed ? <span className="sr-only">View website (new tab)</span> : "View website"}
        </Link>
      </div>
    </>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const parts = pathname.split("/").filter(Boolean);
  // Record ids (in edit addresses) have no label of their own and are left out.
  const crumbs = parts
    .map((seg, i) => ({ seg, href: "/" + parts.slice(0, i + 1).join("/"), label: SEGMENT_LABEL[seg] }))
    .filter((c): c is { seg: string; href: string; label: string } => !!c.label)
    .map((c) => ({ ...c, linkable: c.seg !== "edit" && c.seg !== "new" }));
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-[0.85rem]">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.href} className={cx("flex min-w-0 items-center gap-1.5", !last && i < crumbs.length - 2 && "max-sm:hidden")}>
              {last || !c.linkable ? (
                <span aria-current={last ? "page" : undefined} className={cx("truncate", last ? "font-medium text-ink" : "text-muted")}>
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="truncate text-muted hover:text-ink">
                  {c.label}
                </Link>
              )}
              {!last && <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Topbar({ onMenu, pathname, email, name, signedIn }: { onMenu: () => void; pathname: string; email: string; name: string; signedIn: boolean }) {
  const [mobileSearch, setMobileSearch] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="-ml-2 grid size-11 place-items-center rounded-[3px] hover:bg-paper-2 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu aria-hidden className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <Breadcrumbs pathname={pathname} />
        </div>
        <div className="hidden w-72 md:block">
          <GlobalSearch />
        </div>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-[3px] hover:bg-paper-2 md:hidden"
          aria-label="Search"
          aria-expanded={mobileSearch}
          onClick={() => setMobileSearch((s) => !s)}
        >
          <Search aria-hidden className="size-4.5" />
        </button>
        <Notifications signedIn={signedIn} pathname={pathname} />
        <ProfileMenu email={email} name={name} />
      </div>
      {mobileSearch && (
        <div className="border-t border-line px-4 py-3 md:hidden">
          <GlobalSearch autoFocus onNavigate={() => setMobileSearch(false)} />
        </div>
      )}
    </header>
  );
}

const RESULT_GROUP: Record<SearchResult["type"], string> = { project: "Project", inquiry: "Inquiry", service: "Service", team: "Team" };

function GlobalSearch({ autoFocus, onNavigate }: { autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [found, setFound] = useState<{ q: string; items: SearchResult[]; error?: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const term = useDebounced(q.trim(), 250);

  // Ctrl/⌘ + K focuses search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Inside the text editor, Ctrl/⌘ + K means "add link".
      if (e.defaultPrevented || (e.target instanceof HTMLElement && e.target.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    api<{ items: SearchResult[] }>(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal }).then(
      ({ items }) => setFound({ q: term, items }),
      (error: unknown) => {
        if (!ctrl.signal.aborted) setFound({ q: term, items: [], error: errorMessage(error, "Search failed.") });
      },
    );
    return () => ctrl.abort();
  }, [term]);

  const current = found && found.q === term && term === q.trim() ? found : null;
  const results = current?.items ?? [];

  const go = (r: SearchResult) => {
    router.push(r.href);
    setOpen(false);
    setQ("");
    onNavigate?.();
  };

  return (
    <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="admin-search-results"
        aria-activedescendant={open && results[active] ? `sr-${results[active].type}-${results[active].id}` : undefined}
        aria-label="Search projects, inquiries, team and services"
        placeholder="Search…"
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            go(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="h-10 w-full rounded-[3px] border border-line-strong bg-card pr-12 pl-9 text-[0.88rem] placeholder:text-muted focus:border-ink focus:outline-none"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-line px-1.5 font-mono text-[0.65rem] text-muted md:block">
        Ctrl K
      </kbd>
      {open && q.trim().length >= 2 && (
        <ul
          id="admin-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute top-[calc(100%+0.4rem)] right-0 left-0 z-50 max-h-80 overflow-y-auto rounded-md border border-line bg-card py-1.5 shadow-card"
        >
          {!current ? (
            <li className="px-3.5 py-3 text-[0.85rem] text-muted">Searching…</li>
          ) : current.error ? (
            <li className="px-3.5 py-3 text-[0.85rem] text-danger">{current.error}</li>
          ) : results.length === 0 ? (
            <li className="px-3.5 py-3 text-[0.85rem] text-muted">No matches for &ldquo;{q}&rdquo;</li>
          ) : (
            results.map((r, i) => (
              <li
                key={`${r.type}-${r.id}`}
                id={`sr-${r.type}-${r.id}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(r);
                }}
                onMouseEnter={() => setActive(i)}
                className={cx("flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2", i === active && "bg-paper-2")}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[0.88rem]">{r.label}</span>
                  {r.meta && <span className="block truncate text-[0.78rem] text-muted">{r.meta}</span>}
                </span>
                <span className="t-meta shrink-0 text-muted">{RESULT_GROUP[r.type] ?? r.type}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function Notifications({ signedIn, pathname }: { signedIn: boolean; pathname: string }) {
  const router = useRouter();
  const toast = useToast();
  const { data, setData, refresh } = useAdminPoll<NotificationList>(signedIn ? "/api/admin/notifications" : null, { refreshKey: pathname });
  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;
  const now = useNow();

  async function markRead(ids: string[] | "all") {
    setData((d) =>
      d
        ? {
            unread: ids === "all" ? 0 : Math.max(0, d.unread - d.items.filter((n) => ids.includes(n.id) && !n.read).length),
            items: d.items.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n)),
          }
        : d,
    );
    try {
      await api("/api/admin/notifications/read", { method: "POST", body: ids === "all" ? { all: true } : { ids } });
    } catch (error) {
      toast({ tone: "error", title: "Could not update notifications", body: errorMessage(error) });
      refresh();
    }
  }

  async function dismiss(id: string) {
    setData((d) => {
      if (!d) return d;
      const gone = d.items.find((n) => n.id === id);
      return { unread: gone && !gone.read ? Math.max(0, d.unread - 1) : d.unread, items: d.items.filter((n) => n.id !== id) };
    });
    try {
      await api(`/api/admin/notifications/${id}`, { method: "DELETE" });
    } catch (error) {
      toast({ tone: "error", title: "Could not remove notification", body: errorMessage(error) });
      refresh();
    }
  }

  return (
    <Popover
      label="Notifications"
      className="w-[min(22rem,calc(100vw-2rem))] max-sm:fixed max-sm:top-16 max-sm:right-4"
      trigger={(p) => (
        <button
          {...p}
          type="button"
          className="relative grid size-10 place-items-center rounded-[3px] hover:bg-paper-2"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell aria-hidden className="size-4.5" />
          {unread > 0 && <span className="absolute top-2 right-2 size-2 rounded-full bg-accent ring-2 ring-paper" />}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-[0.9rem] font-semibold">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={() => void markRead("all")} className="text-[0.8rem] text-muted hover:text-ink">
                Mark all read
              </button>
            )}
          </div>
          {!data ? (
            <p className="px-4 py-8 text-center text-[0.85rem] text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[0.85rem] text-muted">You&rsquo;re all caught up.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="group flex items-start gap-3 border-b border-line px-4 py-3 last:border-0">
                  <span aria-hidden className={cx("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-accent")} />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      if (!n.read) void markRead([n.id]);
                      close();
                      router.push(n.href);
                    }}
                  >
                    <span className="block text-[0.85rem] font-medium">
                      {n.title}
                      {!n.read && <span className="sr-only"> (unread)</span>}
                    </span>
                    <span className="block truncate text-[0.82rem] text-muted">{n.body}</span>
                    <span className="t-meta mt-1 block text-muted">{now ? timeAgo(n.at, now) : ""}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void dismiss(n.id)}
                    className="grid size-7 place-items-center rounded-[3px] text-muted opacity-60 hover:bg-paper-2 hover:text-ink hover:opacity-100"
                    aria-label={`Remove: ${n.body}`}
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}

function initials(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("");
  return (letters.slice(0, 2) || "A").toUpperCase();
}

function ProfileMenu({ email, name }: { email: string; name: string }) {
  const [theme, setTheme] = useThemePref();
  const [leaving, setLeaving] = useState(false);
  const themes: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <Popover
      label="Account"
      className="w-64"
      trigger={(p) => (
        <button
          {...p}
          type="button"
          className="ml-1 grid size-9 place-items-center rounded-full bg-ink text-[0.78rem] font-semibold text-paper"
          aria-label="Account menu"
        >
          {initials(name)}
        </button>
      )}
    >
      {(close) => (
        <div className="py-1.5">
          <div className="border-b border-line px-4 pt-2 pb-3">
            <p className="text-[0.88rem] font-medium">{name}</p>
            <p className="truncate text-[0.8rem] text-muted">{email}</p>
          </div>
          <div className="border-b border-line px-4 py-3">
            <p className="t-meta mb-2 text-muted">Theme (this browser)</p>
            <div className="grid grid-cols-3 gap-1 rounded-[3px] bg-paper-2 p-1" role="radiogroup" aria-label="Theme">
              {themes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.value}
                  onClick={() => setTheme(t.value)}
                  className={cx(
                    "flex h-8 items-center justify-center gap-1 rounded-[2px] text-[0.75rem]",
                    theme === t.value ? "bg-card shadow-sm" : "text-muted hover:text-ink",
                  )}
                >
                  <t.icon aria-hidden className="size-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <Link
            href="/admin/settings#password"
            onClick={close}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[0.88rem] hover:bg-paper-2"
          >
            <KeyRound aria-hidden className="size-4 text-muted" /> Change password
          </Link>
          <button
            type="button"
            disabled={leaving}
            onClick={() => {
              setLeaving(true);
              void signOut();
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[0.88rem] hover:bg-paper-2 disabled:opacity-60"
          >
            <LogOut aria-hidden className="size-4 text-muted" /> {leaving ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </Popover>
  );
}
