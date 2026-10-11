import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { asUser } from "@/lib/db/scoped";
import { NotFoundError, RuleError } from "@/lib/db/sql";
import { hireQuote } from "@/lib/services/hire";
import { advanceJob } from "@/lib/services/jobs";
import { leaveReview } from "@/lib/services/reviews";
import { setPromotionStatus } from "@/lib/services/admin";
import { contactFor } from "@/lib/services/views";
import { count, seededDb } from "./helpers";
import { ADMIN, BRIGHTLINE, heroQuote, heroRequest, JORDAN, leadFor, MAYA, PIPEWRIGHT } from "./flow-helpers";

let db: Db;
let requestId: number;
let leadId: number;
let quoteId: number;

beforeAll(async () => {
  ({ db } = await seededDb());
  ({ requestId } = await heroRequest(db));
  ({ leadId, quoteId } = await heroQuote(db, requestId));
});

const visible = (user: string, sql: string, params: unknown[] = []) =>
  asUser(db, user, async (tx) => Number((await tx.query<{ n: number }>(sql, params)).rows[0]?.n ?? 0));

describe("row-level security", () => {
  it("the owner role sees everything, the app role only what the policies allow", async () => {
    expect(await count(db, "select count(*) as n from leads where pro_id = $1", [PIPEWRIGHT])).toBeGreaterThan(1);
    expect(await visible(BRIGHTLINE, "select count(*) as n from leads where pro_id = $1", [PIPEWRIGHT])).toBe(0);
  });

  it("acting as pro B, pro A's leads, quotes and the client's contact return 0 rows", async () => {
    expect(await visible(BRIGHTLINE, "select count(*) as n from leads where id = $1", [leadId])).toBe(0);
    expect(await visible(BRIGHTLINE, "select count(*) as n from quotes where id = $1", [quoteId])).toBe(0);
    expect(await visible(BRIGHTLINE, "select count(*) as n from service_requests where id = $1", [requestId])).toBe(0);
    expect(await visible(BRIGHTLINE, "select count(*) as n from user_contacts where user_id = $1", [MAYA])).toBe(0);
    expect(await visible(BRIGHTLINE, "select count(*) as n from notifications where user_id = $1", [PIPEWRIGHT])).toBe(0);
  });

  it("another pro on the same request sees only its own lead and quote", async () => {
    const other = "pro_desertflow";
    expect(await visible(other, "select count(*) as n from leads where request_id = $1", [requestId])).toBe(1);
    expect(await visible(other, "select count(*) as n from quotes where request_id = $1", [requestId])).toBe(0);
  });

  it("rejects a forged quote insert for another pro's lead", async () => {
    const forge = (lead: number, asPro: string) =>
      asUser(db, BRIGHTLINE, (tx) =>
        tx.query(
          "insert into quotes (lead_id, request_id, pro_id, price_cents, price_type, available_at, message, message_original) values ($1, $2, $3, 100, 'fixed', now(), 'x', 'x')",
          [lead, requestId, asPro],
        ),
      );
    const otherLead = await leadFor(db, requestId, "pro_desertflow");
    const creditsBefore = await count(db, "select credits as n from pro_profiles where user_id = 'pro_desertflow'");
    await expect(forge(otherLead, "pro_desertflow")).rejects.toThrow(/permission denied/);
    await expect(forge(leadId, PIPEWRIGHT)).rejects.toThrow(/permission denied/);
    await expect(forge(otherLead, BRIGHTLINE)).rejects.toThrow(/lead not found|row-level security/);
    expect(await count(db, "select credits as n from pro_profiles where user_id = 'pro_desertflow'")).toBe(creditsBefore);
    expect(await count(db, "select count(*) as n from quotes where lead_id = $1", [otherLead])).toBe(0);
  });

  it("takes exactly the lead fee from the pro's credits when quoting", async () => {
    // Pipewright started at 120 and quoted once on a 15-credit water heater lead (in beforeAll).
    expect(await count(db, "select credits as n from pro_profiles where user_id = $1", [PIPEWRIGHT])).toBe(105);
    expect(await count(db, "select fee_credits as n from quotes where id = $1", [quoteId])).toBe(15);
    const fee = await count(
      db,
      "select sum(e.amount_cents) as n from ledger_entries e join ledger_transactions t on t.id = e.transaction_id where t.kind = 'lead_fee' and t.pro_id = $1 and e.account = 'platform_lead_fees' and t.memo = $2",
      [PIPEWRIGHT, `Lead fee for request #${requestId}`],
    );
    expect(fee).toBe(1500);
  });

  it("hides the unmasked message column from the app role", async () => {
    await expect(asUser(db, MAYA, (tx) => tx.query("select message_original from quotes where id = $1", [quoteId]))).rejects.toThrow(/permission denied/);
    const masked = await asUser(db, MAYA, (tx) => tx.query<{ m: string }>("select quote_message($1) as m", [quoteId]));
    expect(masked.rows[0]?.m).toContain("[phone hidden until hire]");
  });

  it("a client sees only their own requests", async () => {
    const mine = await count(db, "select count(*) as n from service_requests where client_id = $1", [MAYA]);
    expect(await visible(MAYA, "select count(*) as n from service_requests")).toBe(mine);
    expect(await visible(JORDAN, "select count(*) as n from service_requests where id = $1", [requestId])).toBe(0);
  });

  it("opens contact details to both sides only after hire", async () => {
    expect(await asUser(db, PIPEWRIGHT, (tx) => contactFor(tx, MAYA))).toBeNull();
    expect(await asUser(db, MAYA, (tx) => contactFor(tx, PIPEWRIGHT))).toBeNull();
    const { jobId } = await asUser(db, MAYA, (tx) => hireQuote(tx, MAYA, quoteId));
    expect((await asUser(db, PIPEWRIGHT, (tx) => contactFor(tx, MAYA)))?.full_name).toBe("Maya Ortiz");
    expect((await asUser(db, MAYA, (tx) => contactFor(tx, PIPEWRIGHT)))?.phone).toBe("602-555-0147");
    expect(await asUser(db, BRIGHTLINE, (tx) => contactFor(tx, MAYA))).toBeNull();
    const original = await asUser(db, MAYA, (tx) => tx.query<{ m: string }>("select quote_message($1) as m", [quoteId]));
    expect(original.rows[0]?.m).toContain("602-555-0147");

    // Reviews: not before Done, not by anyone else, only once.
    await expect(asUser(db, MAYA, (tx) => leaveReview(tx, MAYA, jobId, { rating: 5, body: "early" }))).rejects.toBeInstanceOf(RuleError);
    await asUser(db, PIPEWRIGHT, (tx) => advanceJob(tx, PIPEWRIGHT, jobId, { action: "schedule", scheduled_for: new Date() }));
    await asUser(db, PIPEWRIGHT, (tx) => advanceJob(tx, PIPEWRIGHT, jobId, { action: "start" }));
    await asUser(db, PIPEWRIGHT, (tx) => advanceJob(tx, PIPEWRIGHT, jobId, { action: "done", note: "ok" }));
    await expect(
      asUser(db, JORDAN, (tx) => tx.query("insert into reviews (job_id, client_id, pro_id, rating, body) values ($1, $2, $3, 1, 'fake')", [jobId, JORDAN, PIPEWRIGHT])),
    ).rejects.toThrow(/row-level security/);
    await expect(asUser(db, JORDAN, (tx) => leaveReview(tx, JORDAN, jobId, { rating: 1 }))).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      asUser(db, PIPEWRIGHT, (tx) => tx.query("insert into reviews (pro_id, rating, body, source) values ($1, 5, 'self', 'imported')", [PIPEWRIGHT])),
    ).rejects.toThrow(/row-level security/);
    await asUser(db, MAYA, (tx) => leaveReview(tx, MAYA, jobId, { rating: 5, body: "Fixed in an hour, clean work" }));
    await expect(asUser(db, MAYA, (tx) => leaveReview(tx, MAYA, jobId, { rating: 4 }))).rejects.toThrow(/already has a review/);
  });

  it("blocks illegal job status jumps in the database itself", async () => {
    const job = (await db.query<{ id: number }>("select id from jobs where pro_id = $1 and status = 'done' limit 1", [PIPEWRIGHT])).rows[0]!;
    await expect(asUser(db, PIPEWRIGHT, (tx) => tx.query("update jobs set status = 'booked' where id = $1", [job.id]))).rejects.toThrow(/illegal job status change|already done/);
    const fresh = (await db.query<{ id: number; pro_id: string }>("select id, pro_id from jobs where status = 'scheduled' limit 1")).rows[0]!;
    await expect(asUser(db, fresh.pro_id, (tx) => tx.query("update jobs set status = 'done' where id = $1", [fresh.id]))).rejects.toThrow(/illegal job status change/);
  });

  it("a client can't move a job and a non-admin can't change promotions", async () => {
    const job = (await db.query<{ id: number }>("select id from jobs where client_id = $1 limit 1", [MAYA])).rows[0]!;
    const r = await asUser(db, MAYA, (tx) => tx.query("update jobs set status = 'done' where id = $1", [job.id]));
    expect(r.affectedRows).toBe(0);
    await expect(asUser(db, PIPEWRIGHT, (tx) => setPromotionStatus(tx, 1, "paused"))).rejects.toBeInstanceOf(RuleError);
    await asUser(db, ADMIN, (tx) => setPromotionStatus(tx, 1, "paused"));
    expect(await count(db, "select count(*) as n from promotions where id = 1 and status = 'paused'")).toBe(1);
  });

  it("refuses an unbalanced ledger transaction at commit", async () => {
    const job = (await db.query<{ id: number }>("select id from jobs where pro_id = $1 limit 1", [PIPEWRIGHT])).rows[0]!;
    await expect(
      asUser(db, PIPEWRIGHT, async (tx) => {
        const t = await tx.query<{ id: number }>("insert into ledger_transactions (kind, job_id, pro_id) values ('payout_release', $1, $2) returning id", [job.id, PIPEWRIGHT]);
        await tx.query("insert into ledger_entries (transaction_id, account, amount_cents) values ($1, 'pro_payouts', 100000)", [t.rows[0]!.id]);
      }),
    ).rejects.toThrow(/does not balance/);
  });

  it("only pros can buy credits and the lead fee needs enough credits", async () => {
    await expect(asUser(db, MAYA, (tx) => tx.query("select buy_credits(10)"))).rejects.toThrow(/only pros/);
    await expect(asUser(db, PIPEWRIGHT, (tx) => tx.query("update pro_profiles set credits = 9999 where user_id = $1", [PIPEWRIGHT]))).rejects.toThrow(/permission denied/);
  });

  it("the same lead link opens for its pro and is missing for another pro", async () => {
    const lead = await leadFor(db, requestId, PIPEWRIGHT);
    expect(await visible(PIPEWRIGHT, "select count(*) as n from leads where id = $1", [lead])).toBe(1);
    expect(await visible(BRIGHTLINE, "select count(*) as n from leads where id = $1", [lead])).toBe(0);
  });
});
