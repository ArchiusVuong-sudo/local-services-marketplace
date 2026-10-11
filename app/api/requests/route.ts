import { asUser } from "@/lib/db/scoped";
import { body, requireRole, route } from "@/lib/server/http";
import { createRequest, RequestInputSchema } from "@/lib/services/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async ({ db, persona, req }) => {
  requireRole(persona, "client");
  const input = RequestInputSchema.parse(await body(req));
  const { id, matches } = await asUser(db, persona.id, (tx) => createRequest(tx, persona.id, input));
  return { id, leads: matches.length };
});
