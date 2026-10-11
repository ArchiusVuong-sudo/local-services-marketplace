import { z } from "zod";
import type { Category } from "@/lib/domain/types";
import { runStructuredAgent } from "@/lib/llm/agent";
import type { CategoryHit } from "./category-search";
import { loadFixtures, normalizeNote, type RecordedRun } from "./fixtures";
import { INTAKE_SYSTEM_PROMPT, intakePrompt } from "./prompt";
import { INTAKE_JSON_SCHEMA, IntakeOutputSchema, type IntakeOutput, type IntakeStep, type ToolCallTrace } from "./schema";

export type IntakeContext = {
  categories: Category[];
  /** Opens its own short read of the categories table. */
  searchCategories: (query: string) => Promise<CategoryHit[]>;
  onStep: (step: IntakeStep) => void;
  model: string;
  timeoutMs: number;
};

export type ProviderResult = {
  model: string;
  duration_ms: number;
  cost_usd: number | null;
  tool_calls: ToolCallTrace[];
  output: IntakeOutput;
};

/** One interface, two implementations: the live agent and replay of recorded live runs. */
export interface IntakeProvider {
  readonly path: "live" | "replay";
  run(note: string, ctx: IntakeContext): Promise<ProviderResult>;
}

/** Checks the model's output against the schema and the categories table. Throws on anything off. */
export function validateOutput(raw: unknown, categories: Category[]): IntakeOutput {
  const parsed = IntakeOutputSchema.parse(raw);
  const category = categories.find((c) => c.slug === parsed.category_slug);
  if (!category) throw new Error(`Unknown category ${parsed.category_slug}`);
  const answers = parsed.answers.filter((a) => {
    const q = category.questions.find((x) => x.id === a.question_id);
    return q && (!q.options || q.options.includes(a.answer));
  });
  return { ...parsed, answers };
}

export const liveProvider: IntakeProvider = {
  path: "live",
  async run(note, ctx) {
    ctx.onStep({ id: "read", status: "active" });
    let searched = false;
    const r = await runStructuredAgent({
      serverName: "intake",
      systemPrompt: INTAKE_SYSTEM_PROMPT,
      prompt: intakePrompt(note),
      model: ctx.model,
      maxTurns: 6,
      timeoutMs: ctx.timeoutMs,
      jsonSchema: INTAKE_JSON_SCHEMA,
      tools: [
        {
          name: "search_categories",
          description: "Search the marketplace's service categories by keywords. Returns the best matching categories with their slug and intake questions.",
          shape: { query: z.string().min(2).max(120).describe("A few words naming the problem") },
          handler: async (args) => ctx.searchCategories(String((args as { query: string }).query)),
        },
      ],
      onToolStart: (_name, input) => {
        if (!searched) ctx.onStep({ id: "read", status: "done" });
        searched = true;
        ctx.onStep({ id: "search", status: "active", detail: String((input as { query?: string }).query ?? "") });
      },
    });
    ctx.onStep({ id: "search", status: "done" });
    ctx.onStep({ id: "fill", status: "active" });
    const output = validateOutput(r.output, ctx.categories);
    ctx.onStep({ id: "fill", status: "done" });
    return { model: r.model, duration_ms: r.durationMs, cost_usd: r.costUsd, tool_calls: r.toolCalls, output };
  },
};

export class NoRecordingError extends Error {
  constructor() {
    super("No recorded run for this note");
    this.name = "NoRecordingError";
  }
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Replays a recorded live run. The recorded tool calls are run again against the database so the trace is real. */
export function replayProvider(fixtures: Map<string, RecordedRun> = loadFixtures(), paceMs = 450): IntakeProvider {
  return {
    path: "replay",
    async run(note, ctx) {
      const rec = fixtures.get(normalizeNote(note));
      if (!rec) throw new NoRecordingError();
      const started = Date.now();
      ctx.onStep({ id: "read", status: "active" });
      await pause(paceMs);
      ctx.onStep({ id: "read", status: "done" });
      const tool_calls: ToolCallTrace[] = [];
      for (const call of rec.tool_calls) {
        const query = String((call.input as { query?: string }).query ?? "");
        ctx.onStep({ id: "search", status: "active", detail: query });
        const t0 = Date.now();
        const output = await ctx.searchCategories(query);
        await pause(paceMs);
        tool_calls.push({ name: call.name, input: call.input, output, ms: Date.now() - t0 });
      }
      ctx.onStep({ id: "search", status: "done" });
      ctx.onStep({ id: "fill", status: "active" });
      await pause(paceMs);
      const output = validateOutput(rec.output, ctx.categories);
      ctx.onStep({ id: "fill", status: "done" });
      // Time and cost shown are the recorded live run's; the replay itself takes about a second.
      void started;
      return { model: rec.model, duration_ms: rec.duration_ms, cost_usd: rec.cost_usd, tool_calls, output };
    },
  };
}
