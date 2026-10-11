import { describe, expect, it } from "vitest";
import { rankCategories } from "@/lib/intake/category-search";
import { intakeModel } from "@/lib/intake/mode";
import { liveProvider } from "@/lib/intake/providers";
import { HERO_NOTE } from "@/lib/intake/samples";
import { CATEGORIES } from "@/lib/seed/categories";

/** Opt-in: LIVE=1 npm run test:live. Calls the real agent on the local Claude Code login or ANTHROPIC_API_KEY. */
describe.skipIf(process.env.LIVE !== "1")("live intake agent (LIVE=1)", () => {
  it("reads the hero note with one tool call and a schema-checked output", async () => {
    const tools: string[] = [];
    const r = await liveProvider.run(HERO_NOTE, {
      categories: CATEGORIES,
      searchCategories: async (q) => {
        tools.push(q);
        return rankCategories(q, CATEGORIES, 3);
      },
      onStep: () => {},
      model: intakeModel(),
      timeoutMs: 90_000,
    });
    expect(r.output).toMatchObject({ category_slug: "water-heater-repair", zip: "85016", budget_usd: 450, timing: "this_week" });
    expect(tools.length).toBeGreaterThanOrEqual(1);
    expect(r.duration_ms).toBeGreaterThan(0);
  }, 120_000);
});
