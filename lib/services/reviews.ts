import { z } from "zod";
import type { Queryable } from "@/lib/db/client";
import { must, one, NotFoundError, RuleError, toRuleError } from "@/lib/db/sql";
import { notify } from "./notifications";

export const ReviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(1000).default(""),
});

/** Only the client of a done job can review it, once. The database enforces both. */
export async function leaveReview(q: Queryable, clientId: string, jobId: number, raw: z.input<typeof ReviewInputSchema>, now: Date = new Date()) {
  const input = ReviewInputSchema.parse(raw);
  const job = await one<{ id: number; pro_id: string; status: string; client_id: string }>(
    q,
    "select id, pro_id, status, client_id from jobs where id = $1",
    [jobId],
  );
  if (!job) throw new NotFoundError();
  if (job.status !== "done") throw new RuleError("You can review the pro once the job is done");
  const author = await must<{ display_name: string }>(q, "select display_name from users where id = $1", [clientId]);
  let id: number;
  try {
    id = (
      await must<{ id: number }>(
        q,
        `insert into reviews (job_id, client_id, pro_id, rating, body, author_label, source, created_at)
         values ($1, $2, $3, $4, $5, $6, 'platform', $7) returning id`,
        [jobId, clientId, job.pro_id, input.rating, input.body, author.display_name, now],
      )
    ).id;
  } catch (e) {
    throw toRuleError(e);
  }
  await q.query("insert into job_events (job_id, actor_id, kind, note, created_at) values ($1, $2, 'reviewed', $3, $4)", [
    jobId, clientId, `${input.rating} stars`, now,
  ]);
  await notify(q, job.pro_id, { kind: "review", title: `New ${input.rating}-star review`, body: input.body.slice(0, 120), href: `/pros/${job.pro_id}` }, now);
  return { id };
}
