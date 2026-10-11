import { openDb, type Db } from "@/lib/db/client";
import { seed, type SeedSummary } from "@/lib/seed/seed";

export const ANCHOR = new Date("2026-10-11T00:00:00Z");

/** A fresh in-memory Postgres with the schema, policies and the seeded synthetic history. */
export async function seededDb(): Promise<{ db: Db; summary: SeedSummary }> {
  const db = await openDb();
  const summary = await seed(db, { anchor: ANCHOR });
  return { db, summary };
}

export async function count(db: Db, sql: string, params: unknown[] = []): Promise<number> {
  const r = await db.query<{ n: number }>(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}
