import type { Queryable } from "./client";

export async function rows<T>(q: Queryable, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await q.query<T>(sql, params)).rows;
}

export async function one<T>(q: Queryable, sql: string, params: unknown[] = []): Promise<T | null> {
  return (await q.query<T>(sql, params)).rows[0] ?? null;
}

export async function must<T>(q: Queryable, sql: string, params: unknown[] = []): Promise<T> {
  const row = await one<T>(q, sql, params);
  if (!row) throw new NotFoundError();
  return row;
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** A rule of the marketplace was broken (bad input, wrong state). Shown to the user as is. */
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}

/** Postgres raised a rule (P0001) or row-level security refused the row. */
export function toRuleError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/row-level security|permission denied/i.test(msg)) return new RuleError("Not allowed for this account");
  if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P0002") return new NotFoundError();
  if (e instanceof Error && "code" in e && ["P0001", "23505", "23514"].includes(String((e as { code?: string }).code))) {
    if (/duplicate key.*reviews/i.test(msg)) return new RuleError("This job already has a review");
    return new RuleError(msg);
  }
  return e instanceof Error ? e : new Error(msg);
}
