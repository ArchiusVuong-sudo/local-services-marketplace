import { z } from "zod";
import type { Queryable } from "@/lib/db/client";
import { must, one, NotFoundError, RuleError, toRuleError } from "@/lib/db/sql";
import { assertMove, JOB_STATUS_LABEL } from "@/lib/domain/lifecycle";
import { formatUsd, payoutCents, releaseLines } from "@/lib/domain/money";
import type { JobStatus } from "@/lib/domain/types";
import { postTransaction } from "./ledger";
import { notify } from "./notifications";

export const JobActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("schedule"), scheduled_for: z.coerce.date() }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("done"), note: z.string().trim().max(500).default("") }),
]);
export type JobAction = z.input<typeof JobActionSchema>;

const TARGET: Record<"schedule" | "start" | "done", JobStatus> = { schedule: "scheduled", start: "in_progress", done: "done" };

/** The pro moves the job one step forward. Done releases the payout minus the platform fee. */
export async function advanceJob(q: Queryable, proId: string, jobId: number, raw: JobAction, now: Date = new Date()) {
  const action = JobActionSchema.parse(raw);
  const job = await one<{ id: number; status: JobStatus; client_id: string; pro_id: string; price_cents: number; request_id: number }>(
    q,
    "select id, status, client_id, pro_id, price_cents, request_id from jobs where id = $1",
    [jobId],
  );
  if (!job) throw new NotFoundError();
  if (job.pro_id !== proId) throw new RuleError("Only the hired pro can update this job");
  const to = TARGET[action.action];
  try {
    assertMove(job.status, to);
  } catch (e) {
    throw new RuleError((e as Error).message);
  }

  try {
    if (action.action === "schedule") {
      await q.query("update jobs set status = 'scheduled', scheduled_for = $2 where id = $1", [jobId, action.scheduled_for]);
    } else if (action.action === "start") {
      await q.query("update jobs set status = 'in_progress' where id = $1", [jobId]);
    } else {
      await q.query("update jobs set status = 'done', done_at = $2 where id = $1", [jobId, now]);
    }
  } catch (e) {
    throw toRuleError(e);
  }

  const note =
    action.action === "schedule"
      ? `Visit set for ${action.scheduled_for.toISOString()}`
      : action.action === "done"
        ? action.note
        : "";
  await q.query("insert into job_events (job_id, actor_id, kind, note, created_at) values ($1, $2, $3, $4, $5)", [
    jobId, proId, to, note, now,
  ]);
  const req = await must<{ title: string }>(q, "select title from service_requests where id = $1", [job.request_id]);
  await notify(q, job.client_id, {
    kind: `job_${to}`,
    title: `Job ${JOB_STATUS_LABEL[to].toLowerCase()}: ${req.title}`,
    body: to === "done" ? "Leave a review to help other clients." : note.startsWith("Visit") ? "Your pro set the visit time." : "",
    href: `/jobs/${jobId}`,
  }, now);

  if (to === "done") {
    await postTransaction(q, {
      kind: "payout_release",
      job_id: jobId,
      pro_id: proId,
      client_id: job.client_id,
      memo: `Payout for job #${jobId} (test mode)`,
      lines: releaseLines(job.price_cents),
      now,
    });
    await q.query("insert into job_events (job_id, actor_id, kind, note, created_at) values ($1, $2, 'payout_released', $3, $4)", [
      jobId, proId, `${formatUsd(payoutCents(job.price_cents))} paid out to the pro, ${formatUsd(job.price_cents - payoutCents(job.price_cents))} platform fee`, now,
    ]);
    await notify(q, proId, {
      kind: "payout",
      title: `Payout released: ${formatUsd(payoutCents(job.price_cents))}`,
      body: `${req.title}, after the 10% platform fee.`,
      href: `/jobs/${jobId}`,
    }, now);
  }
  return { status: to };
}
