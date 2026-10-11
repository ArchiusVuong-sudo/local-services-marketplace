import type { Db, Tx } from "./client";

/**
 * Runs fn inside one short transaction as the non-superuser role app_user with app.user_id set,
 * so every row the code touches passes the row-level security policies for that person.
 * Both settings reset at commit or rollback. Never hold this open across a slow call (PGlite
 * runs one transaction at a time).
 */
export async function asUser<T>(db: Db, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('app.user_id', $1, true)", [userId]);
    await tx.exec("set local role app_user");
    return fn(tx);
  });
}
