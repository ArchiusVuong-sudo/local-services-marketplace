import type { Category } from "@/lib/domain/types";

export type CategoryHit = {
  slug: string;
  name: string;
  score: number;
  matched: string[];
  questions: Category["questions"];
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * Keyword search over the categories table rows. Longer phrases weigh more, so
 * "water heater leaking" ranks Water heater repair above Leak and pipe repair.
 */
export function rankCategories(text: string, categories: Category[], limit = 3): CategoryHit[] {
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9/\-\s]/g, " ").replace(/\s+/g, " ")} `;
  const hits: CategoryHit[] = [];
  for (const c of categories) {
    const matched: string[] = [];
    let score = 0;
    for (const kw of [...c.keywords, c.name.toLowerCase()]) {
      const re = new RegExp(`(?<![a-z0-9])${escape(kw.toLowerCase())}(?![a-z0-9])`);
      if (re.test(haystack)) {
        matched.push(kw);
        score += kw.split(/\s+/).length * 2 + (kw.length > 6 ? 1 : 0);
      }
    }
    if (score > 0) hits.push({ slug: c.slug, name: c.name, score, matched, questions: c.questions });
  }
  hits.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
  return hits.slice(0, limit);
}
