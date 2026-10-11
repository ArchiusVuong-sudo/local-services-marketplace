import { z } from "zod";
import type { Queryable } from "@/lib/db/client";
import { must, one, NotFoundError, RuleError, toRuleError } from "@/lib/db/sql";
import { maskContactDetails } from "@/lib/domain/masking";
import { formatUsd } from "@/lib/domain/money";
import { notify } from "./notifications";

export const QuoteInputSchema = z.object({
  lead_id: z.number().int().positive(),
  price_usd: z.number().positive().max(100_000),
  price_type: z.enum(["fixed", "estimate"]),
  available_at: z.coerce.date(),
  message: z.string().trim().min(1, "Add a short message").max(1000),
});

export type QuoteInput = z.input<typeof QuoteInputSchema>;

/** Sends a quote. The database takes the lead fee from the pro's credits in the same transaction. */
export async function sendQuote(q: Queryable, proId: string, raw: QuoteInput, now: Date = new Date()) {
  const input = QuoteInputSchema.parse(raw);
  const lead = await one<{ id: number; request_id: number }>(q, "select id, request_id from leads where id = $1 and pro_id = $2", [input.lead_id, proId]);
  if (!lead) throw new NotFoundError();
  const masked = maskContactDetails(input.message);
  let quote: { id: number; fee_credits: number };
  try {
    quote = await must(
      q,
      `insert into quotes (lead_id, request_id, pro_id, price_cents, price_type, available_at, message, message_original, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id, fee_credits`,
      [lead.id, lead.request_id, proId, Math.round(input.price_usd * 100), input.price_type, input.available_at, masked.text, input.message, now],
    );
  } catch (e) {
    throw toRuleError(e);
  }
  const req = await must<{ client_id: string; title: string }>(q, "select client_id, title from service_requests where id = $1", [lead.request_id]);
  const pro = await must<{ display_name: string }>(q, "select display_name from users where id = $1", [proId]);
  await notify(q, req.client_id, {
    kind: "quote",
    title: `New quote from ${pro.display_name}`,
    body: `${formatUsd(Math.round(input.price_usd * 100))} ${input.price_type} for ${req.title}`,
    href: `/requests/${lead.request_id}`,
  }, now);
  return { id: quote.id, fee_credits: quote.fee_credits, masked };
}

export async function markLeadViewed(q: Queryable, leadId: number): Promise<void> {
  await q.query("update leads set status = 'viewed' where id = $1 and status = 'new' and pro_id = app_uid()", [leadId]);
}

export function assertPositive(n: number): void {
  if (!(n > 0)) throw new RuleError("Must be positive");
}
