import type { Db } from "@/lib/db/client";
import { asUser } from "@/lib/db/scoped";
import { must } from "@/lib/db/sql";
import type { Category } from "@/lib/domain/types";
import { rankCategories } from "@/lib/intake/category-search";
import { loadFixtures, normalizeNote } from "@/lib/intake/fixtures";
import { intakeMode, intakeModel, intakeTimeoutMs, type IntakeMode } from "@/lib/intake/mode";
import { liveProvider, replayProvider, type IntakeProvider, type ProviderResult } from "@/lib/intake/providers";
import { rulesIntake } from "@/lib/intake/rules";
import type { IntakeOutput, IntakePath, IntakeRun, IntakeStep } from "@/lib/intake/schema";
import { listCategories } from "./catalog";

export type MissingItem = { id: string; text: string; options?: string[]; field?: "zip" | "timing" | "budget" };

export type IntakeResult = IntakeRun & { id: number; cached: boolean; missing: MissingItem[]; category: Category };

/** What the client still has to answer: core fields the note left out, then the category's open questions. */
export function missingItems(output: IntakeOutput, category: Category): MissingItem[] {
  const items: MissingItem[] = [];
  if (!output.zip) items.push({ id: "zip", field: "zip", text: "What is the ZIP code of the job?" });
  if (!output.timing) items.push({ id: "timing", field: "timing", text: "When do you need it done?" });
  const answered = new Set(output.answers.map((a) => a.question_id));
  for (const q of category.questions) if (!answered.has(q.id)) items.push({ id: q.id, text: q.text, options: q.options });
  return items;
}

const cacheHolder = globalThis as unknown as { __intakeCache?: Map<string, ProviderResult> };
const liveCache = (cacheHolder.__intakeCache ??= new Map());

export type RunIntakeOptions = {
  mode?: IntakeMode;
  provider?: IntakeProvider;
  onStep?: (step: IntakeStep) => void;
  now?: Date;
};

/**
 * Turns a note into a request draft. Live agent first (or replay when there is no login), and the labelled
 * rules parser when the agent errors, times out or has no recording. No transaction is held during the call:
 * the category search tool opens its own short read.
 */
export async function runIntake(db: Db, clientId: string, note: string, opts: RunIntakeOptions = {}): Promise<IntakeResult> {
  const onStep = opts.onStep ?? (() => {});
  const mode = opts.mode ?? intakeMode();
  const model = intakeModel();
  const categories = await asUser(db, clientId, (tx) => listCategories(tx));
  const searchCategories = async (query: string) => {
    const fresh = await asUser(db, clientId, (tx) => listCategories(tx));
    return rankCategories(query, fresh, 3);
  };
  const ctx = { categories, searchCategories, onStep, model, timeoutMs: intakeTimeoutMs() };

  let path: IntakePath = "rules";
  let result: ProviderResult | null = null;
  let fallback: string | null = null;
  let cached = false;

  const provider = opts.provider ?? (mode === "live" ? liveProvider : mode === "replay" ? replayProvider() : null);
  if (provider) {
    const key = `${model}|${normalizeNote(note)}`;
    try {
      if (provider.path === "live" && liveCache.has(key)) {
        result = liveCache.get(key)!;
        cached = true;
        for (const id of ["read", "search", "fill"] as const) onStep({ id, status: "done" });
      } else {
        result = await provider.run(note, ctx);
        if (provider.path === "live") liveCache.set(key, result);
      }
      path = provider.path;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      if (provider.path === "live" && loadFixtures().has(normalizeNote(note))) {
        try {
          result = await replayProvider().run(note, ctx);
          path = "replay";
          fallback = `Live call failed (${reason.slice(0, 160)}). Replayed the recorded run.`;
        } catch {
          result = null;
        }
      }
      if (!result) {
        fallback =
          provider.path === "replay"
            ? "Replay mode has no recording for this note, so the rules parser read it."
            : `Live call failed (${reason.slice(0, 160)}), so the rules parser read it.`;
      }
    }
  }

  if (!result) {
    const started = Date.now();
    onStep({ id: "read", status: "done" });
    onStep({ id: "search", status: "active", detail: "keywords" });
    const hits = rankCategories(note, categories, 3);
    onStep({ id: "search", status: "done" });
    const output = rulesIntake(note, categories);
    onStep({ id: "fill", status: "done" });
    result = {
      model: "rules parser",
      duration_ms: Date.now() - started,
      cost_usd: null,
      tool_calls: [{ name: "search_categories", input: { query: "keywords from the note" }, output: hits, ms: 0 }],
      output,
    };
    path = "rules";
  }

  const run: IntakeRun = {
    path,
    model: result.model,
    duration_ms: result.duration_ms,
    tool_calls: result.tool_calls,
    output: result.output,
    fallback_reason: fallback,
    cost_usd: result.cost_usd,
  };
  const category = categories.find((c) => c.slug === run.output.category_slug)!;
  const saved = await asUser(db, clientId, (tx) =>
    must<{ id: number }>(
      tx,
      `insert into intake_runs (client_id, note, path, model, duration_ms, tool_calls, output, fallback_reason, cost_usd, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [clientId, note, run.path, run.model, run.duration_ms, JSON.stringify(run.tool_calls), JSON.stringify(run.output), run.fallback_reason, run.cost_usd, opts.now ?? new Date()],
    ),
  );
  return { ...run, id: saved.id, cached, missing: missingItems(run.output, category), category };
}
