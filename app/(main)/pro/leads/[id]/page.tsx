import { ArrowRight, Lock, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { QuoteForm } from "@/components/pro/quote-form";
import { ReasonChips } from "@/components/shared/reason-chips";
import { LeadStatusBadge } from "@/components/shared/status";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/scoped";
import { formatUsd } from "@/lib/domain/money";
import { TIMING_LABEL } from "@/lib/domain/types";
import { currentPersona } from "@/lib/server/session";
import { markLeadViewed } from "@/lib/services/quotes";
import { contactFor, jobForRequest, leadView, proCredits, quoteForLead, requestView } from "@/lib/services/views";
import { formatDateTime, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const persona = await currentPersona();
  if (persona.role === "client") redirect("/");
  const db = await getDb();
  const data = await asUser(db, persona.id, async (tx) => {
    const lead = await leadView(tx, id);
    if (!lead) return null; // row-level security: another pro's lead does not exist for this person
    if (lead.pro_id === persona.id) await markLeadViewed(tx, id);
    const request = (await requestView(tx, lead.request_id))!;
    return {
      lead,
      request,
      quote: await quoteForLead(tx, id),
      credits: await proCredits(tx, lead.pro_id),
      contact: await contactFor(tx, request.client_id),
      job: await jobForRequest(tx, lead.request_id),
    };
  });
  if (!data) notFound();
  const { lead, request, quote, credits, contact, job } = data;
  const mine = job && quote && job.quote_id === quote.id;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/pro" className="text-sm text-slate-500 hover:text-slate-800">Leads</Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{request.title}</h1>
          <LeadStatusBadge status={lead.status === "new" ? "viewed" : lead.status} />
          {lead.sponsored && <Badge tone="amber">Sponsored placement</Badge>}
        </div>
        <p className="mt-1 text-sm text-slate-500">Lead #{lead.id} · received {timeAgo(lead.created_at)}</p>
      </div>

      {mine && (
        <Link href={`/jobs/${job.id}`} className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 hover:bg-brand-100">
          <span className="text-sm text-brand-900">You&apos;re hired. Schedule the visit and track the job.</span>
          <span className="flex items-center gap-1 text-sm font-medium text-brand-800">Open job <ArrowRight className="size-4" /></span>
        </Link>
      )}
      {lead.status === "not_selected" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">The client hired another pro for this job.</div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7 space-y-6">
          <Card>
            <CardHeader><CardTitle>The job</CardTitle></CardHeader>
            <CardBody className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge tone="outline">{request.category.name}</Badge>
                <Badge tone="outline"><MapPin /> {request.zip} {request.place}</Badge>
                <Badge tone="outline">{TIMING_LABEL[request.timing]}</Badge>
                <Badge tone="outline">{request.budget_cents ? `Budget ${formatUsd(request.budget_cents)}` : "No budget given"}</Badge>
              </div>
              {request.details && <p className="text-slate-700">{request.details}</p>}
              <dl className="grid grid-cols-2 gap-3">
                {request.category.questions.map((q) => {
                  const a = request.answers.find((x) => x.question_id === q.id);
                  return (
                    <div key={q.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <dt className="text-xs text-slate-500">{q.text}</dt>
                      <dd className={a ? "font-medium text-slate-900" : "text-slate-400"}>{a?.answer ?? "Not answered"}</dd>
                    </div>
                  );
                })}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Client</CardTitle></CardHeader>
            <CardBody className="flex items-center justify-between text-sm" data-testid="client-contact">
              <div>
                <p className="font-medium text-slate-900">{request.client_display}</p>
                <p className="text-slate-500">{request.zip} {request.place}</p>
              </div>
              {contact && mine ? (
                <div className="text-right">
                  <p className="font-medium">{contact.full_name}</p>
                  <p className="inline-flex items-center gap-1 text-slate-600"><Phone className="size-3.5" /> {contact.phone}</p>
                  <p className="text-slate-600">{contact.email}</p>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-slate-600"><Lock className="size-3.5" /> Contact hidden until hire</span>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Why you got this lead</CardTitle></CardHeader>
            <CardBody><ReasonChips reasons={lead.reasons} /></CardBody>
          </Card>
        </div>

        <aside className="col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>{quote ? "Your quote" : "Send a quote"}</CardTitle>
              <span className="text-sm text-slate-500" data-testid="lead-credits">{credits} credits</span>
            </CardHeader>
            <CardBody>
              {quote ? (
                <div className="space-y-3 text-sm" data-testid="sent-quote">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-semibold">{formatUsd(quote.price_cents)}</span>
                    <span className="capitalize text-slate-500">{quote.price_type}</span>
                  </div>
                  <p className="text-slate-600">Can start {formatDateTime(quote.available_at)}</p>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">The client sees</p>
                    <p className="mt-1 text-slate-800" data-testid="sent-quote-masked">{quote.masked}</p>
                  </div>
                  {quote.masked !== quote.message && (
                    <div className="rounded-lg border border-dashed border-slate-200 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Your original (shown to the client after hire)</p>
                      <p className="mt-1 text-slate-600">{quote.message}</p>
                    </div>
                  )}
                  <p className="text-xs text-slate-500">Lead fee paid: {quote.fee_credits} credits · sent {timeAgo(quote.created_at)}</p>
                </div>
              ) : lead.pro_id !== persona.id ? (
                <p className="text-sm text-slate-500">Only the pro who got this lead can quote on it.</p>
              ) : lead.status === "not_selected" || request.status !== "open" ? (
                <p className="text-sm text-slate-500">This request is closed to new quotes.</p>
              ) : (
                <QuoteForm leadId={lead.id} fee={lead.fee_credits} credits={credits} suggested={null} />
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
