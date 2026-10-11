import { PGlite, type Transaction } from "@electric-sql/pglite";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export type Db = PGlite;
export type Tx = Transaction;
/** Anything that can run a query: the owner connection or a scoped transaction. */
export type Queryable = Pick<Transaction, "query" | "exec">;

const MIGRATIONS_DIR = join(process.cwd(), "lib", "db", "migrations");

/** Applies every migration not yet recorded. Runs as the database owner. */
export async function migrate(db: Db): Promise<void> {
  await db.exec("create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())");
  const done = new Set((await db.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into schema_migrations (name) values ($1)", [file]);
    });
  }
}

/** A fresh database. In-memory when no dataDir is given (tests). */
export async function openDb(dataDir?: string): Promise<Db> {
  if (dataDir) mkdirSync(resolve(dataDir), { recursive: true });
  const db = dataDir ? new PGlite(resolve(dataDir)) : new PGlite();
  await db.waitReady;
  await migrate(db);
  return db;
}
