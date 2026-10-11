import { BadgeCheck, CalendarClock, CircleDollarSign, Lock, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobActions } from "@/components/job/job-actions";
import { LedgerView } from "@/components/job/ledger-view";
import { ReviewForm } from "@/components/job/review-form";
import { Stars } from "@/components/shared/stars";
import { JobStatusBadge } from "@/components/shared/status";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/scoped";
import { one } from "@/lib/db/sql";
import { JOB_STATUS_LABEL, JOB_STEPS } from "@/lib/domain/lifecycle";
import { formatUsd, payoutCents } from "@/lib/domain/money";
import { currentPersona } from "@/lib/server/session";
import { contactFor, jobEvents, jobLedger, jobReview, jobView } from "@/lib/services/views";
import { cn, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  booked: "Booked",
  payment_held: "Payment held",
  scheduled: "Visit scheduled",
  in_progress: "Job started",
  done: "Marked done",
  payout_released: "Payout released",
  reviewed: "Reviewed",
};

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const persona = await currentPersona();
  const db = await getDb();
  const data = await asUser(db, persona.id, async (tx) => {
    const job = await jobView(tx, id);
    if (!job) return null;
    const quote = await one<{ message: string; available_at: string }>(tx, "select quote_message(id) as message, available_at from quotes where id = $1", [job.quote_id]);
    return {
      job,
      quote,
      events: await jobEvents(tx, id),
      ledger: await jobLedger(tx, id),
      review: await jobReview(tx, id),
      clientContact: await contactFor(tx, job.client_id),
      proContact: await contactFor(tx, job.pro_id),
    };
  });
  if (!data) notFound();
  const { job, quote, events, ledger, review, clientContact, proContact } = data;
  const isPro = persona.id === job.pro_id;
  const isClient = persona.id === job.client_id;
  const reached = new Map(events.map((e) => [e.kind, e.created_at]));
  const stepIndex = JOB_STEPS.indexOf(job.status);
  const paidOut = job.status === "done";

  return (
    <div className="space-y-6">
      <div>
        <Link href={isPro ? "/pro" : persona.role === "admin" ? "/admin" : "/"} className="text-sm text-slate-500 hover:text-slate-800">
          {isPro ? "Leads and jobs" : persona.role === "admin" ? "Dashboard" : "My jobs"}
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
          <JobStatusBadge status={job.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Job #{job.id} · {job.category_name} · {job.client_display} and{" "}
          <Link href={`/pros/${job.pro_id}`} className="hover:underline">{job.pro_display}</Link> · {job.zip} {job.place}
        </p>
      </div>

      <Card>
        <CardBody className="py-5">
          <ol className="grid grid-cols-4 gap-2" data-testid="job-stepper">
            {JOB_STEPS.map((s, i) => {
              const done = i <= stepIndex;
              const at = reached.get(s);
              return (
                <li key={s} className="relative">
                  <div className={cn("h-1.5 rounded-full", done ? "bg-brand-600" : "bg-slate-200")} />
                  <p className={cn("mt-2 text-sm font-medium", done ? "text-slate-900" : "text-slate-400")}>{JOB_STATUS_LABEL[s]}</p>
                  <p className="text-xs text-slate-500">{at ? formatDateTime(at) : s === "scheduled" && job.scheduled_for ? formatDateTime(job.scheduled_for) : " "}</p>
                </li>
              );
            })}
          </ol>
          {isPro && job.status !== "done" && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <JobActions jobId={job.id} status={job.status} suggestedAt={quote?.available_at ?? new Date().toISOString()} />
            </div>
          )}
          {!isPro && job.status !== "done" && (
            <p className="mt-4 text-sm text-slate-500">
              {job.status === "booked" ? "The pro will set the visit time." : job.status === "scheduled" ? `Visit set for ${formatDateTime(job.scheduled_for!)}.` : "The pro is on the job."}
            </p>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7 space-y-6">
          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle><span className="text-xs text-slate-500">Both sides see the same timeline</span></CardHeader>
            <CardBody>
              <ol className="relative space-y-4 border-l border-slate-200 pl-5" data-testid="timeline">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[25px] top-1 size-2.5 rounded-full border-2 border-white bg-brand-600 ring-1 ring-brand-200" />
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">{EVENT_LABEL[e.kind] ?? e.kind}</p>
                      <span className="text-xs text-slate-400">{formatDateTime(e.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {[e.kind === "scheduled" && job.scheduled_for ? `Visit set for ${formatDateTime(job.scheduled_for)}` : e.note].filter(Boolean).join("")}
                      <span className="text-slate-400">{e.note || e.kind === "scheduled" ? " · " : ""}{e.actor}</span>
                    </p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Review</CardTitle></CardHeader>
            <CardBody>
              {review ? (
                <div data-testid="job-review">
                  <Stars value={review.rating} size="md" />
                  <p className="mt-2 text-sm text-slate-700">{review.body || "No comment."}</p>
                  <p className="mt-1 text-xs text-slate-400">{review.author_label} · {formatDateTime(review.created_at)}</p>
                </div>
              ) : isClient && job.status === "done" ? (
                <ReviewForm jobId={job.id} />
              ) : (
                <p className="text-sm text-slate-500">{job.status === "done" ? "The client hasn't reviewed this job yet." : "The client can review once the job is done."}</p>
              )}
            </CardBody>
          </Card>
        </div>

        <aside className="col-span-5 space-y-6">
          <Card data-testid="payment-card">
            <CardHeader>
              <CardTitle>Payment</CardTitle>
              <span className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800">Test mode</span>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Money label="Held" value={job.price_cents} active={!paidOut} testId="pay-held" />
                <Money label="Paid to pro" value={paidOut ? payoutCents(job.price_cents) : 0} active={paidOut} testId="pay-payout" />
                <Money label="Platform fee" value={paidOut ? job.fee_cents : 0} active={paidOut} testId="pay-fee" />
              </div>
              <p className="flex items-center gap-2 text-slate-600">
                <CircleDollarSign className="size-4 text-slate-400" />
                {paidOut
                  ? `${formatUsd(job.price_cents)} released: ${formatUsd(payoutCents(job.price_cents))} to the pro, ${formatUsd(job.fee_cents)} platform fee.`
                  : `${formatUsd(job.price_cents)} is held until the pro marks the job done.`}
              </p>
              <LedgerView transactions={ledger} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Contacts</CardTitle><span className="text-xs text-slate-500">Open to both sides after hire</span></CardHeader>
            <CardBody className="space-y-3 text-sm" data-testid="job-contacts">
              <ContactRow title="Client" name={job.client_display} contact={clientContact} />
              <ContactRow title="Pro" name={job.pro_display} contact={proContact} verified />
            </CardBody>
          </Card>

          {quote && (
            <Card>
              <CardHeader><CardTitle>Accepted quote</CardTitle></CardHeader>
              <CardBody className="space-y-2 text-sm">
                <p className="text-lg font-semibold">{formatUsd(job.price_cents)}</p>
                <p className="flex items-center gap-1.5 text-slate-500"><CalendarClock className="size-4" /> Offered start {formatDateTime(quote.available_at)}</p>
                <p className="rounded-lg bg-slate-50 p-3 text-slate-700">{quote.message}</p>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Money({ label, value, active, testId }: { label: string; value: number; active: boolean; testId: string }) {
  return (
    <div className={cn("rounded-lg border px-2 py-3", active ? "border-brand-200 bg-brand-50/60" : "border-slate-200 bg-slate-50/60")}>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold", active ? "text-slate-900" : "text-slate-400")} data-testid={testId}>{formatUsd(value)}</p>
    </div>
  );
}

function ContactRow({ title, name, contact, verified }: { title: string; name: string; contact: { full_name: string; phone: string; email: string } | null; verified?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{title}</p>
        <p className="flex items-center gap-1 font-medium text-slate-900">{name} {verified && <BadgeCheck className="size-3.5 text-brand-600" />}</p>
      </div>
      {contact ? (
        <div className="text-right text-slate-600">
          <p className="flex items-center justify-end gap-1"><Phone className="size-3" /> {contact.phone}</p>
          <p className="flex items-center justify-end gap-1"><Mail className="size-3" /> {contact.email}</p>
        </div>
      ) : (
        <span className="inline-flex items-center gap-1 text-slate-500"><Lock className="size-3" /> Hidden</span>
      )}
    </div>
  );
}
