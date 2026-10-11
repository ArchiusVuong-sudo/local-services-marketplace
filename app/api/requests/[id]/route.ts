import { asUser } from "@/lib/db/scoped";
import { NotFoundError } from "@/lib/db/sql";
import { intParam, route } from "@/lib/server/http";
import { jobForRequest, requestLeads, requestQuotes, requestView } from "@/lib/services/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ db, persona }, { id }) => {
  const requestId = intParam(id);
  return asUser(db, persona.id, async (tx) => {
    const request = await requestView(tx, requestId);
    if (!request) throw new NotFoundError();
    return { request, leads: await requestLeads(tx, requestId), quotes: await requestQuotes(tx, requestId), job: await jobForRequest(tx, requestId) };
  });
});
