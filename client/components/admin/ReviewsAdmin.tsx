"use client";

import { useState } from "react";
import { Check, EyeOff, Star, Trash2 } from "lucide-react";
import { LoadError } from "@/components/admin/parts";
import { EmptyState, FilterTabs, PageHeader, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useApiData } from "@/hooks/useApiData";
import { announceAdminChange, api, ApiError, errorMessage, type AdminReview, type ReviewList, type ReviewStatus } from "@/lib/api";
import { cx, formatDate } from "@/lib/format";

const LANGUAGE = { ka: "Georgian", en: "English", ru: "Russian" } as const;
const EMPTY: Record<ReviewStatus, { title: string; body: string }> = {
  pending: { title: "Nothing waiting", body: "New reviews from visitors will show up here for you to approve." },
  approved: { title: "No approved reviews", body: "Approved reviews appear on the home page." },
  rejected: { title: "No hidden reviews", body: "Reviews you hide are kept here." },
};

function RatingStars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={cx("size-4", n <= rating ? "fill-accent text-accent" : "text-line-strong")} />
      ))}
    </span>
  );
}

export function ReviewsAdmin() {
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const list = useApiData<ReviewList>(`/api/admin/reviews?status=${status}`);
  const toast = useToast();
  const [toDelete, setToDelete] = useState<AdminReview | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const data = list.data;
  const rows = data?.items ?? [];
  const counts = data?.counts;

  async function change(r: AdminReview, next: ReviewStatus) {
    setBusy(r.id);
    try {
      await api<AdminReview>(`/api/admin/reviews/${r.id}`, { method: "PATCH", body: { status: next } });
      list.reload();
      announceAdminChange();
      toast({ tone: "success", title: next === "approved" ? "Review approved" : "Review hidden", body: r.fullName });
    } catch (err) {
      toast({ tone: "error", title: "Could not change", body: errorMessage(err) });
      // Someone else may have changed or deleted it: show the list as it is now.
      list.reload();
    } finally {
      setBusy(null);
    }
  }

  async function remove(r: AdminReview) {
    setDeleting(true);
    try {
      await api(`/api/admin/reviews/${r.id}`, { method: "DELETE" });
      list.reload();
      announceAdminChange();
      toast({ tone: "success", title: "Review deleted" });
      setToDelete(null);
    } catch (err) {
      toast({ tone: "error", title: "Could not delete", body: errorMessage(err) });
      if (err instanceof ApiError && err.status === 404) setToDelete(null);
      list.reload();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader title="Reviews" description="Approved reviews appear on the home page within a few minutes." />
      <Panel>
        <div className="border-b border-line p-3">
          <FilterTabs
            label="Filter reviews"
            value={status}
            onChange={setStatus}
            options={[
              { value: "pending", label: "Waiting", count: counts?.pending },
              { value: "approved", label: "Approved", count: counts?.approved },
              { value: "rejected", label: "Hidden", count: counts?.rejected },
            ]}
          />
        </div>
        {list.error && !data ? (
          <LoadError message={list.error.message} onRetry={list.reload} />
        ) : !data ? (
          <div className="h-64 animate-pulse bg-paper-2/50" aria-busy="true" />
        ) : rows.length === 0 ? (
          <EmptyState icon={Star} title={EMPTY[status].title} body={EMPTY[status].body} />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium break-words">{r.fullName}</span>
                    <RatingStars rating={r.rating} />
                  </div>
                  <p className="mt-2 text-[0.92rem] break-words whitespace-pre-line">{r.text}</p>
                  <p className="t-meta mt-2 text-muted">
                    {LANGUAGE[r.locale]}, sent {formatDate(r.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {r.status !== "approved" && (
                    <Button size="sm" disabled={busy === r.id} onClick={() => void change(r, "approved")}>
                      <Check aria-hidden className="size-4" /> Approve
                    </Button>
                  )}
                  {r.status !== "rejected" && (
                    <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => void change(r, "rejected")}>
                      <EyeOff aria-hidden className="size-4" /> Hide
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setToDelete(r)} aria-label={`Delete review by ${r.fullName}`}>
                    <Trash2 aria-hidden className="size-4" /> Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete this review?"
        description={`The review by ${toDelete?.fullName ?? ""} will be permanently removed.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </>
  );
}
