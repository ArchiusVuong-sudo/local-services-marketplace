import type { Db } from "@/lib/db/client";
import { asUser } from "@/lib/db/scoped";
import { one, rows } from "@/lib/db/sql";
import { sendQuote } from "./quotes";

const REPLIES = [
  { factor: 1.1, type: "fixed" as const, days: 2, message: "Can replace the drain valve and test the relief valve. Price includes parts." },
  { factor: 0.94, type: "estimate" as const, days: 3, message: "Estimate until I see the unit. Most leaks like this are the valve or a fitting." },
  { factor: 1.16, type: "fixed" as const, days: 2, message: "Fixed price for diagnosis and repair, same-week visit." },
];

/**
 * Demo control, labelled as such in the UI: the other matched pros on the newest open request reply with quotes,
 * each sent as that pro through the normal quote service (credits, masking, notifications all apply).
 */
export async function simulateReplies(db: Db, now: Date = new Date()): Promise<{ requestId: number | null; quotes: number }> {
  const req = await one<{ id: number; budget_cents: number | null }>(
    db,
    "select id, budget_cents from service_requests where status = 'open' order by created_at desc, id desc limit 1",
  );
  if (!req) return { requestId: null, quotes: 0 };
  const open = await rows<{ id: number; pro_id: string }>(
    db,
    "select id, pro_id from leads where request_id = $1 and status in ('new', 'viewed') order by rank",
    [req.id],
  );
  const base = (req.budget_cents ?? 40_000) / 100;
  let sent = 0;
  for (const [i, lead] of open.entries()) {
    const r = REPLIES[i % REPLIES.length]!;
    try {
      await asUser(db, lead.pro_id, async (tx) => {
        const credits = await one<{ credits: number }>(tx, "select credits from pro_profiles where user_id = $1", [lead.pro_id]);
        const fee = await one<{ fee_credits: number }>(tx, "select fee_credits from leads where id = $1", [lead.id]);
        if ((credits?.credits ?? 0) < (fee?.fee_credits ?? 0)) await tx.query("select buy_credits(100, $1)", [now]);
        await sendQuote(tx, lead.pro_id, {
          lead_id: lead.id,
          price_usd: Math.max(25, Math.round((base * r.factor) / 5) * 5),
          price_type: r.type,
          available_at: new Date(now.getTime() + r.days * 86_400_000),
          message: r.message,
        }, now);
      });
      sent++;
    } catch {
      // A pro that can't quote (lead closed meanwhile) is skipped.
    }
  }
  return { requestId: req.id, quotes: sent };
}
