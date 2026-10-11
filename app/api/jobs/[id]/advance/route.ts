import { asUser } from "@/lib/db/scoped";
import { body, intParam, requireRole, route } from "@/lib/server/http";
import { advanceJob, JobActionSchema } from "@/lib/services/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route<{ id: string }>(async ({ db, persona, req }, { id }) => {
  requireRole(persona, "pro");
  const action = JobActionSchema.parse(await body(req));
  return asUser(db, persona.id, (tx) => advanceJob(tx, persona.id, intParam(id), action));
});
