import { describe, expect, it } from "vitest";
import { assertMove, canMove, JOB_STEPS } from "@/lib/domain/lifecycle";
import { formatUsd, holdLines, isBalanced, payoutCents, platformFeeCents, releaseLines } from "@/lib/domain/money";

describe("money", () => {
  it("takes a 10% platform fee and pays the rest", () => {
    expect(platformFeeCents(42_000)).toBe(4_200);
    expect(payoutCents(42_000)).toBe(37_800);
    expect(platformFeeCents(12_345) + payoutCents(12_345)).toBe(12_345);
  });

  it("rejects a non-positive or fractional price", () => {
    expect(() => platformFeeCents(0)).toThrow();
    expect(() => platformFeeCents(10.5)).toThrow();
  });

  it("builds balanced hold and release transactions", () => {
    expect(isBalanced(holdLines(42_000))).toBe(true);
    expect(isBalanced(releaseLines(42_000))).toBe(true);
    expect(isBalanced([{ account: "a", amount_cents: 100 }, { account: "b", amount_cents: -99 }])).toBe(false);
    expect(isBalanced([{ account: "a", amount_cents: 0 }])).toBe(false);
  });

  it("formats dollars", () => {
    expect(formatUsd(42_000)).toBe("$420");
    expect(formatUsd(37_850)).toBe("$378.50");
    expect(formatUsd(0, { cents: true })).toBe("$0.00");
  });
});

describe("job lifecycle", () => {
  it("only moves one step forward", () => {
    expect(JOB_STEPS).toEqual(["booked", "scheduled", "in_progress", "done"]);
    expect(canMove("booked", "scheduled")).toBe(true);
    expect(canMove("scheduled", "in_progress")).toBe(true);
    expect(canMove("in_progress", "done")).toBe(true);
    expect(canMove("booked", "done")).toBe(false);
    expect(canMove("done", "booked")).toBe(false);
    expect(canMove("in_progress", "scheduled")).toBe(false);
    expect(() => assertMove("booked", "in_progress")).toThrow(/can't go from Booked to In progress/);
  });
});
