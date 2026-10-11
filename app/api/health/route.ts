import { getDb } from "@/lib/db";
import { intakeMode, intakeModel } from "@/lib/intake/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await getDb();
  return Response.json({ ok: true, intake: intakeMode(), model: intakeModel() });
}
