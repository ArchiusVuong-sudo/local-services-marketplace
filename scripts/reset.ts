/**
 * Re-seeds the demo data for a clean take. If the app is running it asks the app to reset (one process
 * owns the database files); otherwise it opens the data folder directly.
 * Usage: npm run reset
 */
import { openDb } from "@/lib/db/client";
import { resetAndSeed } from "@/lib/seed/seed";

const URL = `http://127.0.0.1:${process.env.PORT ?? 4111}`;

async function main(): Promise<void> {
  const running = await fetch(`${URL}/api/health`).then((r) => r.ok).catch(() => false);
  if (running) {
    const r = await fetch(`${URL}/api/demo/reset`, { method: "POST" });
    if (!r.ok) throw new Error(`reset failed: HTTP ${r.status}`);
    console.log("reset through the running app:", await r.json());
    return;
  }
  const db = await openDb(process.env.DATA_DIR || "./data/pg");
  console.log("reset:", await resetAndSeed(db));
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
