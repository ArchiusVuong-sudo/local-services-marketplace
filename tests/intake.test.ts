import { describe, expect, it } from "vitest";
import { childEnv, isRetryable } from "@/lib/llm/agent";
import { rankCategories } from "@/lib/intake/category-search";
import { loadFixtures } from "@/lib/intake/fixtures";
import { intakeMode } from "@/lib/intake/mode";
import { replayProvider, validateOutput, NoRecordingError, type IntakeContext } from "@/lib/intake/providers";
import { parseBudget, parseTiming, parseZip, rulesIntake } from "@/lib/intake/rules";
import { HERO_NOTE, SAMPLE_NOTES } from "@/lib/intake/samples";
import { CATEGORIES } from "@/lib/seed/categories";
import { missingItems } from "@/lib/services/intake";

const ctx = (steps: string[] = []): IntakeContext => ({
  categories: CATEGORIES,
  searchCategories: async (q) => rankCategories(q, CATEGORIES, 3),
  onStep: (s) => steps.push(`${s.id}:${s.status}`),
  model: "claude-sonnet-5-5",
  timeoutMs: 5000,
});

describe("rules parser (INTAKE_MODE=rules)", () => {
  it("gets category, ZIP and budget right on at least 10 of 12 sample notes", () => {
    const right = SAMPLE_NOTES.filter((s) => {
      const o = rulesIntake(s.note, CATEGORIES);
      return o.category_slug === s.category && o.zip === s.zip && o.budget_usd === s.budget;
    });
    expect(right.length).toBeGreaterThanOrEqual(10);
  });

  it("reads the hero note fully", () => {
    expect(rulesIntake(HERO_NOTE, CATEGORIES)).toMatchObject({ category_slug: "water-heater-repair", zip: "85016", timing: "this_week", budget_usd: 450 });
  });

  it("parses the pieces", () => {
    expect(parseZip("in 85251 today")).toBe("85251");
    expect(parseZip("call 6025550147")).toBeNull();
    expect(parseBudget("about $1,200 total")).toBe(1200);
    expect(parseBudget("can pay 300 dollars")).toBe(300);
    expect(parseBudget("no budget yet")).toBeNull();
    expect(parseTiming("need someone today")).toBe("asap");
    expect(parseTiming("by Friday please")).toBe("this_week");
    expect(parseTiming("no rush at all")).toBe("flexible");
    expect(parseTiming("it broke")).toBeNull();
  });

  it("ranks the longer phrase first", () => {
    expect(rankCategories("water heater leaking", CATEGORIES)[0]?.slug).toBe("water-heater-repair");
    expect(rankCategories("toilet is leaking", CATEGORIES)[0]?.slug).toBe("leak-repair");
  });
});

describe("structured output check", () => {
  const good = { category_slug: "water-heater-repair", title: "Fix water heater", zip: "85016", timing: "this_week", budget_usd: 450, details: "Leaking.", answers: [] };

  it("accepts a valid output", () => {
    expect(validateOutput(good, CATEGORIES).category_slug).toBe("water-heater-repair");
  });

  it("rejects an unknown category, a bad ZIP or extra fields", () => {
    expect(() => validateOutput({ ...good, category_slug: "moving" }, CATEGORIES)).toThrow(/Unknown category/);
    expect(() => validateOutput({ ...good, zip: "8501" }, CATEGORIES)).toThrow();
    expect(() => validateOutput({ ...good, timing: "someday" }, CATEGORIES)).toThrow();
    expect(() => validateOutput({ ...good, extra: 1 }, CATEGORIES)).toThrow();
  });

  it("drops answers to unknown questions or with options the category doesn't offer", () => {
    const o = validateOutput({ ...good, answers: [{ question_id: "fuel", answer: "Gas" }, { question_id: "fuel2", answer: "x" }, { question_id: "type", answer: "Boiler" }] }, CATEGORIES);
    expect(o.answers).toEqual([{ question_id: "fuel", answer: "Gas" }]);
  });

  it("asks only what is missing", () => {
    const cat = CATEGORIES.find((c) => c.slug === "water-heater-repair")!;
    const items = missingItems({ ...good, zip: null, timing: null, answers: [{ question_id: "fuel", answer: "Gas" }] } as never, cat);
    expect(items.map((i) => i.id)).toEqual(["zip", "timing", "type", "age"]);
  });
});

describe("replay provider", () => {
  it("has a recorded live run for every sample note, each one correct", () => {
    const fixtures = loadFixtures();
    for (const s of SAMPLE_NOTES) {
      const rec = fixtures.get(s.note.trim().toLowerCase().replace(/\s+/g, " "));
      expect(rec, s.note).toBeDefined();
      expect(rec!.output).toMatchObject({ category_slug: s.category, zip: s.zip, budget_usd: s.budget });
      expect(rec!.tool_calls.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("replays the hero note with progress steps and re-runs the tool against the categories", async () => {
    const steps: string[] = [];
    const r = await replayProvider(loadFixtures(), 0).run(HERO_NOTE, ctx(steps));
    expect(r.output).toMatchObject({ category_slug: "water-heater-repair", zip: "85016", budget_usd: 450 });
    expect(r.tool_calls[0]?.name).toBe("search_categories");
    expect(steps).toEqual(["read:active", "read:done", "search:active", "search:done", "fill:active", "fill:done"]);
  });

  it("throws NoRecordingError for an unknown note", async () => {
    await expect(replayProvider(loadFixtures(), 0).run("A note nobody recorded", ctx())).rejects.toBeInstanceOf(NoRecordingError);
  });
});

describe("agent guardrails", () => {
  it("builds the child environment from an allowlist", () => {
    const env = childEnv({ PATH: "/bin", HOME: "/h", USER: "u", LANG: "en", TMPDIR: "/t", CLAUDECODE: "1", CLAUDE_CODE_ENTRYPOINT: "x", SECRET_TOKEN: "s", ANTHROPIC_API_KEY: "k" });
    expect(Object.keys(env).sort()).toEqual(["ANTHROPIC_API_KEY", "HOME", "LANG", "PATH", "TMPDIR", "USER"]);
    expect(childEnv({ PATH: "/bin" })).toEqual({ PATH: "/bin" });
  });

  it("retries only overloaded, rate-limit and 5xx errors", () => {
    expect(isRetryable("API Error: 529 overloaded_error")).toBe(true);
    expect(isRetryable("rate_limit exceeded")).toBe(true);
    expect(isRetryable("", 503)).toBe(true);
    expect(isRetryable("invalid_request: bad schema", 400)).toBe(false);
  });

  it("picks the intake path from the environment", () => {
    expect(intakeMode({ DEMO_REPLAY: "1" })).toBe("replay");
    expect(intakeMode({ INTAKE_MODE: "rules", DEMO_REPLAY: "1" })).toBe("rules");
    expect(intakeMode({ HOME: "/nonexistent-home" })).toBe("replay");
    expect(intakeMode({ ANTHROPIC_API_KEY: "set", HOME: "/nonexistent-home" })).toBe("live");
  });
});
