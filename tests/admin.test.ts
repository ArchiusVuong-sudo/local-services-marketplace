import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { asUser } from "@/lib/db/scoped";
import { createRequest } from "@/lib/services/requests";
import { dashboardStats, dataAccessMatrix, setPromotionStatus } from "@/lib/services/admin";
import { count, seededDb } from "./helpers";
import { ADMIN, BRIGHTLINE, MAYA, PIPEWRIGHT } from "./flow-helpers";
import type { SeedSummary } from "@/lib/seed/seed";

let db: Db;
let summary: SeedSummary;

beforeAll(async () => {
  ({ db, summary } = await seededDb());
});

describe("seeded synthetic history", () => {
  it("is the same on every run (fixed seed)", () => {
    expect(summary).toMatchObject({ requests: 161, quotes: 355, jobs: 109, done: 104 });
  });

  it("starts the hero pro at 4.8 from 41 reviews and 120 credits", async () => {
    const p = (await db.query<{ review_count: number; rating_sum: number; credits: number }>("select review_count, rating_sum, credits from pro_profiles where user_id = $1", [PIPEWRIGHT])).rows[0]!;
    expect(p.review_count).toBe(41);
    expect((p.rating_sum / p.review_count).toFixed(1)).toBe("4.8");
    expect(p.credits).toBe(120);
  });
});

describe("admin dashboard", () => {
  it("matches a direct SQL recount", async () => {
    const s = await asUser(db, ADMIN, (tx) => dashboardStats(tx));
    expect(s.funnel.requests).toBe(await count(db, "select count(*) as n from service_requests"));
    expect(s.funnel.quoted).toBe(await count(db, "select count(distinct request_id) as n from quotes"));
    expect(s.funnel.hired).toBe(await count(db, "select count(*) as n from jobs"));
    expect(s.funnel.done).toBe(await count(db, "select count(*) as n from jobs where status = 'done'"));
    expect(s.money.gmv_cents).toBe(await count(db, "select sum(price_cents) as n from jobs"));
    expect(s.money.payment_fees_cents).toBe(await count(db, "select sum(fee_cents) as n from jobs where status = 'done'"));
    expect(s.money.lead_fees_cents).toBe(await count(db, "select sum(fee_credits) * 100 as n from quotes"));
    expect(s.money.held_now_cents).toBe(await count(db, "select coalesce(sum(price_cents), 0) as n from jobs where status <> 'done'"));
    expect(s.money.paid_out_cents).toBe(await count(db, "select sum(price_cents - fee_cents) as n from jobs where status = 'done'"));
    expect(s.ledger).toEqual({ transactions: await count(db, "select count(*) as n from ledger_transactions"), unbalanced: 0, total_cents: 0 });
    expect(s.top_categories[0]).toMatchObject({ name: "AC repair" });
    expect(s.weekly.reduce((a, w) => a + w.requests, 0)).toBeLessThanOrEqual(s.funnel.requests);
    const median = await db.query<{ m: number }>(
      "select percentile_cont(0.5) within group (order by extract(epoch from q.first - r.created_at) / 60) as m from service_requests r join (select request_id, min(created_at) as first from quotes group by 1) q on q.request_id = r.id",
    );
    expect(s.median_first_quote_min).toBe(Math.round(Number(median.rows[0]!.m)));
  });

  it("is admin only: a client reads the same queries scoped to their own rows", async () => {
    const s = await asUser(db, MAYA, (tx) => dashboardStats(tx));
    expect(s.funnel.requests).toBe(await count(db, "select count(*) as n from service_requests where client_id = $1", [MAYA]));
  });

  it("pausing a sponsored placement stops it from matching", async () => {
    const make = () =>
      asUser(db, MAYA, (tx) =>
        createRequest(tx, MAYA, { category_slug: "water-heater-repair", zip: "85016", timing: "this_week", budget_usd: 400, title: "Water heater check", details: "" }),
      );
    expect((await make()).matches.some((m) => m.sponsored && m.pro_id === "pro_bluepeak")).toBe(true);
    const promo = (await db.query<{ id: number }>("select id from promotions where pro_id = 'pro_bluepeak'")).rows[0]!;
    await asUser(db, ADMIN, (tx) => setPromotionStatus(tx, promo.id, "paused"));
    const after = await make();
    expect(after.matches.some((m) => m.sponsored)).toBe(false);
  });
});

describe("data access matrix", () => {
  it("counts rows through the same policies", async () => {
    const m = await dataAccessMatrix(db);
    expect(m.visible[MAYA]!.service_requests).toBe(await count(db, "select count(*) as n from service_requests where client_id = $1", [MAYA]));
    expect(m.visible[PIPEWRIGHT]!.leads).toBe(await count(db, "select count(*) as n from leads where pro_id = $1", [PIPEWRIGHT]));
    expect(m.visible[BRIGHTLINE]!.leads).toBe(await count(db, "select count(*) as n from leads where pro_id = $1", [BRIGHTLINE]));
    expect(m.visible[ADMIN]!.service_requests).toBe(m.totals.service_requests);
    expect(m.visible[MAYA]!.notifications).toBe(await count(db, "select count(*) as n from notifications where user_id = $1", [MAYA]));
  });
});
