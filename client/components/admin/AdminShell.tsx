"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Briefcase,
  Building2,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareQuote,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Search,
  Settings,
  Sun,
  Users,
  X,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Popover } from "@/components/ui/Popover";
import { useToast } from "@/components/ui/Toast";
import { dismissNotification, markNotifications, resetDemoData, updateSettings, useDB } from "@/lib/store";
import { signOut, useSession } from "@/lib/session";
import { cx, timeAgo } from "@/lib/format";
import { useNow } from "@/hooks/useNow";
import { useStoredPref } from "@/hooks/useStoredPref";
import type { ThemePreference } from "@/lib/types";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/projects", label: "Projects", icon: Building2 },
  { href: "/admin/services", label: "Services", icon: Briefcase },
  { href: "/admin/inquiries", label: "Inquiries", icon: Inbox, badge: "inquiries" as const },
  { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquareQuote },
  { href: "/admin/team", label: "Team", icon: Users },
  { href: "/admin/media", label: "Media", icon: ImageIcon },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const SEGMENT_LABEL: Record<string, string> = {
  admin: "Admin",
  projects: "Projects",
  services: "Services",
  inquiries: "Inquiries",
  testimonials: "Testimonials",
  team: "Team",
  media: "Media",
  settings: "Settings",
  new: "New project",
  edit: "Edit",
};

export function AdminShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarPref, setSidebarPref] = useStoredPref("lintel:sidebar", "open");
  const collapsed = sidebarPref === "collapsed";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (session === null) router.replace("/admin/login");
  }, [session, router]);

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
  // it stays hidden and inert until the simulated session is known.
  const gated = !session;

  return (
    <>
      {gated && (
        <div className="grid min-h-dvh place-items-center" aria-busy="true">
          <div className="flex flex-col items-center gap-4 text-muted">
            <LogoMark className="size-10 animate-pulse text-ink" />
            <p className="t-meta">{session === null ? "Redirecting to sign in…" : "Loading studio…"}</p>
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
          <SidebarContent collapsed={collapsed} pathname={pathname} />
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
            <SidebarContent collapsed={false} pathname={pathname} />
          </div>
        </dialog>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setDrawerOpen(true)} pathname={pathname} email={session?.email ?? ""} name={session?.name ?? ""} />
          <main id="admin-main" className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

function SidebarContent({ collapsed, pathname }: { collapsed: boolean; pathname: string }) {
  const newInquiries = useDB((d) => d.inquiries).filter((i) => i.status === "new").length;
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
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const badge = item.badge === "inquiries" && newInquiries > 0 ? newInquiries : null;
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
                        "grid min-w-5 place-items-center rounded-full px-1.5 text-[0.7rem] font-semibold tabular-nums",
                        active ? "bg-accent text-accent-ink" : "bg-accent text-accent-ink",
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
        {!collapsed && (
          <p className="mt-2 rounded-[3px] bg-warn-soft px-3 py-2 text-[0.72rem] leading-snug text-warn">Prototype · data is stored in this browser only</p>
        )}
      </div>
    </>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const projects = useDB((d) => d.projects);
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = parts.map((seg, i) => {
    const href = "/" + parts.slice(0, i + 1).join("/");
    const label = SEGMENT_LABEL[seg] ?? projects.find((p) => p.id === seg)?.title ?? "Item";
    return { href, label, linkable: seg !== "edit" && !(parts[i - 1] === "projects" && parts[i + 1] === "edit") };
  });
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

function Topbar({ onMenu, pathname, email, name }: { onMenu: () => void; pathname: string; email: string; name: string }) {
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
        <Notifications />
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

type Result = { id: string; label: string; meta: string; href: string; group: string };

function GlobalSearch({ autoFocus, onNavigate }: { autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const projects = useDB((d) => d.projects);
  const inquiries = useDB((d) => d.inquiries);
  const team = useDB((d) => d.team);
  const services = useDB((d) => d.services);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  // Ctrl/⌘ + K focuses search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo<Result[]>(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const has = (...v: string[]) => v.some((x) => x.toLowerCase().includes(s));
    return [
      ...projects
        .filter((p) => has(p.title, p.location))
        .map((p) => ({ id: p.id, label: p.title, meta: p.location, href: `/admin/projects/${p.id}/edit`, group: "Project" })),
      ...inquiries
        .filter((i) => has(i.name, i.email, i.subject))
        .map((i) => ({ id: i.id, label: i.name, meta: i.subject, href: `/admin/inquiries?id=${i.id}`, group: "Inquiry" })),
      ...team.filter((m) => has(m.name, m.role)).map((m) => ({ id: m.id, label: m.name, meta: m.role, href: "/admin/team", group: "Team" })),
      ...services.filter((x) => has(x.title)).map((x) => ({ id: x.id, label: x.title, meta: "Service", href: "/admin/services", group: "Service" })),
    ].slice(0, 8);
  }, [q, projects, inquiries, team, services]);

  const go = (r: Result) => {
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
        aria-activedescendant={open && results[active] ? `sr-${results[active].id}` : undefined}
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
          {results.length === 0 ? (
            <li className="px-3.5 py-3 text-[0.85rem] text-muted">No matches for &ldquo;{q}&rdquo;</li>
          ) : (
            results.map((r, i) => (
              <li
                key={`${r.group}-${r.id}`}
                id={`sr-${r.id}`}
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
                  <span className="block truncate text-[0.78rem] text-muted">{r.meta}</span>
                </span>
                <span className="t-meta shrink-0 text-muted">{r.group}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function Notifications() {
  const router = useRouter();
  const items = useDB((d) => d.notifications);
  const unread = items.filter((n) => !n.read).length;
  const now = useNow();
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
              <button type="button" onClick={() => markNotifications("all")} className="text-[0.8rem] text-muted hover:text-ink">
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
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
                      markNotifications([n.id]);
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
                    onClick={() => dismissNotification(n.id)}
                    className="grid size-7 place-items-center rounded-[3px] text-muted opacity-60 hover:bg-paper-2 hover:text-ink hover:opacity-100"
                    aria-label={`Dismiss: ${n.body}`}
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

function ProfileMenu({ email, name }: { email: string; name: string }) {
  const theme = useDB((d) => d.settings.theme);
  const router = useRouter();
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const themes: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <>
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
            DA
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
              <p className="t-meta mb-2 text-muted">Theme</p>
              <div className="grid grid-cols-3 gap-1 rounded-[3px] bg-paper-2 p-1" role="radiogroup" aria-label="Theme">
                {themes.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={theme === t.value}
                    onClick={() => updateSettings({ theme: t.value }, `Theme set to ${t.label.toLowerCase()}`)}
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
            <button
              type="button"
              onClick={() => {
                close();
                setConfirmReset(true);
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[0.88rem] hover:bg-paper-2"
            >
              <RotateCcw aria-hidden className="size-4 text-muted" /> Reset demo data
            </button>
            <button
              type="button"
              onClick={() => {
                signOut();
                router.replace("/admin/login");
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[0.88rem] hover:bg-paper-2"
            >
              <LogOut aria-hidden className="size-4 text-muted" /> Sign out
            </button>
          </div>
        )}
      </Popover>
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all demo data?"
        description="Projects, services, inquiries, team, media and settings will return to their original sample content. Your edits in this browser will be lost."
        confirmLabel="Reset data"
        onConfirm={() => {
          resetDemoData();
          setConfirmReset(false);
          toast({ tone: "success", title: "Demo data reset", body: "Sample content restored." });
        }}
      />
    </>
  );
}
