import { asUser } from "@/lib/db/scoped";
import { route } from "@/lib/server/http";
import { listNotifications, markAllRead } from "@/lib/services/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async ({ db, persona }) => asUser(db, persona.id, (tx) => listNotifications(tx)));

export const POST = route(async ({ db, persona }) => {
  await asUser(db, persona.id, (tx) => markAllRead(tx));
  return { ok: true };
});
