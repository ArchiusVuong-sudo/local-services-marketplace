import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { asUser } from "@/lib/db/scoped";
import { RuleError } from "@/lib/db/sql";
import { matchPros } from "@/lib/domain/matching";
import { HERO } from "@/lib/seed/people";
import { listCategories, matchPool, zipIndex } from "@/lib/services/catalog";
import { simulateReplies } from "@/lib/services/demo";
import { hireQuote } from "@/lib/services/hire";
import { advanceJob } from "@/lib/services/jobs";
import { leaveReview } from "@/lib/services/reviews";
import { jobLedger, requestLeads } from "@/lib/services/views";
import { count, seededDb } from "./helpers";
import { heroQuote, heroRequest, MAYA, PIPEWRIGHT } from "./flow-helpers";

let db: Db;

beforeAll(async () => {
  ({ db } = await seededDb());
});

async function pipewrightScore(): Promise<{ score: number; count: number }> {
  const cats = await listCategories(db);
  const pool = await matchPool(db, "water-heater-repair");
  const m = matchPros({ request: { category_slug: "water-heater-repair", zip: "85016", timing: "this_week" }, category: cats[0]!, pros: pool.pros, promotions: pool.promotions, zips: await zipIndex(db) });
  const p = pool.pros.find((x) => x.user_id === PIPEWRIGHT)!;
  return { score: m.find((x) => x.pro_id === PIPEWRIGHT)!.score, count: p.review_count };
}

describe("full lifecycle: note to payout to review", () => {
  it("runs end to end and keeps the books balanced", async () => {
    const before = await pipewrightScore();
    expect(before.count).toBe(41);

    const { requestId, intakeId } = await heroRequest(db);
    expect(await count(db, "select count(*) as n from intake_runs where id = $1 and path = 'replay'", [intakeId])).toBe(1);

    const leads = await asUser(db, MAYA, (tx) => requestLeads(tx, requestId));
    expect(leads).toHaveLength(4);
    expect(leads[0]?.pro_id).toBe(PIPEWRIGHT);
    expect(leads.filter((l) => l.sponsored).map((l) => l.pro_id)).toEqual(["pro_bluepeak"]);
    // Every matched pro was notified of the lead.
    for (const l of leads) expect(await count(db, "select count(*) as n from notifications where user_id = $1 and href = $2", [l.pro_id, `/pro/leads/${l.id}`])).toBe(1);

    const { quoteId } = await heroQuote(db, requestId);
    const sim = await simulateReplies(db);
    expect(sim).toEqual({ requestId, quotes: 3 });
    expect(await count(db, "select count(*) as n from quotes where request_id = $1", [requestId])).toBe(4);

    const { jobId } = await asUser(db, MAYA, (tx) => hireQuote(tx, MAYA, quoteId));
    expect(await count(db, "select count(*) as n from leads where request_id = $1 and status = 'not_selected'", [requestId])).toBe(3);
    expect(await count(db, "select count(*) as n from notifications where kind = 'not_selected' and created_at > now() - interval '1 minute'")).toBe(3);
    await expect(asUser(db, MAYA, (tx) => hireQuote(tx, MAYA, quoteId))).rejects.toBeInstanceOf(RuleError);

    await expect(asUser(db, PIPEWRIGHT, (tx) => advanceJob(tx, PIPEWRIGHT, jobId, { action: "done", note: "" }))).rejects.toThrow(/can't go from Booked to Done/);
    await asUser(db, PIPEWRIGHT, (tx) => advanceJob(tx, PIPEWRIGHT, jobId, { action: "schedule", scheduled_for: new Date(Date.now() + 86_400_000) }));
    await expect(asUser(db, PIPEWRIGHT, (tx) => advanceJob(tx, PIPEWRIGHT, jobId, { action: "schedule", scheduled_for: new Date() }))).rejects.toBeInstanceOf(RuleError);
    await asUser(db, PIPEWRIGHT, (tx) => advanceJob(tx, PIPEWRIGHT, jobId, { action: "start" }));
    await asUser(db, PIPEWRIGHT, (tx) => advanceJob(tx, PIPEWRIGHT, jobId, { action: "done", note: "Replaced the drain valve." }));

    const ledger = await asUser(db, MAYA, (tx) => jobLedger(tx, jobId));
    expect(ledger.map((t) => t.kind)).toEqual(["payment_hold", "payout_release"]);
    for (const t of ledger) expect(t.lines.reduce((s, l) => s + Number(l.amount_cents), 0)).toBe(0);
    const payout = ledger[1]!.lines.find((l) => l.account === "pro_payouts")!;
    const fee = ledger[1]!.lines.find((l) => l.account === "platform_payment_fees")!;
    expect(Number(payout.amount_cents)).toBe(42_000 - 4_200);
    expect(Number(fee.amount_cents)).toBe(4_200);

    const events = (await db.query<{ kind: string }>("select kind from job_events where job_id = $1 order by id", [jobId])).rows.map((r) => r.kind);
    expect(events).toEqual(["booked", "payment_held", "scheduled", "in_progress", "done", "payout_released"]);
    expect(await count(db, "select count(*) as n from notifications where user_id = $1 and href = $2", [MAYA, `/jobs/${jobId}`])).toBe(3);

    await asUser(db, MAYA, (tx) => leaveReview(tx, MAYA, jobId, { rating: 5, body: "Fixed in an hour, clean work" }));
    const after = await pipewrightScore();
    expect(after.count).toBe(42);
    expect(after.score).toBeGreaterThan(before.score);
  });

  it("every ledger transaction sums to zero, and so does the whole ledger", async () => {
    expect(await count(db, "select count(*) as n from (select transaction_id from ledger_entries group by 1 having sum(amount_cents) <> 0) x")).toBe(0);
    expect(await count(db, "select coalesce(sum(amount_cents), 0) as n from ledger_entries")).toBe(0);
    expect(await count(db, "select count(*) as n from ledger_transactions t where not exists (select 1 from ledger_entries e where e.transaction_id = t.id)")).toBe(0);
  });

  it("pro credits always match the credit ledger", async () => {
    const rows = await db.query<{ user_id: string; credits: number; ledger: string }>(
      `select p.user_id, p.credits,
              (select coalesce(sum(e.amount_cents), 0) from ledger_entries e join ledger_transactions t on t.id = e.transaction_id
                where t.pro_id = p.user_id and e.account = 'pro_credit_balance') as ledger
         from pro_profiles p`,
    );
    for (const r of rows.rows) expect(Number(r.ledger), r.user_id).toBe(r.credits * 100);
    expect(HERO.pro).toBe(PIPEWRIGHT);
  });
});
