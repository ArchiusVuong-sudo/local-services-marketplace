import { asUser } from "@/lib/db/scoped";
import { NotFoundError } from "@/lib/db/sql";
import { intParam, route } from "@/lib/server/http";
import { jobEvents, jobLedger, jobReview, jobView } from "@/lib/services/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ db, persona }, { id }) => {
  const jobId = intParam(id);
  return asUser(db, persona.id, async (tx) => {
    const job = await jobView(tx, jobId);
    if (!job) throw new NotFoundError();
    return { job, events: await jobEvents(tx, jobId), ledger: await jobLedger(tx, jobId), review: await jobReview(tx, jobId) };
  });
});
