import { describe, expect, it } from "vitest";
import { clampDigit, clampDuration, createMatchRows, matchMarkets } from "../src/components/MatchDiffersLab";

describe("MATCH/DIFFERS basket", () => {
  it("creates one enabled bot for every supported digit market", () => {
    const rows = createMatchRows();
    expect(rows).toHaveLength(matchMarkets.length);
    expect(rows).toHaveLength(15);
    expect(rows.every((row) => row.enabled)).toBe(true);
    expect(new Set(rows.map((row) => row.symbol)).size).toBe(15);
  });

  it("keeps predictions and durations inside Deriv limits", () => {
    expect(clampDigit(-1)).toBe(0);
    expect(clampDigit(12)).toBe(9);
    expect(clampDuration(0)).toBe(1);
    expect(clampDuration(15)).toBe(10);
  });
});
