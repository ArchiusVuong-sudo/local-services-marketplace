import { route } from "@/lib/server/http";
import { resetAndSeed } from "@/lib/seed/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Demo control: wipe and re-seed the synthetic data. */
export const POST = route(async ({ db }) => resetAndSeed(db));
