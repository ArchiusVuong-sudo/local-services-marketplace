import type { Db } from "@/lib/db/client";
import { asUser } from "@/lib/db/scoped";
import { one } from "@/lib/db/sql";
import { HERO_NOTE } from "@/lib/intake/samples";
import { replayProvider } from "@/lib/intake/providers";
import { loadFixtures } from "@/lib/intake/fixtures";
import { runIntake } from "@/lib/services/intake";
import { createRequest } from "@/lib/services/requests";
import { sendQuote } from "@/lib/services/quotes";

export const MAYA = "client_maya";
export const JORDAN = "client_jordan";
export const PIPEWRIGHT = "pro_pipewright";
export const BRIGHTLINE = "pro_brightline";
export const ADMIN = "admin_ops";

/** The recorded hero note, read in replay mode, sent as Maya's request. */
export async function heroRequest(db: Db): Promise<{ requestId: number; intakeId: number }> {
  const run = await runIntake(db, MAYA, HERO_NOTE, { provider: replayProvider(loadFixtures(), 0) });
  const { id } = await asUser(db, MAYA, (tx) =>
    createRequest(tx, MAYA, {
      ...run.output,
      zip: run.output.zip ?? "85016",
      timing: run.output.timing ?? "this_week",
      answers: [...run.output.answers, { question_id: "fuel", answer: "Gas" }],
      note: HERO_NOTE,
      intake_run_id: run.id,
    }),
  );
  return { requestId: id, intakeId: run.id };
}

export async function leadFor(db: Db, requestId: number, proId: string): Promise<number> {
  const l = await one<{ id: number }>(db, "select id from leads where request_id = $1 and pro_id = $2", [requestId, proId]);
  if (!l) throw new Error(`no lead for ${proId}`);
  return l.id;
}

export async function heroQuote(db: Db, requestId: number): Promise<{ leadId: number; quoteId: number }> {
  const leadId = await leadFor(db, requestId, PIPEWRIGHT);
  const q = await asUser(db, PIPEWRIGHT, (tx) =>
    sendQuote(tx, PIPEWRIGHT, {
      lead_id: leadId,
      price_usd: 420,
      price_type: "fixed",
      available_at: new Date(Date.now() + 2 * 86_400_000),
      message: "Can swap the valve and flush the tank, call me at 602-555-0147",
    }),
  );
  return { leadId, quoteId: q.id };
}
