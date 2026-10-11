import { Inbox, Lock, Megaphone } from "lucide-react";
import Link from "next/link";
import { LeadStatusBadge } from "@/components/shared/status";
import { formatUsd } from "@/lib/domain/money";
import { TIMING_LABEL } from "@/lib/domain/types";
import type { InboxLead } from "@/lib/services/views";
import { cn, timeAgo } from "@/lib/utils";

export function InboxList({ leads, compact, target }: { leads: InboxLead[]; compact?: boolean; target?: "_top" }) {
  if (!leads.length) {
    return (
      <div className="px-5 py-14 text-center">
        <Inbox className="mx-auto size-8 text-slate-300" />
        <p className="mt-2 text-sm font-medium text-slate-700">No leads yet</p>
        <p className="text-sm text-slate-500">New requests that fit your categories and area show up here.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100" data-testid="inbox">
      {leads.map((l) => (
        <li key={l.id}>
          <Link href={l.job_id ? `/jobs/${l.job_id}` : `/pro/leads/${l.id}`} target={target} className={cn("block hover:bg-slate-50", compact ? "px-4 py-3" : "px-5 py-4")} data-testid="inbox-lead">
            <div className={cn("flex gap-3", compact ? "flex-col gap-1.5" : "items-start justify-between")}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {(l.status === "new") && <span className="size-2 shrink-0 rounded-full bg-sky-500" />}
                  <span className="truncate font-medium text-slate-900">{l.title}</span>
                  {l.sponsored && <Megaphone className="size-3.5 shrink-0 text-amber-600" aria-label="Sponsored placement" />}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {l.client_display} · {l.zip} {compact ? "" : l.place}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{l.category_name}</span>
                  <span>{TIMING_LABEL[l.timing]}</span>
                  <span>{l.budget_cents ? `Budget ${formatUsd(l.budget_cents)}` : "No budget"}</span>
                  {!l.job_id && (
                    <span className="inline-flex items-center gap-1"><Lock className="size-3" /> Contact hidden until hire</span>
                  )}
                </div>
              </div>
              <div className={cn("flex shrink-0 items-center gap-3", compact ? "justify-between" : "flex-col items-end gap-1.5")}>
                <LeadStatusBadge status={l.status} />
                <span className="text-xs text-slate-500">
                  {l.quote_price_cents ? `Quoted ${formatUsd(l.quote_price_cents)}` : `Lead fee ${l.fee_credits} credits`} · {timeAgo(l.created_at)}
                </span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
