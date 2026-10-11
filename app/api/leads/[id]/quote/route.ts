import { asUser } from "@/lib/db/scoped";
import { body, intParam, requireRole, route } from "@/lib/server/http";
import { QuoteInputSchema, sendQuote } from "@/lib/services/quotes";
import { proCredits } from "@/lib/services/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route<{ id: string }>(async ({ db, persona, req }, { id }) => {
  requireRole(persona, "pro");
  const input = QuoteInputSchema.parse({ ...(await body(req) as object), lead_id: intParam(id) });
  return asUser(db, persona.id, async (tx) => {
    const r = await sendQuote(tx, persona.id, input);
    return { id: r.id, fee_credits: r.fee_credits, message: r.masked.text, credits: await proCredits(tx, persona.id) };
  });
});
