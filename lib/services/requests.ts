import { z } from "zod";
import type { Queryable } from "@/lib/db/client";
import { must, one, RuleError } from "@/lib/db/sql";
import { matchPros, type Match } from "@/lib/domain/matching";
import { TIMINGS } from "@/lib/intake/schema";
import { listCategories, matchPool, zipIndex } from "./catalog";
import { notify } from "./notifications";

export const RequestInputSchema = z.object({
  category_slug: z.string().min(1),
  zip: z.string().regex(/^\d{5}$/, "Enter a 5-digit ZIP code"),
  timing: z.enum(TIMINGS),
  budget_usd: z.number().int().positive().max(100_000).nullable(),
  title: z.string().trim().min(3).max(80),
  details: z.string().trim().max(600).default(""),
  answers: z.array(z.object({ question_id: z.string(), answer: z.string().trim().min(1).max(80) })).max(6).default([]),
  note: z.string().max(1000).default(""),
  intake_run_id: z.number().int().positive().nullable().default(null),
});

export type RequestInput = z.input<typeof RequestInputSchema>;

/** Saves the request, picks the best-fit pros and sends each one a lead with its reasons. */
export async function createRequest(
  q: Queryable,
  clientId: string,
  raw: RequestInput,
  now: Date = new Date(),
): Promise<{ id: number; matches: Match[] }> {
  const input = RequestInputSchema.parse(raw);
  const categories = await listCategories(q);
  const category = categories.find((c) => c.slug === input.category_slug);
  if (!category) throw new RuleError("Pick a category");
  const zips = await zipIndex(q);
  if (!zips.has(input.zip)) throw new RuleError(`We don't cover ZIP ${input.zip} yet. This launch covers the Phoenix area.`);
  const known = new Set(category.questions.map((x) => x.id));
  const answers = input.answers.filter((a) => known.has(a.question_id));

  const req = await must<{ id: number }>(
    q,
    `insert into service_requests (client_id, category_slug, zip, timing, budget_cents, title, details, answers, note, intake_run_id, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
    [
      clientId, category.slug, input.zip, input.timing, input.budget_usd === null ? null : input.budget_usd * 100,
      input.title, input.details, JSON.stringify(answers), input.note, input.intake_run_id, now,
    ],
  );

  const pool = await matchPool(q, category.slug);
  const matches = matchPros({
    request: { category_slug: category.slug, zip: input.zip, timing: input.timing },
    category,
    pros: pool.pros,
    promotions: pool.promotions,
    zips,
  });

  const client = await must<{ display_name: string }>(q, "select display_name from users where id = $1", [clientId]);
  for (const m of matches) {
    const lead = await must<{ id: number }>(
      q,
      `insert into leads (request_id, pro_id, rank, score, reasons, sponsored, promotion_id, fee_credits, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [req.id, m.pro_id, m.rank, m.score, JSON.stringify(m.reasons), m.sponsored, m.promotion_id, category.lead_fee_credits, now],
    );
    await notify(q, m.pro_id, {
      kind: "lead",
      title: `New lead: ${category.name}`,
      body: `${client.display_name}, ${input.zip}. Lead fee ${category.lead_fee_credits} credits if you quote.`,
      href: `/pro/leads/${lead.id}`,
    }, now);
  }
  await notify(q, clientId, {
    kind: "request_sent",
    title: matches.length ? `Sent to ${matches.length} pros` : "No pros available yet",
    body: matches.length ? "You'll get a notification for each quote." : "No pro in range serves this category right now.",
    href: `/requests/${req.id}`,
  }, now);
  return { id: req.id, matches };
}

export async function requestOwner(q: Queryable, requestId: number): Promise<string | null> {
  return (await one<{ client_id: string }>(q, "select client_id from service_requests where id = $1", [requestId]))?.client_id ?? null;
}
