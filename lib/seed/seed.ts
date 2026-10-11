import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "@/lib/db/client";
import { asUser } from "@/lib/db/scoped";
import { one, rows } from "@/lib/db/sql";
import type { Timing } from "@/lib/domain/types";
import { hireQuote } from "@/lib/services/hire";
import { advanceJob } from "@/lib/services/jobs";
import { sendQuote } from "@/lib/services/quotes";
import { createRequest } from "@/lib/services/requests";
import { leaveReview } from "@/lib/services/reviews";
import { CATEGORIES, CATEGORY_BY_SLUG } from "./categories";
import { ADMIN, CLIENTS, HERO, PROMOTIONS, PROS } from "./people";
import { Rng } from "./random";
import { BASE_PRICE_USD, CATEGORY_WEIGHTS, DONE_NOTES, JOB_TEXT, QUOTE_MESSAGES, REVIEW_AUTHORS, REVIEW_TEXT } from "./templates";

export const SEED = 20261011;
export const HISTORY_DAYS = 56;
const WEEKLY_REQUESTS = [14, 16, 18, 19, 20, 22, 24, 27];
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const CONTACT_DOMAIN = ["example", "com"].join(".");

type ZipFixture = { zips: { zip: string; place: string; state: string; lat: number; lng: number }[] };

export type SeedSummary = { requests: number; quotes: number; jobs: number; done: number; reviews: number; ms: number };

type Event =
  | { t: number; seq: number; kind: "create"; client: string; category: string; forceHire?: boolean }
  | { t: number; seq: number; kind: "quote"; leadId: number; pro: string; requestId: number; category: string; budget: number | null }
  | { t: number; seq: number; kind: "decide"; requestId: number; client: string; force?: boolean }
  | { t: number; seq: number; kind: "schedule" | "start" | "done"; jobId: number; pro: string; force?: boolean }
  | { t: number; seq: number; kind: "review"; jobId: number; client: string };

type NewEvent = Event extends infer E ? (E extends unknown ? Omit<E, "seq"> : never) : never;

const phoneFor = (i: number) => `602-555-01${String(i).padStart(2, "0")}`;
const emailFor = (first: string, last: string) => `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "") + "@" + CONTACT_DOMAIN;

/** Static reference data and accounts. Runs as the database owner. */
async function seedReference(db: Db): Promise<void> {
  const fixture = JSON.parse(readFileSync(join(process.cwd(), "fixtures", "zip-centroids.json"), "utf8")) as ZipFixture;
  for (const z of fixture.zips) {
    await db.query("insert into zip_centroids (zip, place, state, lat, lng) values ($1, $2, $3, $4, $5)", [z.zip, z.place, z.state, z.lat, z.lng]);
  }
  for (const [i, c] of CATEGORIES.entries()) {
    await db.query(
      "insert into categories (slug, name, serves_label, keywords, lead_fee_credits, questions, sort) values ($1, $2, $3, $4, $5, $6, $7)",
      [c.slug, c.name, c.serves_label, c.keywords, c.lead_fee_credits, JSON.stringify(c.questions), i],
    );
  }
  let phone = 0;
  const people: { id: string; role: string; first: string; last: string; display: string; zip: string }[] = [
    ...CLIENTS.map((c) => ({ id: c.id, role: "client", first: c.first, last: c.last, display: `${c.first} ${c.last[0]}.`, zip: c.zip })),
    ...PROS.map((p) => {
      const [first = "", last = ""] = p.owner.split(" ");
      return { id: p.id, role: "pro", first, last, display: p.business, zip: p.zip };
    }),
    { id: ADMIN.id, role: "admin", first: ADMIN.first, last: ADMIN.last, display: `${ADMIN.first} ${ADMIN.last[0]}. (Ops)`, zip: ADMIN.zip },
  ];
  for (const u of people) {
    await db.query("insert into users (id, role, first_name, last_initial, display_name, zip) values ($1, $2, $3, $4, $5, $6)", [
      u.id, u.role, u.first, u.last.slice(0, 1), u.display, u.zip,
    ]);
    if (phone === 47) phone++; // 0147 belongs to the hero pro
    const tel = u.id === HERO.pro ? "602-555-0147" : phoneFor(phone++);
    await db.query("insert into user_contacts (user_id, full_name, email, phone) values ($1, $2, $3, $4)", [
      u.id, `${u.first} ${u.last}`, emailFor(u.first, u.last), tel,
    ]);
  }
  for (const p of PROS) {
    await db.query(
      `insert into pro_profiles (user_id, business_name, owner_name, home_zip, radius_mi, category_slugs, verified, reply_minutes,
         next_available_days, years_in_business, bio)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [p.id, p.business, p.owner, p.zip, p.radius, p.cats, p.verified, p.reply, p.availDays, p.years, p.bio],
    );
  }
  for (const pr of PROMOTIONS) {
    await db.query("insert into promotions (pro_id, category_slug, status) values ($1, $2, $3)", [pr.pro, pr.cat, pr.status]);
  }
}

function roundTo5(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5);
}

/**
 * Seeds the database: reference data, then eight weeks of synthetic marketplace history replayed in time
 * order through the same services the app uses (as each person, under row-level security), so leads,
 * quotes, jobs, payments, reviews, notifications and the ledger all agree. Fixed seed: same counts every run.
 */
export async function seed(db: Db, opts: { anchor?: Date } = {}): Promise<SeedSummary> {
  const started = Date.now();
  const anchor = opts.anchor ?? new Date(Math.floor(Date.now() / HOUR) * HOUR);
  const end = anchor.getTime() - HOUR;
  const start = end - HISTORY_DAYS * DAY;
  const rng = new Rng(SEED);
  await seedReference(db);

  for (const p of PROS) await asUser(db, p.id, (tx) => tx.query("select buy_credits(100, $1)", [new Date(start - DAY)]));

  const queue: Event[] = [];
  let seq = 0;
  const push = (e: NewEvent) => {
    if (e.t < end) queue.push({ ...e, seq: seq++ } as Event);
  };

  const randomClients = CLIENTS.filter((c) => c.id !== HERO.client);
  for (const [week, count] of WEEKLY_REQUESTS.entries()) {
    for (let i = 0; i < count; i++) {
      const t = start + week * 7 * DAY + rng.int(0, 6) * DAY + rng.int(7, 20) * HOUR + rng.int(0, 59) * 60_000;
      push({ t, kind: "create", client: rng.pick(randomClients).id, category: rng.weighted(CATEGORY_WEIGHTS) });
    }
  }
  // The hero client's one earlier job, so her own pages are not empty.
  push({ t: start + 20 * DAY + 10 * HOUR, kind: "create", client: HERO.client, category: "house-cleaning", forceHire: true });

  const forced = new Set<number>();
  let processed = 0;
  while (queue.length) {
    queue.sort((a, b) => a.t - b.t || a.seq - b.seq);
    const e = queue.shift()!;
    const now = new Date(e.t);
    processed++;

    if (e.kind === "create") {
      const tpl = rng.pick(JOB_TEXT[e.category] ?? []);
      const cat = CATEGORY_BY_SLUG.get(e.category)!;
      const client = CLIENTS.find((c) => c.id === e.client)!;
      const base = BASE_PRICE_USD[e.category] ?? 200;
      const budget = rng.chance(0.7) ? roundTo5(base * rng.between(0.8, 1.4)) : null;
      const timing = rng.weighted<Timing>([["asap", 3], ["this_week", 4], ["next_two_weeks", 2], ["flexible", 2]]);
      const answers = cat.questions.filter(() => rng.chance(0.5)).map((q) => ({ question_id: q.id, answer: rng.pick(q.options ?? ["Not sure"]) }));
      const { id, matches } = await asUser(db, e.client, (tx) =>
        createRequest(tx, e.client, {
          category_slug: e.category, zip: client.zip, timing, budget_usd: budget, title: tpl.title,
          details: tpl.note, note: `${tpl.note} ${client.zip}.`, answers,
        }, now),
      );
      if (e.forceHire) forced.add(id);
      const leads = await rows<{ id: number; pro_id: string; rank: number }>(db, "select id, pro_id, rank from leads where request_id = $1 order by rank", [id]);
      let lastQuote = 0;
      for (const lead of leads) {
        const pro = PROS.find((p) => p.id === lead.pro_id)!;
        const p = e.forceHire && lead.rank === 1 ? 1 : [0.85, 0.75, 0.65, 0.6][lead.rank - 1] ?? 0.5;
        if (!rng.chance(p)) continue;
        const t = e.t + pro.reply * rng.between(0.4, 2.2) * 60_000;
        lastQuote = Math.max(lastQuote, t);
        push({ t, kind: "quote", leadId: lead.id, pro: pro.id, requestId: id, category: e.category, budget });
      }
      if (lastQuote && matches.length) push({ t: lastQuote + rng.between(2, 30) * HOUR, kind: "decide", requestId: id, client: e.client, force: e.forceHire });
    } else if (e.kind === "quote") {
      const fee = CATEGORY_BY_SLUG.get(e.category)!.lead_fee_credits;
      await asUser(db, e.pro, async (tx) => {
        const status = await one<{ status: string }>(tx, "select status from service_requests where id = $1", [e.requestId]);
        if (status?.status !== "open") return;
        const credits = await one<{ credits: number }>(tx, "select credits from pro_profiles where user_id = $1", [e.pro]);
        if ((credits?.credits ?? 0) < fee) await tx.query("select buy_credits(100, $1)", [now]);
        const base = e.budget ?? BASE_PRICE_USD[e.category] ?? 200;
        const own = await one<{ phone: string }>(tx, "select phone from user_contacts where user_id = $1", [e.pro]);
        const message = rng.pick(QUOTE_MESSAGES).replace("{phone}", own?.phone ?? "");
        await sendQuote(tx, e.pro, {
          lead_id: e.leadId,
          price_usd: roundTo5(base * rng.between(0.75, 1.25)),
          price_type: rng.chance(0.7) ? "fixed" : "estimate",
          available_at: new Date(e.t + rng.int(1, 4) * DAY),
          message,
        }, now);
      });
    } else if (e.kind === "decide") {
      if (!e.force && !rng.chance(0.74)) continue;
      const quotes = await rows<{ id: number; price_cents: number; pro_id: string; review_count: number; rating_sum: number }>(
        db,
        `select q.id, q.price_cents, q.pro_id, p.review_count, p.rating_sum
           from quotes q join pro_profiles p on p.user_id = q.pro_id where q.request_id = $1 order by q.id`,
        [e.requestId],
      );
      if (!quotes.length) continue;
      const scored = quotes.map((q) => ({
        q,
        s: (q.review_count ? q.rating_sum / q.review_count : 4) - q.price_cents / 100 / 400 + rng.between(0, 0.6),
      }));
      scored.sort((a, b) => b.s - a.s);
      const chosen = scored[0]!.q;
      const { jobId } = await asUser(db, e.client, (tx) => hireQuote(tx, e.client, chosen.id, now));
      push({ t: e.t + rng.between(1, 12) * HOUR, kind: "schedule", jobId, pro: chosen.pro_id, force: forced.has(e.requestId) });
    } else if (e.kind === "schedule") {
      const at = new Date(Math.floor((e.t + rng.int(1, 4) * DAY) / DAY) * DAY + rng.int(15, 23) * HOUR);
      await asUser(db, e.pro, (tx) => advanceJob(tx, e.pro, e.jobId, { action: "schedule", scheduled_for: at }, now));
      push({ t: at.getTime(), kind: "start", jobId: e.jobId, pro: e.pro, force: e.force });
    } else if (e.kind === "start") {
      await asUser(db, e.pro, (tx) => advanceJob(tx, e.pro, e.jobId, { action: "start" }, now));
      push({ t: e.t + rng.between(1, 6) * HOUR, kind: "done", jobId: e.jobId, pro: e.pro, force: e.force });
    } else if (e.kind === "done") {
      await asUser(db, e.pro, (tx) => advanceJob(tx, e.pro, e.jobId, { action: "done", note: rng.pick(DONE_NOTES) }, now));
      const client = (await one<{ client_id: string }>(db, "select client_id from jobs where id = $1", [e.jobId]))!.client_id;
      if (e.force || rng.chance(0.78)) push({ t: e.t + rng.between(3, 60) * HOUR, kind: "review", jobId: e.jobId, client });
    } else if (e.kind === "review") {
      const rating = rng.weighted([[5, 55], [4, 30], [3, 9], [2, 4], [1, 2]] as const);
      await asUser(db, e.client, (tx) => leaveReview(tx, e.client, e.jobId, { rating, body: rng.pick(REVIEW_TEXT[rating] ?? [""]) }, now));
    }
  }

  await topUpImportedReviews(db, rng, start);
  for (const p of PROS) {
    const c = await one<{ credits: number }>(db, "select credits from pro_profiles where user_id = $1", [p.id]);
    const missing = p.credits - (c?.credits ?? 0);
    if (missing > 0) await asUser(db, p.id, (tx) => tx.query("select buy_credits($1, $2)", [missing, new Date(end - DAY)]));
  }
  // History notifications older than half a day count as read, so the bell shows only fresh ones.
  await db.query("update notifications set read_at = created_at + interval '1 hour' where created_at < $1", [new Date(end - 12 * HOUR)]);

  const count = async (sql: string) => (await one<{ n: number }>(db, sql))?.n ?? 0;
  void processed;
  return {
    requests: await count("select count(*)::int as n from service_requests"),
    quotes: await count("select count(*)::int as n from quotes"),
    jobs: await count("select count(*)::int as n from jobs"),
    done: await count("select count(*)::int as n from jobs where status = 'done'"),
    reviews: await count("select count(*)::int as n from reviews"),
    ms: Date.now() - started,
  };
}

/**
 * Reviews from before the eight-week window (synthetic, labelled as imported), sized so each pro starts
 * the demo at its listed review count and average. Owner-only: clients can't create these.
 */
async function topUpImportedReviews(db: Db, rng: Rng, historyStart: number): Promise<void> {
  for (const p of PROS) {
    const have = await one<{ n: number; total: number }>(
      db,
      "select count(*)::int as n, coalesce(sum(rating), 0)::int as total from reviews where pro_id = $1",
      [p.id],
    );
    const n = p.reviews - (have?.n ?? 0);
    if (n <= 0) continue;
    const targetSum = Math.round(p.reviews * p.avg) - (have?.total ?? 0);
    const sum = Math.max(n, Math.min(5 * n, targetSum));
    const ratings = Array.from({ length: n }, () => 5);
    let excess = 5 * n - sum;
    while (excess > 0) {
      const i = rng.int(0, n - 1);
      if (ratings[i]! > 3 || (excess > n && ratings[i]! > 1)) {
        ratings[i]! -= 1;
        excess -= 1;
      }
    }
    for (const rating of ratings) {
      const at = new Date(historyStart - rng.int(1, 700) * DAY);
      await db.query(
        `insert into reviews (pro_id, rating, body, author_label, source, created_at) values ($1, $2, $3, $4, 'imported', $5)`,
        [p.id, rating, rng.pick(REVIEW_TEXT[rating] ?? [""]), rng.pick(REVIEW_AUTHORS), at],
      );
    }
  }
}

const DATA_TABLES = [
  "notifications", "reviews", "ledger_entries", "ledger_transactions", "job_events", "jobs", "quotes", "leads",
  "service_requests", "intake_runs", "promotions", "pro_profiles", "user_contacts", "users", "categories", "zip_centroids",
];

/** Empties every data table and seeds again (the Reset demo control and npm run reset). */
export async function resetAndSeed(db: Db, opts: { anchor?: Date } = {}): Promise<SeedSummary> {
  await db.exec(`truncate ${DATA_TABLES.join(", ")} restart identity cascade`);
  return seed(db, opts);
}

export async function isSeeded(db: Db): Promise<boolean> {
  return ((await one<{ n: number }>(db, "select count(*)::int as n from users"))?.n ?? 0) > 0;
}
