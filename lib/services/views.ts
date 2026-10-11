import type { Queryable } from "@/lib/db/client";
import { one, rows } from "@/lib/db/sql";
import type { LedgerLine } from "@/lib/domain/money";
import type { CategoryQuestion, JobStatus, LeadStatus, ReasonChip, Role, Timing } from "@/lib/domain/types";
import type { ToolCallTrace } from "@/lib/intake/schema";

/** Read models for the pages. Every query runs inside asUser, so row-level security shapes what comes back. */

export type Persona = { id: string; role: Role; display_name: string; first_name: string };

export async function listPersonas(q: Queryable): Promise<Persona[]> {
  return rows<Persona>(q, "select id, role, display_name, first_name from users order by case role when 'client' then 0 when 'pro' then 1 else 2 end, id");
}

export type RequestSummary = {
  id: number;
  title: string;
  category_name: string;
  zip: string;
  status: "open" | "hired" | "closed";
  created_at: string;
  lead_count: number;
  quote_count: number;
  job_id: number | null;
  job_status: JobStatus | null;
};

export async function myRequests(q: Queryable, clientId: string, limit = 20): Promise<RequestSummary[]> {
  return rows<RequestSummary>(
    q,
    `select r.id, r.title, c.name as category_name, r.zip, r.status, r.created_at,
            (select count(*)::int from leads l where l.request_id = r.id) as lead_count,
            (select count(*)::int from quotes qt where qt.request_id = r.id) as quote_count,
            j.id as job_id, j.status as job_status
       from service_requests r
       join categories c on c.slug = r.category_slug
       left join jobs j on j.request_id = r.id
      where r.client_id = $1
      order by r.created_at desc, r.id desc limit $2`,
    [clientId, limit],
  );
}

export type IntakeRunView = {
  id: number;
  path: "live" | "replay" | "rules";
  model: string | null;
  duration_ms: number;
  tool_calls: ToolCallTrace[];
  fallback_reason: string | null;
  cost_usd: string | null;
};

export type RequestView = {
  id: number;
  client_id: string;
  title: string;
  details: string;
  note: string;
  zip: string;
  place: string;
  timing: Timing;
  budget_cents: number | null;
  status: "open" | "hired" | "closed";
  created_at: string;
  answers: { question_id: string; answer: string }[];
  category: { slug: string; name: string; questions: CategoryQuestion[]; lead_fee_credits: number };
  client_display: string;
  intake: IntakeRunView | null;
};

export async function requestView(q: Queryable, id: number): Promise<RequestView | null> {
  const r = await one<Omit<RequestView, "category" | "intake"> & { intake_run_id: number | null; category_slug: string }>(
    q,
    `select r.id, r.client_id, r.title, r.details, r.note, r.zip, z.place, r.timing, r.budget_cents, r.status, r.created_at,
            r.answers, r.intake_run_id, r.category_slug, u.display_name as client_display
       from service_requests r join zip_centroids z on z.zip = r.zip join users u on u.id = r.client_id
      where r.id = $1`,
    [id],
  );
  if (!r) return null;
  const category = (await one<RequestView["category"]>(q, "select slug, name, questions, lead_fee_credits from categories where slug = $1", [r.category_slug]))!;
  const intake = r.intake_run_id
    ? await one<IntakeRunView>(q, "select id, path, model, duration_ms, tool_calls, fallback_reason, cost_usd from intake_runs where id = $1", [r.intake_run_id])
    : null;
  return { ...r, category, intake };
}

export type LeadCard = {
  id: number;
  pro_id: string;
  business_name: string;
  verified: boolean;
  review_count: number;
  rating_sum: number;
  reply_minutes: number;
  rank: number;
  score: string;
  reasons: ReasonChip[];
  sponsored: boolean;
  status: LeadStatus;
};

export async function requestLeads(q: Queryable, requestId: number): Promise<LeadCard[]> {
  return rows<LeadCard>(
    q,
    `select l.id, l.pro_id, p.business_name, p.verified, p.review_count, p.rating_sum, p.reply_minutes,
            l.rank, l.score, l.reasons, l.sponsored, l.status
       from leads l join pro_profiles p on p.user_id = l.pro_id
      where l.request_id = $1 order by l.rank`,
    [requestId],
  );
}

export type QuoteCard = {
  id: number;
  lead_id: number;
  pro_id: string;
  business_name: string;
  verified: boolean;
  review_count: number;
  rating_sum: number;
  reply_minutes: number;
  price_cents: number;
  price_type: "fixed" | "estimate";
  available_at: string;
  message: string;
  created_at: string;
  sponsored: boolean;
  reply_after_min: number;
};

export async function requestQuotes(q: Queryable, requestId: number): Promise<QuoteCard[]> {
  return rows<QuoteCard>(
    q,
    `select qt.id, qt.lead_id, qt.pro_id, p.business_name, p.verified, p.review_count, p.rating_sum, p.reply_minutes,
            qt.price_cents, qt.price_type, qt.available_at, quote_message(qt.id) as message, qt.created_at, l.sponsored,
            greatest(1, round(extract(epoch from (qt.created_at - l.created_at)) / 60))::int as reply_after_min
       from quotes qt join pro_profiles p on p.user_id = qt.pro_id join leads l on l.id = qt.lead_id
      where qt.request_id = $1 order by qt.price_cents, qt.id`,
    [requestId],
  );
}

export async function jobForRequest(q: Queryable, requestId: number): Promise<{ id: number; status: JobStatus; quote_id: number } | null> {
  return one(q, "select id, status, quote_id from jobs where request_id = $1", [requestId]);
}

export type InboxLead = {
  id: number;
  request_id: number;
  title: string;
  category_name: string;
  client_display: string;
  zip: string;
  place: string;
  timing: Timing;
  budget_cents: number | null;
  fee_credits: number;
  status: LeadStatus;
  sponsored: boolean;
  created_at: string;
  quote_price_cents: number | null;
  job_id: number | null;
};

export async function proInbox(q: Queryable, proId: string, limit = 30): Promise<InboxLead[]> {
  return rows<InboxLead>(
    q,
    `select l.id, l.request_id, r.title, c.name as category_name, u.display_name as client_display, r.zip, z.place, r.timing,
            r.budget_cents, l.fee_credits, l.status, l.sponsored, l.created_at, qt.price_cents as quote_price_cents,
            j.id as job_id
       from leads l
       join service_requests r on r.id = l.request_id
       join categories c on c.slug = r.category_slug
       join users u on u.id = r.client_id
       join zip_centroids z on z.zip = r.zip
       left join quotes qt on qt.lead_id = l.id
       left join jobs j on j.quote_id = qt.id
      where l.pro_id = $1
      order by l.created_at desc, l.id desc limit $2`,
    [proId, limit],
  );
}

export type ProProfile = {
  user_id: string;
  business_name: string;
  owner_name: string;
  home_zip: string;
  place: string;
  radius_mi: number;
  category_slugs: string[];
  category_names: string[];
  verified: boolean;
  reply_minutes: number;
  credits: number;
  review_count: number;
  rating_sum: number;
  years_in_business: number;
  bio: string;
};

export async function proProfile(q: Queryable, proId: string): Promise<ProProfile | null> {
  return one<ProProfile>(
    q,
    `select p.*, z.place,
            array(select c.name from categories c where c.slug = any(p.category_slugs) order by c.sort) as category_names
       from pro_profiles p join zip_centroids z on z.zip = p.home_zip where p.user_id = $1`,
    [proId],
  );
}

export type ReviewView = { id: number; rating: number; body: string; author_label: string; source: string; created_at: string };

export async function proReviews(q: Queryable, proId: string, limit = 12): Promise<ReviewView[]> {
  return rows<ReviewView>(
    q,
    "select id, rating, body, author_label, source, created_at from reviews where pro_id = $1 order by created_at desc, id desc limit $2",
    [proId, limit],
  );
}

export type LeadView = {
  id: number;
  request_id: number;
  pro_id: string;
  status: LeadStatus;
  fee_credits: number;
  sponsored: boolean;
  reasons: ReasonChip[];
  created_at: string;
};

export async function leadView(q: Queryable, leadId: number): Promise<LeadView | null> {
  return one<LeadView>(q, "select id, request_id, pro_id, status, fee_credits, sponsored, reasons, created_at from leads where id = $1", [leadId]);
}

export type MyQuote = { id: number; price_cents: number; price_type: string; available_at: string; message: string; masked: string; fee_credits: number; created_at: string };

export async function quoteForLead(q: Queryable, leadId: number): Promise<MyQuote | null> {
  return one<MyQuote>(
    q,
    "select id, price_cents, price_type, available_at, quote_message(id) as message, message as masked, fee_credits, created_at from quotes where lead_id = $1",
    [leadId],
  );
}

export type Contact = { user_id: string; full_name: string; email: string; phone: string };

/** Returns null unless row-level security opens the row (yourself, admin, or the other side after hire). */
export async function contactFor(q: Queryable, userId: string): Promise<Contact | null> {
  return one<Contact>(q, "select user_id, full_name, email, phone from user_contacts where user_id = $1", [userId]);
}

export type JobView = {
  id: number;
  request_id: number;
  quote_id: number;
  client_id: string;
  pro_id: string;
  price_cents: number;
  fee_cents: number;
  status: JobStatus;
  scheduled_for: string | null;
  created_at: string;
  done_at: string | null;
  title: string;
  category_name: string;
  client_display: string;
  pro_display: string;
  zip: string;
  place: string;
};

export async function jobView(q: Queryable, jobId: number): Promise<JobView | null> {
  return one<JobView>(
    q,
    `select j.*, r.title, c.name as category_name, cu.display_name as client_display, pu.display_name as pro_display, r.zip, z.place
       from jobs j join service_requests r on r.id = j.request_id join categories c on c.slug = r.category_slug
       join users cu on cu.id = j.client_id join users pu on pu.id = j.pro_id join zip_centroids z on z.zip = r.zip
      where j.id = $1`,
    [jobId],
  );
}

export type JobEvent = { id: number; kind: string; note: string; actor: string; created_at: string };

export async function jobEvents(q: Queryable, jobId: number): Promise<JobEvent[]> {
  return rows<JobEvent>(
    q,
    "select e.id, e.kind, e.note, u.display_name as actor, e.created_at from job_events e join users u on u.id = e.actor_id where e.job_id = $1 order by e.created_at, e.id",
    [jobId],
  );
}

export type LedgerTx = { id: number; kind: string; memo: string; created_at: string; lines: LedgerLine[] };

export async function jobLedger(q: Queryable, jobId: number): Promise<LedgerTx[]> {
  return rows<LedgerTx>(
    q,
    `select t.id, t.kind, t.memo, t.created_at,
            coalesce(json_agg(json_build_object('account', e.account, 'amount_cents', e.amount_cents) order by e.id)
                     filter (where e.id is not null), '[]') as lines
       from ledger_transactions t left join ledger_entries e on e.transaction_id = t.id
      where t.job_id = $1 group by t.id order by t.id`,
    [jobId],
  );
}

export async function jobReview(q: Queryable, jobId: number): Promise<ReviewView | null> {
  return one<ReviewView>(q, "select id, rating, body, author_label, source, created_at from reviews where job_id = $1", [jobId]);
}

export async function proJobs(q: Queryable, proId: string): Promise<{ id: number; title: string; status: JobStatus; client_display: string; price_cents: number; scheduled_for: string | null }[]> {
  return rows(
    q,
    `select j.id, r.title, j.status, u.display_name as client_display, j.price_cents, j.scheduled_for
       from jobs j join service_requests r on r.id = j.request_id join users u on u.id = j.client_id
      where j.pro_id = $1 and j.status <> 'done' order by j.created_at desc`,
    [proId],
  );
}

export async function proCredits(q: Queryable, proId: string): Promise<number> {
  return (await one<{ credits: number }>(q, "select credits from pro_profiles where user_id = $1", [proId]))?.credits ?? 0;
}
