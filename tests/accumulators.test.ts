import { describe, expect, it } from "vitest";
import { accumulatorMarkets, clampAccumulatorTicks, createAccumulatorRows, growthRates } from "../src/components/AccumulatorLab";

describe("ACCUMULATORS basket", () => {
  it("creates one enabled bot per market returned by Deriv contracts_for", () => {
    const rows = createAccumulatorRows();
    expect(rows).toHaveLength(accumulatorMarkets.length);
    expect(rows).toHaveLength(27);
    expect(rows.every((row) => row.enabled)).toBe(true);
    expect(new Set(rows.map((row) => row.symbol)).size).toBe(27);
  });
  it("uses only official growth rates and clamps the exit tick guard", () => {
    expect(createAccumulatorRows().every((row) => growthRates.includes(row.growthRate))).toBe(true);
    expect(clampAccumulatorTicks(0)).toBe(1);
    expect(clampAccumulatorTicks(251)).toBe(250);
  });
});
