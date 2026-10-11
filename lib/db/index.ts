import { openDb, type Db } from "./client";
import { isSeeded, seed } from "@/lib/seed/seed";

type Holder = { promise?: Promise<Db> };
const holder = globalThis as unknown as { __marketplaceDb?: Holder };

/** One file-backed PGlite instance per server process, migrated and seeded on first use. */
export function getDb(): Promise<Db> {
  const h = (holder.__marketplaceDb ??= {});
  h.promise ??= (async () => {
    const db = await openDb(process.env.DATA_DIR || "./data/pg");
    if (!(await isSeeded(db))) await seed(db);
    return db;
  })().catch((e) => {
    h.promise = undefined;
    throw e;
  });
  return h.promise;
}
