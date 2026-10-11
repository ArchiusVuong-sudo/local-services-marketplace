import { describe, expect, it } from "vitest";
import { matchPros, RELEVANCE_FLOOR, scorePro, weightedRating, type MatchInput, type MatchPro } from "@/lib/domain/matching";

const zips = new Map([
  ["85016", { lat: 33.5079, lng: -112.0302 }],
  ["85018", { lat: 33.4959, lng: -111.9884 }],
  ["85014", { lat: 33.5085, lng: -112.0558 }],
  ["85301", { lat: 33.5348, lng: -112.1784 }],
]);

const base: MatchPro = {
  user_id: "p",
  business_name: "P",
  home_zip: "85018",
  radius_mi: 15,
  category_slugs: ["water-heater-repair"],
  verified: true,
  reply_minutes: 30,
  next_available_days: 1,
  accepting_leads: true,
  review_count: 20,
  rating_sum: 92,
};

const pro = (id: string, over: Partial<MatchPro> = {}): MatchPro => ({ ...base, user_id: id, business_name: id, ...over });

function input(pros: MatchPro[], promotions: MatchInput["promotions"] = []): MatchInput {
  return {
    request: { category_slug: "water-heater-repair", zip: "85016", timing: "this_week" },
    category: { slug: "water-heater-repair", serves_label: "Serves water heaters" },
    pros,
    promotions,
    zips,
  };
}

describe("matching", () => {
  it("never matches a pro from the wrong category or outside its radius", () => {
    const m = matchPros(input([
      pro("ok"),
      pro("wrong_cat", { category_slugs: ["roofing"] }),
      pro("far", { home_zip: "85301", radius_mi: 6 }),
      pro("paused", { accepting_leads: false }),
    ]));
    expect(m.map((x) => x.pro_id)).toEqual(["ok"]);
  });

  it("sends at most 4 leads", () => {
    const m = matchPros(input(Array.from({ length: 9 }, (_, i) => pro(`p${i}`))));
    expect(m).toHaveLength(4);
    expect(m.map((x) => x.rank)).toEqual([1, 2, 3, 4]);
  });

  it("ranks a 5.0 pro with 1 review below a 4.8 pro with 41 reviews when all else is equal", () => {
    expect(weightedRating(1, 5)).toBeLessThan(weightedRating(41, 197));
    const m = matchPros(input([pro("a_new", { review_count: 1, rating_sum: 5 }), pro("b_steady", { review_count: 41, rating_sum: 197 })]));
    expect(m.map((x) => x.pro_id)).toEqual(["b_steady", "a_new"]);
  });

  it("gives the same order for the same input, whatever the input order", () => {
    const pros = [pro("c", { reply_minutes: 50 }), pro("a"), pro("b"), pro("d", { home_zip: "85014" }), pro("e", { review_count: 3, rating_sum: 14 })];
    const first = matchPros(input(pros)).map((x) => x.pro_id);
    for (let i = 0; i < 5; i++) {
      const shuffled = [...pros].sort(() => Math.random() - 0.5);
      expect(matchPros(input(shuffled)).map((x) => x.pro_id)).toEqual(first);
    }
    // Equal scores break the tie by id.
    expect(first.indexOf("a")).toBeLessThan(first.indexOf("b"));
  });

  it("gives the sponsored slot to a verified, active, relevant promoted pro, labelled", () => {
    const pros = [pro("a"), pro("b"), pro("c"), pro("d"), pro("z_promo", { reply_minutes: 120 })];
    const m = matchPros(input(pros, [{ id: 7, pro_id: "z_promo", category_slug: "water-heater-repair", status: "active" }]));
    expect(m).toHaveLength(4);
    expect(m.filter((x) => x.sponsored)).toHaveLength(1);
    expect(m[3]).toMatchObject({ pro_id: "z_promo", sponsored: true, promotion_id: 7 });
    expect(m[3]!.reasons[0]).toEqual({ kind: "sponsored", label: "Sponsored" });
  });

  it("never shows a sponsored pro under the relevance floor", () => {
    const weak = pro("z_weak", { review_count: 30, rating_sum: 90, reply_minutes: 240, next_available_days: 20, home_zip: "85018", radius_mi: 3 });
    const d = 2.6; // 85016 to 85018 is about 2.6 miles
    expect(scorePro(weak, input([]).request, d).total).toBeLessThan(RELEVANCE_FLOOR);
    const m = matchPros(input([pro("a"), weak], [{ id: 1, pro_id: "z_weak", category_slug: "water-heater-repair", status: "active" }]));
    expect(m.map((x) => x.pro_id)).toEqual(["a"]);
  });

  it("never shows a paused promotion or an unverified pro as sponsored", () => {
    const pros = [pro("a"), pro("b"), pro("c"), pro("d"), pro("e"), pro("z_paused", { reply_minutes: 100 }), pro("z_unverified", { verified: false, reply_minutes: 100 })];
    const m = matchPros(input(pros, [
      { id: 1, pro_id: "z_paused", category_slug: "water-heater-repair", status: "paused" },
      { id: 2, pro_id: "z_unverified", category_slug: "water-heater-repair", status: "active" },
    ]));
    expect(m.some((x) => x.sponsored)).toBe(false);
    expect(m.map((x) => x.pro_id)).toEqual(["a", "b", "c", "d"]);
  });

  it("shows a promoted pro that earned 4th place as organic", () => {
    const pros = [pro("a"), pro("b"), pro("c"), pro("d"), pro("e", { reply_minutes: 200 })];
    const m = matchPros(input(pros, [{ id: 3, pro_id: "d", category_slug: "water-heater-repair", status: "active" }]));
    expect(m[3]).toMatchObject({ pro_id: "d", sponsored: false, promotion_id: null });
  });

  it("explains every match with reason chips", () => {
    const [m] = matchPros(input([pro("a", { review_count: 41, rating_sum: 197, reply_minutes: 25 })]));
    const labels = m!.reasons.map((r) => r.label);
    expect(labels).toEqual(expect.arrayContaining(["Serves water heaters", "4.8 from 41 reviews", "Replies in ~25 min", "Verified"]));
    expect(labels.some((l) => /^\d+\.\d mi away$/.test(l))).toBe(true);
  });

  it("rejects an unknown request ZIP", () => {
    expect(() => matchPros({ ...input([pro("a")]), request: { category_slug: "water-heater-repair", zip: "10001", timing: "asap" } })).toThrow(/Unknown ZIP/);
  });
});
