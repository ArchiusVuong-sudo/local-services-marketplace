import { asUser } from "@/lib/db/scoped";
import { body, intParam, requireRole, route } from "@/lib/server/http";
import { leaveReview, ReviewInputSchema } from "@/lib/services/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route<{ id: string }>(async ({ db, persona, req }, { id }) => {
  requireRole(persona, "client");
  const input = ReviewInputSchema.parse(await body(req));
  return asUser(db, persona.id, (tx) => leaveReview(tx, persona.id, intParam(id), input));
});
