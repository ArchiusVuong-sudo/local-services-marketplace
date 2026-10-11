import { asUser } from "@/lib/db/scoped";
import { intParam, requireRole, route } from "@/lib/server/http";
import { hireQuote } from "@/lib/services/hire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route<{ id: string }>(async ({ db, persona }, { id }) => {
  requireRole(persona, "client");
  return asUser(db, persona.id, (tx) => hireQuote(tx, persona.id, intParam(id)));
});
