import { ArrowRight, BadgeCheck, Inbox, MapPin, Megaphone } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HireButton } from "@/components/client/hire-button";
import { ReasonChips } from "@/components/shared/reason-chips";
import { Rating } from "@/components/shared/stars";
import { LeadStatusBadge, RequestStatusBadge } from "@/components/shared/status";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/scoped";
import { one } from "@/lib/db/sql";
import { formatReply } from "@/lib/domain/matching";
import { formatUsd } from "@/lib/domain/money";
import { TIMING_LABEL } from "@/lib/domain/types";
import { currentPersona } from "@/lib/server/session";
import { jobForRequest, requestLeads, requestQuotes, requestView } from "@/lib/services/views";
import { cn, formatDateTime, formatMinutes, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const persona = await currentPersona();
  const db = await getDb();
  const data = await asUser(db, persona.id, async (tx) => {
    const request = await requestView(tx, id);
    if (!request) return null;
    if (persona.role === "pro") {
      const lead = await one<{ id: number }>(tx, "select id from leads where request_id = $1 and pro_id = $2", [id, persona.id]);
      return { redirectTo: lead ? `/pro/leads/${lead.id}` : null } as const;
    }
    return { request, leads: await requestLeads(tx, id), quotes: await requestQuotes(tx, id), job: await jobForRequest(tx, id) };
  });
  if (!data) notFound();
  if ("redirectTo" in data) {
    if (data.redirectTo) redirect(data.redirectTo);
    notFound();
  }
  const { request, leads, quotes, job } = data;
  const quoted = new Map(quotes.map((q) => [q.lead_id, q]));
  const lowest = quotes.length ? Math.min(...quotes.map((q) => q.price_cents)) : 0;
  const topRated = quotes.length ? Math.max(...quotes.map((q) => (q.review_count ? q.rating_sum / q.review_count : 0))) : 0;
  const canHire = persona.id === request.client_id && request.status === "open";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">My jobs</Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{request.title}</h1>
          <RequestStatusBadge status={request.status} jobStatus={job?.status} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600" data-testid="request-summary">
          <Badge tone="outline">{request.category.name}</Badge>
          <Badge tone="outline"><MapPin /> {request.zip} {request.place}</Badge>
          <Badge tone="outline">{TIMING_LABEL[request.timing]}</Badge>
          <Badge tone="outline">{request.budget_cents ? `Budget ${formatUsd(request.budget_cents)}` : "No budget given"}</Badge>
          <span className="self-center text-xs text-slate-400">Posted {timeAgo(request.created_at)}</span>
        </div>
      </div>

      {job && (
        <Link href={`/jobs/${job.id}`} className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 hover:bg-brand-100" data-testid="job-banner">
          <span className="text-sm text-brand-900">You hired a pro for this job. Follow it from booked to done.</span>
          <span className="flex items-center gap-1 text-sm font-medium text-brand-800">Open job <ArrowRight className="size-4" /></span>
        </Link>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Matched pros</CardTitle>
                <p className="mt-0.5 text-sm text-slate-500">
                  {leads.length ? `Sent to the ${leads.length} best-fit pros near ${request.zip}. Each match says why.` : "No pro in range serves this category yet."}
                </p>
              </div>
            </CardHeader>
            <CardBody className="grid grid-cols-2 gap-4" data-testid="matched-pros">
              {leads.map((l) => {
                const q = quoted.get(l.id);
                return (
                  <div key={l.id} className={cn("relative rounded-xl border p-4", l.sponsored ? "border-amber-200 bg-amber-50/30" : "border-slate-200")} data-testid="match-card">
                    {l.sponsored && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800" data-testid="sponsored-tag">
                        <Megaphone className="size-3" /> Sponsored
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 pr-24">
                      <Link href={`/pros/${l.pro_id}`} className="font-semibold text-slate-900 hover:underline">{l.business_name}</Link>
                      {l.verified && <BadgeCheck className="size-4 text-brand-600" aria-label="Verified" />}
                    </div>
                    <div className="mt-1"><Rating sum={l.rating_sum} count={l.review_count} /></div>
                    <div className="mt-3"><ReasonChips reasons={l.reasons} hideSponsored /></div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                      <span className="text-slate-500">Match #{l.rank}</span>
                      {q ? <span className="font-medium text-slate-900">Quoted {formatUsd(q.price_cents)}</span> : <LeadStatusBadge status={l.status} />}
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Compare quotes</CardTitle>
                <p className="mt-0.5 text-sm text-slate-500">Contact details in messages stay hidden until you hire.</p>
              </div>
              <span className="text-sm text-slate-500">{quotes.length} of {leads.length}</span>
            </CardHeader>
            {quotes.length === 0 ? (
              <CardBody className="py-12 text-center">
                <Inbox className="mx-auto size-8 text-slate-300" />
                <p className="mt-2 text-sm font-medium text-slate-700">No quotes yet</p>
                <p className="text-sm text-slate-500">Pros on this request usually reply within a few hours. You get a notification for each quote.</p>
              </CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm" data-testid="compare-quotes">
                  <thead>
                    <tr className="text-left">
                      <th className="w-36 px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-400" />
                      {quotes.map((q) => (
                        <th key={q.id} className="px-4 py-3 align-top">
                          <Link href={`/pros/${q.pro_id}`} className="font-semibold text-slate-900 hover:underline">{q.business_name}</Link>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {q.price_cents === lowest && <Badge tone="brand">Lowest price</Badge>}
                            {q.review_count && q.rating_sum / q.review_count === topRated ? <Badge tone="amber">Top rated</Badge> : null}
                            {q.sponsored && <Badge tone="amber">Sponsored</Badge>}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                    <Row label="Price">
                      {quotes.map((q) => (
                        <td key={q.id} className="px-4 py-3"><span className="text-lg font-semibold">{formatUsd(q.price_cents)}</span> <span className="text-xs text-slate-500">{q.price_type}</span></td>
                      ))}
                    </Row>
                    <Row label="Review score">
                      {quotes.map((q) => <td key={q.id} className="px-4 py-3"><Rating sum={q.rating_sum} count={q.review_count} /></td>)}
                    </Row>
                    <Row label="Reply time">
                      {quotes.map((q) => (
                        <td key={q.id} className="px-4 py-3">
                          <span className="text-slate-900">Replied in {formatMinutes(q.reply_after_min)}</span>
                          <div className="text-xs text-slate-500">{formatReply(q.reply_minutes).replace("Replies", "Usually replies")}</div>
                        </td>
                      ))}
                    </Row>
                    <Row label="Available">
                      {quotes.map((q) => <td key={q.id} className="px-4 py-3">{formatDateTime(q.available_at)}</td>)}
                    </Row>
                    <Row label="Message">
                      {quotes.map((q) => <td key={q.id} className="px-4 py-3 text-slate-600" data-testid="quote-message">{q.message}</td>)}
                    </Row>
                    {canHire && (
                      <tr>
                        <td className="px-5 py-3" />
                        {quotes.map((q) => (
                          <td key={q.id} className="px-4 py-3">
                            <HireButton quoteId={q.id} proName={q.business_name} priceCents={q.price_cents} priceType={q.price_type} />
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <aside className="col-span-4 space-y-6">
          <Card>
            <CardHeader><CardTitle>Request details</CardTitle></CardHeader>
            <CardBody className="space-y-4 text-sm">
              {request.details && <p className="text-slate-700">{request.details}</p>}
              <dl className="space-y-2">
                {request.category.questions.map((q) => {
                  const a = request.answers.find((x) => x.question_id === q.id);
                  return (
                    <div key={q.id} className="flex justify-between gap-3">
                      <dt className="text-slate-500">{q.text}</dt>
                      <dd className={cn("text-right", a ? "font-medium text-slate-900" : "text-slate-400")}>{a?.answer ?? "Not answered"}</dd>
                    </div>
                  );
                })}
              </dl>
              {request.note && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Your note</p>
                  <p className="mt-1 text-slate-700">&ldquo;{request.note}&rdquo;</p>
                </div>
              )}
            </CardBody>
          </Card>
          {request.intake && (
            <Card>
              <CardHeader><CardTitle>How this was read</CardTitle></CardHeader>
              <CardBody className="space-y-2 text-sm" data-testid="intake-log">
                <div className="flex justify-between"><span className="text-slate-500">Path</span><span className="font-medium">{{ live: "Live agent", replay: "Replay of a live run", rules: "Rules parser" }[request.intake.path]}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Model</span><span>{request.intake.model}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Time</span><span>{(request.intake.duration_ms / 1000).toFixed(1)} s</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Tool calls</span><span>{request.intake.tool_calls.map((t) => t.name).join(", ") || "none"}</span></div>
                {request.intake.cost_usd && <div className="flex justify-between"><span className="text-slate-500">Cost (estimate)</span><span>${Number(request.intake.cost_usd).toFixed(4)}</span></div>}
                {request.intake.fallback_reason && <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">{request.intake.fallback_reason}</p>}
              </CardBody>
            </Card>
          )}
          {persona.role === "admin" && (
            <Link href="/admin" className={buttonVariants({ variant: "secondary", className: "w-full" })}>Back to dashboard</Link>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <td className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</td>
      {children}
    </tr>
  );
}
