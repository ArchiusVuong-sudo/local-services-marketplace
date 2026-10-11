import { z } from "zod";

export const TIMINGS = ["asap", "this_week", "next_two_weeks", "flexible"] as const;

/** What the intake step must return. The agent's structured output is checked against this before use. */
export const IntakeOutputSchema = z
  .object({
    category_slug: z.string().min(1),
    title: z.string().min(3).max(80),
    zip: z.string().regex(/^\d{5}$/).nullable(),
    timing: z.enum(TIMINGS).nullable(),
    budget_usd: z.number().int().positive().max(100_000).nullable(),
    details: z.string().max(600),
    answers: z.array(z.object({ question_id: z.string().min(1), answer: z.string().min(1).max(80) })).max(6),
  })
  .strict();

export type IntakeOutput = z.infer<typeof IntakeOutputSchema>;

/** JSON schema handed to the model (json_schema output format). Mirrors IntakeOutputSchema. */
export const INTAKE_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["category_slug", "title", "zip", "timing", "budget_usd", "details", "answers"],
  properties: {
    category_slug: { type: "string", description: "Slug of one category returned by search_categories" },
    title: { type: "string", description: "Short job title, 3-7 words" },
    zip: { type: ["string", "null"], description: "5-digit US ZIP code if the note gives one, else null" },
    timing: { type: ["string", "null"], enum: [...TIMINGS, null] },
    budget_usd: { type: ["integer", "null"], description: "Budget in whole US dollars if stated, else null" },
    details: { type: "string", description: "One or two plain sentences describing the job" },
    answers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question_id", "answer"],
        properties: { question_id: { type: "string" }, answer: { type: "string" } },
      },
    },
  },
};

export type ToolCallTrace = { name: string; input: unknown; output: unknown; ms: number };

export type IntakePath = "live" | "replay" | "rules";

export type IntakeRun = {
  path: IntakePath;
  model: string | null;
  duration_ms: number;
  tool_calls: ToolCallTrace[];
  output: IntakeOutput;
  fallback_reason: string | null;
  cost_usd: number | null;
};

export type IntakeStep = { id: "read" | "search" | "fill"; status: "active" | "done"; detail?: string };
