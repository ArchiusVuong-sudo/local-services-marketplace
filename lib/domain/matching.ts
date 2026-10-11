import { distanceMiles, type LatLng } from "./geo";
import type { ReasonChip, Timing } from "./types";

/** How many pros get each request, and at most one of them may be a sponsored placement. */
export const LEADS_PER_REQUEST = 4;
/** Every pro, sponsored or not, must reach this score to get a lead. */
export const RELEVANCE_FLOOR = 0.45;

export const WEIGHTS = { rating: 0.4, distance: 0.25, reply: 0.2, availability: 0.15 } as const;

/** Prior for the review score: a pro with few reviews is pulled toward this average. */
export const RATING_PRIOR = { mean: 4.0, weight: 8 } as const;

export type MatchRequest = { category_slug: string; zip: string; timing: Timing };

export type MatchPro = {
  user_id: string;
  business_name: string;
  home_zip: string;
  radius_mi: number;
  category_slugs: string[];
  verified: boolean;
  reply_minutes: number;
  next_available_days: number;
  accepting_leads: boolean;
  review_count: number;
  rating_sum: number;
};

export type MatchPromotion = { id: number; pro_id: string; category_slug: string; status: "active" | "paused" };

export type MatchCategory = { slug: string; serves_label: string };

export type ScoreParts = { rating: number; distance: number; reply: number; availability: number };

export type Match = {
  pro_id: string;
  rank: number;
  score: number;
  parts: ScoreParts;
  distance_mi: number;
  sponsored: boolean;
  promotion_id: number | null;
  reasons: ReasonChip[];
};

export type MatchInput = {
  request: MatchRequest;
  category: MatchCategory;
  pros: MatchPro[];
  promotions: MatchPromotion[];
  zips: Map<string, LatLng>;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** Review score weighted by review count (a Bayesian average). One 5-star review can't outrank 41 good ones. */
export function weightedRating(reviewCount: number, ratingSum: number): number {
  return (RATING_PRIOR.mean * RATING_PRIOR.weight + ratingSum) / (RATING_PRIOR.weight + reviewCount);
}

export function availabilityScore(timing: Timing, nextAvailableDays: number): number {
  const horizon: Record<Timing, number> = { asap: 1, this_week: 4, next_two_weeks: 10, flexible: 30 };
  const h = horizon[timing];
  if (nextAvailableDays <= h) return 1;
  return clamp01(1 - (nextAvailableDays - h) / (h + 3));
}

export function scorePro(pro: MatchPro, request: MatchRequest, distance: number): ScoreParts & { total: number } {
  const rating = clamp01((weightedRating(pro.review_count, pro.rating_sum) - 3) / 2);
  const dist = clamp01(1 - distance / pro.radius_mi);
  const reply = clamp01(1 - (pro.reply_minutes - 15) / (240 - 15));
  const availability = availabilityScore(request.timing, pro.next_available_days);
  const total =
    WEIGHTS.rating * rating + WEIGHTS.distance * dist + WEIGHTS.reply * reply + WEIGHTS.availability * availability;
  return { rating: round4(rating), distance: round4(dist), reply: round4(reply), availability: round4(availability), total: round4(total) };
}

export function formatReply(minutes: number): string {
  if (minutes < 60) return `Replies in ~${minutes} min`;
  const h = Math.round(minutes / 60);
  return `Replies in ~${h} h`;
}

function reasonsFor(pro: MatchPro, category: MatchCategory, distance: number, parts: ScoreParts, sponsored: boolean): ReasonChip[] {
  const chips: ReasonChip[] = [];
  if (sponsored) chips.push({ kind: "sponsored", label: "Sponsored" });
  chips.push({ kind: "category", label: category.serves_label });
  chips.push({ kind: "distance", label: `${distance.toFixed(1)} mi away` });
  chips.push({
    kind: "rating",
    label: pro.review_count === 0 ? "New, no reviews yet" : `${(pro.rating_sum / pro.review_count).toFixed(1)} from ${pro.review_count} review${pro.review_count === 1 ? "" : "s"}`,
  });
  chips.push({ kind: "reply", label: formatReply(pro.reply_minutes) });
  if (pro.verified) chips.push({ kind: "verified", label: "Verified" });
  if (parts.availability >= 1) chips.push({ kind: "availability", label: pro.next_available_days <= 1 ? "Free in a day" : `Free in ${pro.next_available_days} days` });
  return chips;
}

type Candidate = { pro: MatchPro; distance: number; parts: ScoreParts; total: number };

function byScore(a: Candidate, b: Candidate): number {
  return b.total - a.total || a.pro.user_id.localeCompare(b.pro.user_id);
}

/**
 * Picks the pros that get a request. Pure and deterministic: the same input always gives the same order.
 * Eligible: serves the category, accepting leads, the request ZIP inside the pro's radius, score at or above the floor.
 * Up to 4 leads. One slot may go to a sponsored pro, only when it is verified, its promotion for this
 * category is active and it passes the same floor; otherwise all 4 are organic.
 */
export function matchPros(input: MatchInput): Match[] {
  const { request, category, pros, promotions, zips } = input;
  const origin = zips.get(request.zip);
  if (!origin) throw new Error(`Unknown ZIP ${request.zip}`);

  const eligible: Candidate[] = [];
  for (const pro of pros) {
    if (!pro.accepting_leads || !pro.category_slugs.includes(request.category_slug)) continue;
    const home = zips.get(pro.home_zip);
    if (!home) continue;
    const distance = distanceMiles(origin, home);
    if (distance > pro.radius_mi) continue;
    const s = scorePro(pro, request, distance);
    if (s.total < RELEVANCE_FLOOR) continue;
    eligible.push({ pro, distance, parts: s, total: s.total });
  }
  eligible.sort(byScore);

  const activePromo = new Map<string, MatchPromotion>();
  for (const p of promotions) {
    if (p.status === "active" && p.category_slug === request.category_slug) activePromo.set(p.pro_id, p);
  }

  const slots = LEADS_PER_REQUEST - 1;
  const top = eligible.slice(0, slots);
  const topIds = new Set(top.map((c) => c.pro.user_id));
  const sponsor = eligible.find((c) => c.pro.verified && activePromo.has(c.pro.user_id) && !topIds.has(c.pro.user_id));
  const organicNext = eligible[slots];

  // A promoted pro that would have been 4th anyway earned the slot: it shows as organic.
  const picked: { c: Candidate; sponsored: boolean }[] = top.map((c) => ({ c, sponsored: false }));
  if (sponsor) picked.push({ c: sponsor, sponsored: sponsor !== organicNext });
  else if (organicNext) picked.push({ c: organicNext, sponsored: false });

  return picked.map(({ c, sponsored }, i) => ({
    pro_id: c.pro.user_id,
    rank: i + 1,
    score: c.total,
    parts: c.parts,
    distance_mi: Math.round(c.distance * 10) / 10,
    sponsored,
    promotion_id: sponsored ? (activePromo.get(c.pro.user_id)?.id ?? null) : null,
    reasons: reasonsFor(c.pro, category, c.distance, c.parts, sponsored),
  }));
}
