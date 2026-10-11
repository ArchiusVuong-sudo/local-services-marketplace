import { z } from "zod";
import { asUser } from "@/lib/db/scoped";
import { body, intParam, requireRole, route } from "@/lib/server/http";
import { setPromotionStatus } from "@/lib/services/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route<{ id: string }>(async ({ db, persona, req }, { id }) => {
  requireRole(persona, "admin");
  const { status } = z.object({ status: z.enum(["active", "paused"]) }).parse(await body(req));
  await asUser(db, persona.id, (tx) => setPromotionStatus(tx, intParam(id), status));
  return { ok: true, status };
});
