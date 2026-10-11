import type { Queryable } from "@/lib/db/client";
import { must } from "@/lib/db/sql";
import { isBalanced, type LedgerLine } from "@/lib/domain/money";

export type PostInput = {
  kind: "payment_hold" | "payout_release";
  job_id: number;
  pro_id: string;
  client_id: string;
  memo: string;
  lines: LedgerLine[];
  now: Date;
};

/** Books one double-entry transaction. Checked here and again by a deferred database trigger at commit. */
export async function postTransaction(q: Queryable, input: PostInput): Promise<number> {
  if (!isBalanced(input.lines)) throw new Error("Ledger transaction does not balance");
  const tx = await must<{ id: number }>(
    q,
    `insert into ledger_transactions (kind, job_id, pro_id, client_id, memo, created_at)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [input.kind, input.job_id, input.pro_id, input.client_id, input.memo, input.now],
  );
  for (const line of input.lines) {
    await q.query("insert into ledger_entries (transaction_id, account, amount_cents) values ($1, $2, $3)", [
      tx.id,
      line.account,
      line.amount_cents,
    ]);
  }
  return tx.id;
}
