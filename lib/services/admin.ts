import type { Db, Queryable } from "@/lib/db/client";
import { asUser } from "@/lib/db/scoped";
import { one, rows, RuleError } from "@/lib/db/sql";

export type DashboardStats = {
  funnel: { requests: number; quoted: number; hired: number; done: number };
  money: { gmv_cents: number; held_now_cents: number; paid_out_cents: number; payment_fees_cents: number; lead_fees_cents: number };
  median_first_quote_min: number | null;
  top_categories: { name: string; requests: number; hires: number }[];
  weekly: { week: string; requests: number; hires: number }[];
  ledger: { transactions: number; unbalanced: number; total_cents: number };
};

const n = (v: unknown) => Number(v ?? 0);

/** Dashboard numbers. Runs as the admin (row-level security lets the admin role read every row). */
export async function dashboardStats(q: Queryable): Promise<DashboardStats> {
  const f = await one<Record<string, unknown>>(
    q,
    `select (select count(*) from service_requests) as requests,
            (select count(distinct request_id) from quotes) as quoted,
            (select count(*) from jobs) as hired,
            (select count(*) from jobs where status = 'done') as done`,
  );
  const m = await one<Record<string, unknown>>(
    q,
    `select (select coalesce(sum(price_cents), 0) from jobs) as gmv,
            coalesce(sum(amount_cents) filter (where account = 'escrow_held'), 0) as held,
            coalesce(sum(amount_cents) filter (where account = 'pro_payouts'), 0) as paid,
            coalesce(sum(amount_cents) filter (where account = 'platform_payment_fees'), 0) as pay_fees,
            coalesce(sum(amount_cents) filter (where account = 'platform_lead_fees'), 0) as lead_fees
       from ledger_entries`,
  );
  const med = await one<{ minutes: number | null }>(
    q,
    `select percentile_cont(0.5) within group (order by extract(epoch from fq.first_at - r.created_at) / 60) as minutes
       from service_requests r
       join (select request_id, min(created_at) as first_at from quotes group by request_id) fq on fq.request_id = r.id`,
  );
  const top = await rows<{ name: string; requests: unknown; hires: unknown }>(
    q,
    `select c.name, count(r.id) as requests, count(j.id) as hires
       from service_requests r join categories c on c.slug = r.category_slug left join jobs j on j.request_id = r.id
      group by c.name order by count(r.id) desc, c.name limit 5`,
  );
  const weekly = await rows<{ week: string; requests: unknown; hires: unknown }>(
    q,
    `with weeks as (
       select generate_series(date_trunc('week', now()) - interval '8 weeks', date_trunc('week', now()), interval '1 week') as week
     )
     select to_char(w.week, 'YYYY-MM-DD') as week,
            (select count(*) from service_requests r where date_trunc('week', r.created_at) = w.week) as requests,
            (select count(*) from jobs j where date_trunc('week', j.created_at) = w.week) as hires
       from weeks w order by w.week`,
  );
  const l = await one<Record<string, unknown>>(
    q,
    `select (select count(*) from ledger_transactions) as transactions,
            (select count(*) from (select t.id from ledger_transactions t left join ledger_entries e on e.transaction_id = t.id
                                   group by t.id having coalesce(sum(e.amount_cents), 0) <> 0 or count(e.id) < 2) x) as unbalanced,
            (select coalesce(sum(amount_cents), 0) from ledger_entries) as total`,
  );
  return {
    funnel: { requests: n(f?.requests), quoted: n(f?.quoted), hired: n(f?.hired), done: n(f?.done) },
    money: {
      gmv_cents: n(m?.gmv),
      held_now_cents: n(m?.held),
      paid_out_cents: n(m?.paid),
      payment_fees_cents: n(m?.pay_fees),
      lead_fees_cents: n(m?.lead_fees),
    },
    median_first_quote_min: med?.minutes === null || med?.minutes === undefined ? null : Math.round(Number(med.minutes)),
    top_categories: top.map((t) => ({ name: t.name, requests: n(t.requests), hires: n(t.hires) })),
    weekly: weekly.map((w) => ({ week: w.week, requests: n(w.requests), hires: n(w.hires) })),
    ledger: { transactions: n(l?.transactions), unbalanced: n(l?.unbalanced), total_cents: n(l?.total) },
  };
}

export type PromotionRow = {
  id: number;
  status: "active" | "paused";
  business_name: string;
  pro_id: string;
  verified: boolean;
  category_name: string;
  placements: number;
  quotes: number;
  hires: number;
};

export async function promotionRows(q: Queryable): Promise<PromotionRow[]> {
  const list = await rows<PromotionRow & { placements: unknown; quotes: unknown; hires: unknown }>(
    q,
    `select pr.id, pr.status, p.business_name, p.user_id as pro_id, p.verified, c.name as category_name,
            (select count(*) from leads l where l.promotion_id = pr.id) as placements,
            (select count(*) from leads l join quotes qt on qt.lead_id = l.id where l.promotion_id = pr.id) as quotes,
            (select count(*) from leads l where l.promotion_id = pr.id and l.status = 'hired') as hires
       from promotions pr join pro_profiles p on p.user_id = pr.pro_id join categories c on c.slug = pr.category_slug
      order by pr.id`,
  );
  return list.map((r) => ({ ...r, placements: n(r.placements), quotes: n(r.quotes), hires: n(r.hires) }));
}

export async function setPromotionStatus(q: Queryable, id: number, status: "active" | "paused"): Promise<void> {
  const r = await q.query("update promotions set status = $2 where id = $1", [id, status]);
  if (!r.affectedRows) throw new RuleError("Only an admin can change sponsored placements");
}

export const ACCESS_TABLES = [
  "service_requests", "leads", "quotes", "jobs", "user_contacts", "ledger_transactions", "notifications", "intake_runs",
] as const;

export const ACCESS_PEOPLE = ["client_maya", "client_jordan", "pro_pipewright", "pro_brightline", "admin_ops"] as const;

export type AccessMatrix = {
  people: { id: string; display_name: string; role: string }[];
  totals: Record<string, number>;
  visible: Record<string, Record<string, number>>;
};

/** For each person and table, how many rows the same row-level security policies let them read. */
export async function dataAccessMatrix(db: Db): Promise<AccessMatrix> {
  const people = await rows<{ id: string; display_name: string; role: string }>(
    db,
    `select id, display_name, role from users where id = any($1) order by array_position($1, id)`,
    [ACCESS_PEOPLE as unknown as string[]],
  );
  const totals: Record<string, number> = {};
  for (const t of ACCESS_TABLES) totals[t] = n((await one<{ c: unknown }>(db, `select count(*) as c from ${t}`))?.c);
  const visible: Record<string, Record<string, number>> = {};
  for (const p of people) {
    visible[p.id] = await asUser(db, p.id, async (tx) => {
      const out: Record<string, number> = {};
      for (const t of ACCESS_TABLES) out[t] = n((await one<{ c: unknown }>(tx, `select count(*) as c from ${t}`))?.c);
      return out;
    });
  }
  return { people, totals, visible };
}
