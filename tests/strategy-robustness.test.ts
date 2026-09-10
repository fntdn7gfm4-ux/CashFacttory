import { describe, expect, it } from "vitest";
import { defaultConfigs } from "../src/lib/config";
import { runBacktest } from "../src/lib/backtest";
import { Tick } from "../src/lib/types";

type Regime = "random" | "trend" | "mean-reversion";

function market(regime: Regime, seedValue: number, count = 1200): Tick[] {
  let seed = seedValue;
  let price = 1.085;
  const anchor = price;
  const direction = seedValue % 2 ? 1 : -1;
  return Array.from({ length: count }, (_, time) => {
    seed = (seed * 48271) % 2147483647;
    const noise = (seed / 2147483647 - 0.5) * 0.00042;
    const drift = regime === "trend" ? direction * 0.000045 : 0;
    const pull = regime === "mean-reversion" ? (anchor - price) * 0.09 : 0;
    price += noise + drift + pull;
    return { time: time * 1000, price: Number(price.toFixed(5)) };
  });
}

function derivDigits(seedValue: number, count = 1200): Tick[] {
  let seed = seedValue;
  return Array.from({ length: count }, (_, time) => {
    seed = (seed * 48271) % 2147483647;
    const digit = seed % 10;
    return { time: time * 1000, price: 512 + digit / 100 };
  });
}

describe("strategy robustness lab", () => {
  it("evaluates all bots out of sample across regimes and seeds", () => {
    const report: Record<string, Record<string, { pnl: number; winRate: number; trades: number }>> = {};
    for (const config of defaultConfigs) {
      report[config.platform] = {};
      const regimes: Regime[] = config.platform === "deriv" ? ["random"] : ["random", "trend", "mean-reversion"];
      for (const regime of regimes) {
        const runs = Array.from({ length: 20 }, (_, i) => runBacktest(config, config.platform === "deriv" ? derivDigits(100 + i) : market(regime, 100 + i)));
        const totalTrades = runs.reduce((sum, run) => sum + run.trades, 0);
        const totalWins = runs.reduce((sum, run) => sum + run.wins, 0);
        report[config.platform][regime] = {
          pnl: Number((runs.reduce((sum, run) => sum + run.pnl, 0) / runs.length).toFixed(2)),
          winRate: totalTrades ? Number((totalWins / totalTrades * 100).toFixed(2)) : 0,
          trades: Number((totalTrades / runs.length).toFixed(1))
        };
        expect(runs.every((run) => Number.isFinite(run.pnl) && run.trades === run.wins + run.losses)).toBe(true);
      }
    }
    console.log("STRATEGY_LAB", JSON.stringify(report));
  });
});
