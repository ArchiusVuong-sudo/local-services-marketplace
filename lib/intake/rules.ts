import type { Category } from "@/lib/domain/types";
import { rankCategories } from "./category-search";
import type { IntakeOutput } from "./schema";

/**
 * The labelled fallback parser: regular expressions and keyword search, no model.
 * Used when there is no login, the agent errors or times out, or INTAKE_MODE=rules.
 */
export function parseZip(note: string): string | null {
  return note.match(/(?<!\d)(8[5-6]\d{3})(?!\d)/)?.[1] ?? note.match(/\bzip(?:\s*code)?\s*:?\s*(\d{5})\b/i)?.[1] ?? null;
}

export function parseBudget(note: string): number | null {
  const m =
    note.match(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?/) ??
    note.match(/\b(\d{2,6})\s?(?:dollars|usd|bucks)\b/i);
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseTiming(note: string): IntakeOutput["timing"] {
  const t = note.toLowerCase();
  if (/\b(today|tonight|asap|as soon as|urgent|emergency|right away|immediately)\b/.test(t)) return "asap";
  if (/\b(this week|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in the next few days|tomorrow)\b/.test(t)) return "this_week";
  if (/\b(next week|next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|two weeks|2 weeks|by next)\b/.test(t)) return "next_two_weeks";
  if (/\b(no rush|whenever|flexible|any time|anytime|weekly|monthly|recurring|a month)\b/.test(t)) return "flexible";
  return null;
}

export function parseAnswers(note: string, category: Category): IntakeOutput["answers"] {
  const t = ` ${note.toLowerCase()} `;
  const answers: IntakeOutput["answers"] = [];
  for (const q of category.questions) {
    const hit = (q.options ?? []).find((o) => {
      if (/^not sure$/i.test(o)) return false;
      const key = o.toLowerCase().split(/\s+or\s+|,\s*/)[0] ?? "";
      return key.length > 1 && new RegExp(`(?<![a-z])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`).test(t);
    });
    if (hit) answers.push({ question_id: q.id, answer: hit });
  }
  return answers;
}

export function rulesIntake(note: string, categories: Category[]): IntakeOutput {
  const top = rankCategories(note, categories, 1)[0];
  const category = categories.find((c) => c.slug === top?.slug) ?? categories.find((c) => c.slug === "handyman") ?? categories[0];
  if (!category) throw new Error("No categories loaded");
  const clean = note.trim().replace(/\s+/g, " ");
  return {
    category_slug: category.slug,
    title: category.name,
    zip: parseZip(note),
    timing: parseTiming(note),
    budget_usd: parseBudget(note),
    details: clean.slice(0, 600),
    answers: parseAnswers(note, category),
  };
}
