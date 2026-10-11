/**
 * Scores intake on the 12 synthetic sample notes, field by field: the rules parser, the recorded live
 * agent runs (fixtures), and with EVAL_LIVE=1 a fresh live run. Usage: npm run eval
 */
import { rankCategories } from "@/lib/intake/category-search";
import { loadFixtures, normalizeNote } from "@/lib/intake/fixtures";
import { intakeModel } from "@/lib/intake/mode";
import { liveProvider } from "@/lib/intake/providers";
import { rulesIntake } from "@/lib/intake/rules";
import { SAMPLE_NOTES, type SampleNote } from "@/lib/intake/samples";
import type { IntakeOutput } from "@/lib/intake/schema";
import { CATEGORIES } from "@/lib/seed/categories";

const FIELDS = ["category", "zip", "budget", "timing"] as const;

function score(s: SampleNote, o: IntakeOutput | undefined): Record<(typeof FIELDS)[number], boolean> {
  return {
    category: o?.category_slug === s.category,
    zip: o?.zip === s.zip,
    budget: o?.budget_usd === s.budget,
    timing: o?.timing === s.timing,
  };
}

function report(name: string, outputs: (IntakeOutput | undefined)[]): void {
  const rows = SAMPLE_NOTES.map((s, i) => score(s, outputs[i]));
  const cells = FIELDS.map((f) => `${f} ${rows.filter((r) => r[f]).length}/${rows.length}`);
  const all3 = rows.filter((r) => r.category && r.zip && r.budget).length;
  console.log(`${name.padEnd(22)} ${cells.join("  ")}  category+zip+budget ${all3}/${rows.length}`);
  SAMPLE_NOTES.forEach((s, i) => {
    const miss = FIELDS.filter((f) => !rows[i]![f]);
    if (miss.length) console.log(`  miss #${i + 1} ${miss.join(", ")}: ${s.note.slice(0, 70)}`);
  });
}

async function main(): Promise<void> {
  console.log(`Intake eval on ${SAMPLE_NOTES.length} synthetic notes\n`);
  report("Rules parser", SAMPLE_NOTES.map((s) => rulesIntake(s.note, CATEGORIES)));
  const fx = loadFixtures();
  report("Recorded agent runs", SAMPLE_NOTES.map((s) => fx.get(normalizeNote(s.note))?.output));
  if (process.env.EVAL_LIVE === "1") {
    const out: IntakeOutput[] = [];
    for (const s of SAMPLE_NOTES) {
      const r = await liveProvider.run(s.note, { categories: CATEGORIES, searchCategories: async (q) => rankCategories(q, CATEGORIES, 3), onStep: () => {}, model: intakeModel(), timeoutMs: 90_000 });
      out.push(r.output);
    }
    report(`Live (${intakeModel()})`, out);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
