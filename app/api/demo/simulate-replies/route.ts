import { route } from "@/lib/server/http";
import { simulateReplies } from "@/lib/services/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Demo control: the other matched pros on the newest open request send quotes. */
export const POST = route(async ({ db }) => simulateReplies(db));
