import type { Queryable } from "@/lib/db/client";
import { must, one, NotFoundError, RuleError, toRuleError } from "@/lib/db/sql";
import { formatUsd, holdLines, platformFeeCents } from "@/lib/domain/money";
import { postTransaction } from "./ledger";
import { notify } from "./notifications";

/**
 * The client hires one quote: the job is booked, a simulated test-mode payment holds the price,
 * the hired lead is marked hired and every other lead on the request closes as not selected.
 */
export async function hireQuote(q: Queryable, clientId: string, quoteId: number, now: Date = new Date()): Promise<{ jobId: number }> {
  const quote = await one<{ id: number; lead_id: number; request_id: number; pro_id: string; price_cents: number; available_at: string }>(
    q,
    "select id, lead_id, request_id, pro_id, price_cents, available_at from quotes where id = $1",
    [quoteId],
  );
  if (!quote) throw new NotFoundError();
  const req = await one<{ id: number; client_id: string; status: string; title: string }>(
    q,
    "select id, client_id, status, title from service_requests where id = $1",
    [quote.request_id],
  );
  if (!req || req.client_id !== clientId) throw new NotFoundError();
  if (req.status !== "open") throw new RuleError("This request already has a hire");

  const fee = platformFeeCents(quote.price_cents);
  let jobId: number;
  try {
    jobId = (
      await must<{ id: number }>(
        q,
        `insert into jobs (request_id, quote_id, client_id, pro_id, price_cents, fee_cents, created_at)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [req.id, quote.id, clientId, quote.pro_id, quote.price_cents, fee, now],
      )
    ).id;
  } catch (e) {
    throw toRuleError(e);
  }
  await q.query("update service_requests set status = 'hired' where id = $1", [req.id]);
  await q.query("update leads set status = 'hired' where id = $1", [quote.lead_id]);
  const others = await q.query<{ pro_id: string }>(
    "update leads set status = 'not_selected' where request_id = $1 and id <> $2 returning pro_id",
    [req.id, quote.lead_id],
  );

  await postTransaction(q, {
    kind: "payment_hold",
    job_id: jobId,
    pro_id: quote.pro_id,
    client_id: clientId,
    memo: `Payment held for job #${jobId} (test mode)`,
    lines: holdLines(quote.price_cents),
    now,
  });
  await q.query("insert into job_events (job_id, actor_id, kind, note, created_at) values ($1, $2, 'booked', $3, $4)", [
    jobId, clientId, "Quote accepted", now,
  ]);
  await q.query("insert into job_events (job_id, actor_id, kind, note, created_at) values ($1, $2, 'payment_held', $3, $4)", [
    jobId, clientId, `${formatUsd(quote.price_cents)} held in test mode until the job is done`, now,
  ]);

  const client = await must<{ display_name: string }>(q, "select display_name from users where id = $1", [clientId]);
  await notify(q, quote.pro_id, {
    kind: "hired",
    title: `You're hired by ${client.display_name}`,
    body: `${req.title}. ${formatUsd(quote.price_cents)} is held until the job is done.`,
    href: `/jobs/${jobId}`,
  }, now);
  for (const o of others.rows) {
    await notify(q, o.pro_id, { kind: "not_selected", title: "The client hired another pro", body: req.title, href: "/pro" }, now);
  }
  return { jobId };
}
