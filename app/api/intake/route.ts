import { z } from "zod";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { PERSONA_COOKIE, personaById } from "@/lib/server/session";
import { errorResponse } from "@/lib/server/http";
import { runIntake } from "@/lib/services/intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ note: z.string().trim().min(8, "Describe the job in a sentence or two").max(1000) });

/** Streams progress steps as NDJSON lines, then the result line. */
export async function POST(req: NextRequest) {
  let note: string;
  try {
    note = Body.parse(await req.json()).note;
  } catch (e) {
    return errorResponse(e);
  }
  const db = await getDb();
  const persona = await personaById(req.cookies.get(PERSONA_COOKIE)?.value);
  if (persona.role !== "client") return Response.json({ error: "Switch to a client account to post a job" }, { status: 409 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await runIntake(db, persona.id, note, { onStep: (step) => send({ type: "step", step }) });
        send({ type: "result", result });
      } catch (e) {
        console.error(e);
        send({ type: "error", error: "Could not read the note. Please try again." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
