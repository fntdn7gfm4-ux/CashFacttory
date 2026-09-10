import { describe, expect, it } from "vitest";
import { defaultConfigs } from "../src/lib/config";
import { makeSyntheticTicks, MarketRegime, runBacktest, runStrategyLab } from "../src/lib/backtest";

describe("strategy robustness lab", () => {
  it("evaluates twenty seeded samples per strategy with execution costs", () => {
    for (const config of defaultConfigs) {
      const report = runStrategyLab(config);
      console.log("STRATEGY_LAB", config.id, JSON.stringify(report));
      expect(report.samples).toBe(20);
      expect(Number.isFinite(report.averagePnl)).toBe(true);
      expect(report.averageCosts).toBeGreaterThanOrEqual(0);
      expect(report.worstDrawdown).toBeGreaterThanOrEqual(0);
    }
  });

  it("does not assume a strategy works in every market regime", () => {
    const regimes: MarketRegime[] = ["random", "trend", "mean-reversion", "compression-breakout", "trend-pullback"];
    for (const config of defaultConfigs) {
      const outcomes = regimes.map((regime, index) => runBacktest(config, makeSyntheticTicks(800, 2500 + index, regime)));
      expect(outcomes.every((result) => result.trades === result.wins + result.losses)).toBe(true);
      expect(outcomes.every((result) => result.costs >= 0)).toBe(true);
    }
  });
});
