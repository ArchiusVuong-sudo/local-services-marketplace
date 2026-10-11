/**
 * Records real live agent runs for the sample notes into fixtures/intake-runs.json, so replay mode
 * (no login, no key, no network) shows exactly what the live agent returned. Needs a Claude Code
 * login or ANTHROPIC_API_KEY. Usage: npm run record:fixtures
 */
import { readFileSync, writeFileSync } from "node:fs";
import { openDb } from "@/lib/db/client";
import { asUser } from "@/lib/db/scoped";
import { listCategories } from "@/lib/services/catalog";
import { rankCategories } from "@/lib/intake/category-search";
import { FIXTURE_PATH, type FixtureFile, type RecordedRun } from "@/lib/intake/fixtures";
import { intakeModel } from "@/lib/intake/mode";
import { liveProvider } from "@/lib/intake/providers";
import { SAMPLE_NOTES } from "@/lib/intake/samples";
import { seed } from "@/lib/seed/seed";

async function main(): Promise<void> {
  const db = await openDb();
  await seed(db);
  const categories = await asUser(db, "client_maya", (tx) => listCategories(tx));
  const model = intakeModel();
  const sdk = (JSON.parse(readFileSync("node_modules/@anthropic-ai/claude-agent-sdk/package.json", "utf8")) as { version: string }).version;
  const only = process.argv.slice(2);
  const notes = SAMPLE_NOTES.filter((_, i) => !only.length || only.includes(String(i)));

  let existing: RecordedRun[] = [];
  try {
    existing = (JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as FixtureFile).runs;
  } catch {
    existing = [];
  }
  const byNote = new Map(existing.map((r) => [r.note, r]));

  const queue = [...notes];
  const workers = Array.from({ length: 3 }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const r = await liveProvider.run(s.note, {
        categories,
        searchCategories: async (q) => rankCategories(q, categories, 3),
        onStep: () => {},
        model,
        timeoutMs: 120_000,
      });
      byNote.set(s.note, {
        note: s.note,
        model: r.model,
        duration_ms: r.duration_ms,
        cost_usd: r.cost_usd,
        turns: r.tool_calls.length + 1,
        tool_calls: r.tool_calls,
        output: r.output,
        recorded_at: new Date().toISOString(),
      });
      console.log(`${(r.duration_ms / 1000).toFixed(1)} s  ${r.output.category_slug}  ${r.output.zip}  ${r.output.budget_usd}  ${s.note.slice(0, 50)}`);
    }
  });
  await Promise.all(workers);
  const runs = SAMPLE_NOTES.map((s) => byNote.get(s.note)).filter((r): r is RecordedRun => Boolean(r));
  const file: FixtureFile = { recorded_with: { sdk, model }, runs };
  writeFileSync(FIXTURE_PATH, JSON.stringify(file, null, 2) + "\n");
  console.log(`saved ${runs.length} runs to fixtures/intake-runs.json`);
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
