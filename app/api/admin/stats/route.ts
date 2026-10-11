import { asUser } from "@/lib/db/scoped";
import { requireRole, route } from "@/lib/server/http";
import { dashboardStats } from "@/lib/services/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async ({ db, persona }) => {
  requireRole(persona, "admin");
  return asUser(db, persona.id, (tx) => dashboardStats(tx));
});
