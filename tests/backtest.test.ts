import { describe, expect, it } from "vitest";
import { defaultConfigs } from "../src/lib/config";
import { makeSyntheticTicks, runBacktest } from "../src/lib/backtest";

describe("local backtest", () => {
  it("is deterministic and returns coherent metrics", () => {
    const ticks = makeSyntheticTicks(300);
    const first = runBacktest(defaultConfigs[3], ticks);
    const second = runBacktest(defaultConfigs[3], ticks);
    expect(first).toEqual(second);
    expect(first.trades).toBe(first.wins + first.losses);
    expect(first.maxDrawdown).toBeGreaterThanOrEqual(0);
  });
});
