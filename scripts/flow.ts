/**
 * Drives the whole marketplace lifecycle over HTTP against a running app and checks each step:
 * note -> request -> matched leads -> quote (credits, masking) -> other quotes -> hire (payment held)
 * -> schedule, start, done (payout minus fee) -> review -> admin ledger check -> access check.
 * Usage: npm run flow  (app on http://127.0.0.1:4111, or FLOW_URL=...)
 */
import { HERO_NOTE } from "@/lib/intake/samples";

const BASE = process.env.FLOW_URL ?? `http://127.0.0.1:${process.env.PORT ?? 4111}`;
const MAYA = "client_maya";
const PIPEWRIGHT = "pro_pipewright";
const BRIGHTLINE = "pro_brightline";
const ADMIN = "admin_ops";

let step = 0;
function check(cond: unknown, what: string): void {
  step++;
  if (!cond) {
    console.error(`FAIL ${step}. ${what}`);
    process.exit(1);
  }
  console.log(`ok   ${step}. ${what}`);
}

async function call<T>(persona: string, method: "GET" | "POST", path: string, body?: unknown): Promise<{ status: number; json: T }> {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", cookie: `persona=${persona}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, json };
}

type IntakeResult = { id: number; path: string; output: { category_slug: string; zip: string | null; timing: string | null; budget_usd: number | null; title: string; details: string; answers: { question_id: string; answer: string }[] } };

async function intake(note: string): Promise<IntakeResult> {
  const res = await fetch(BASE + "/api/intake", { method: "POST", headers: { "content-type": "application/json", cookie: `persona=${MAYA}` }, body: JSON.stringify({ note }) });
  const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l) as { type: string; result?: IntakeResult; error?: string });
  const r = lines.find((l) => l.type === "result")?.result;
  if (!r) throw new Error(`intake failed: ${JSON.stringify(lines.at(-1))}`);
  return r;
}

async function main(): Promise<void> {
  const health = await call<{ ok: boolean; intake: string }>(MAYA, "GET", "/api/health");
  check(health.json.ok, `app is up at ${BASE} (intake mode ${health.json.intake})`);

  const t0 = Date.now();
  const read = await intake(HERO_NOTE);
  const o = read.output;
  check(o.category_slug === "water-heater-repair" && o.zip === "85016" && o.budget_usd === 450, `note read by ${read.path} in ${Date.now() - t0} ms: ${o.category_slug}, ${o.zip}, $${o.budget_usd}, ${o.timing}`);

  const created = await call<{ id: number; leads: number }>(MAYA, "POST", "/api/requests", {
    ...o,
    timing: o.timing ?? "this_week",
    answers: [...o.answers, { question_id: "fuel", answer: "Gas" }],
    note: HERO_NOTE,
    intake_run_id: read.id,
  });
  check(created.status === 200 && created.json.leads >= 1 && created.json.leads <= 4, `request #${created.json.id} sent to ${created.json.leads} pros`);
  const requestId = created.json.id;

  type ReqView = { leads: { id: number; pro_id: string; sponsored: boolean; reasons: { kind: string }[] }[]; quotes: { id: number; pro_id: string; price_cents: number; message: string }[] };
  const view = await call<ReqView>(MAYA, "GET", `/api/requests/${requestId}`);
  const sponsored = view.json.leads.filter((l) => l.sponsored).length;
  check(sponsored <= 1 && view.json.leads.every((l) => l.reasons.length >= 4), `every match has reasons, ${sponsored} sponsored`);
  const lead = view.json.leads.find((l) => l.pro_id === PIPEWRIGHT);
  check(lead, "Pipewright Plumbing got a lead");

  const other = await call(BRIGHTLINE, "GET", `/api/requests/${requestId}`);
  check(other.status === 404, "another pro opening the request gets 404");

  const quote = await call<{ id: number; fee_credits: number; message: string; credits: number }>(PIPEWRIGHT, "POST", `/api/leads/${lead!.id}/quote`, {
    price_usd: 420,
    price_type: "fixed",
    available_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    message: "Can swap the valve and flush the tank, call me at 602-555-0147",
  });
  check(quote.status === 200 && !quote.json.message.includes("555-0147"), `quote sent, phone masked: "${quote.json.message}"`);
  check(quote.json.fee_credits === 15, `lead fee ${quote.json.fee_credits} credits, ${quote.json.credits} left`);

  const forged = await call(BRIGHTLINE, "POST", `/api/leads/${lead!.id}/quote`, { price_usd: 1, price_type: "fixed", available_at: new Date().toISOString(), message: "forged" });
  check(forged.status === 404, "a forged quote on another pro's lead is refused");

  const sim = await call<{ quotes: number }>(MAYA, "POST", "/api/demo/simulate-replies");
  check(sim.status === 200, `demo control: ${sim.json.quotes} more quotes`);

  const compare = await call<ReqView>(MAYA, "GET", `/api/requests/${requestId}`);
  const mine = compare.json.quotes.find((q) => q.pro_id === PIPEWRIGHT);
  check(mine && mine.price_cents === 42000 && mine.message.includes("hidden until hire"), `client compares ${compare.json.quotes.length} quotes, contact still hidden`);

  const hire = await call<{ jobId: number }>(MAYA, "POST", `/api/quotes/${mine!.id}/hire`);
  check(hire.status === 200 && hire.json.jobId > 0, `hired: job #${hire.json.jobId}, $420 held in test mode`);
  const jobId = hire.json.jobId;

  const again = await call(MAYA, "POST", `/api/quotes/${mine!.id}/hire`);
  check(again.status === 409, "a second hire on the same request is refused");

  const early = await call(MAYA, "POST", `/api/jobs/${jobId}/review`, { rating: 5, body: "too early" });
  check(early.status === 409, "a review before Done is refused");

  const jump = await call(PIPEWRIGHT, "POST", `/api/jobs/${jobId}/advance`, { action: "done", note: "skip" });
  check(jump.status === 409, "jumping from Booked to Done is refused");

  for (const [action, extra] of [["schedule", { scheduled_for: new Date(Date.now() + 2 * 86_400_000).toISOString() }], ["start", {}], ["done", { note: "Replaced the drain valve and flushed the tank." }]] as const) {
    const r = await call<{ status: string }>(PIPEWRIGHT, "POST", `/api/jobs/${jobId}/advance`, { action, ...extra });
    check(r.status === 200, `pro: ${action} -> ${r.json.status}`);
  }

  type JobView = { job: { status: string; price_cents: number; fee_cents: number }; events: { kind: string }[]; ledger: { kind: string; lines: { account: string; amount_cents: number }[] }[] };
  const job = await call<JobView>(MAYA, "GET", `/api/jobs/${jobId}`);
  const sums = job.json.ledger.map((t) => t.lines.reduce((s, l) => s + Number(l.amount_cents), 0));
  const payout = job.json.ledger.find((t) => t.kind === "payout_release")?.lines.find((l) => l.account === "pro_payouts");
  check(job.json.job.status === "done" && sums.every((s) => s === 0), `job done, ${sums.length} ledger transactions each sum to $0`);
  check(Number(payout?.amount_cents) === 37800 && job.json.job.fee_cents === 4200, "payout $378 = $420 minus the $42 platform fee");

  const review = await call(MAYA, "POST", `/api/jobs/${jobId}/review`, { rating: 5, body: "Fixed in an hour, clean work" });
  check(review.status === 200, "client left a 5-star review");
  const second = await call(MAYA, "POST", `/api/jobs/${jobId}/review`, { rating: 1, body: "again" });
  check(second.status === 409, "a second review is refused");

  const stats = await call<{ ledger: { unbalanced: number; total_cents: number }; funnel: { requests: number } }>(ADMIN, "GET", "/api/admin/stats");
  check(stats.json.ledger.unbalanced === 0 && stats.json.ledger.total_cents === 0, `admin: all ledger transactions balance (${stats.json.funnel.requests} requests)`);
  const notAdmin = await call(MAYA, "GET", "/api/admin/stats");
  check(notAdmin.status === 409, "a client can't read admin stats");

  console.log(`\nFLOW PASSED: ${step} checks in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
