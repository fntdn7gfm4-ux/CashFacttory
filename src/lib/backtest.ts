import { BacktestResult, BotConfig, Tick } from "./types";
import { generateSignal } from "./strategy";

export type MarketRegime = "random" | "trend" | "mean-reversion" | "compression-breakout" | "trend-pullback";

export function makeSyntheticTicks(count = 900, initialSeed = 7411, regime: MarketRegime = "random"): Tick[] {
  let price = 1.085;
  let seed = initialSeed;
  const anchor = price;
  return Array.from({ length: count }, (_, index) => {
    seed = (seed * 48271) % 2147483647;
    const random = seed / 2147483647 - 0.5;
    const cycle = index % 180;
    const trendDirection = Math.floor(index / 180) % 2 ? -1 : 1;
    let movement = random * 0.00034;
    if (regime === "trend") movement += trendDirection * 0.000055;
    if (regime === "mean-reversion") movement += (anchor - price) * 0.11;
    if (regime === "compression-breakout") movement = random * (cycle < 125 ? 0.00010 : 0.00042) + (cycle >= 125 ? trendDirection * 0.00007 : 0);
    if (regime === "trend-pullback") movement += trendDirection * 0.000048 + (cycle % 24 >= 17 && cycle % 24 <= 20 ? -trendDirection * 0.00011 : 0);
    price += movement;
    const spreadPips = 0.55 + Math.abs(random) * 0.5;
    const halfSpread = spreadPips * 0.0001 / 2;
    return { time: index * 1000, price: Number(price.toFixed(5)), bid: Number((price - halfSpread).toFixed(5)), ask: Number((price + halfSpread).toFixed(5)) };
  });
}

export function runBacktest(config: BotConfig, suppliedTicks?: Tick[]): BacktestResult {
  const ticks = suppliedTicks ?? makeSyntheticTicks(900, 7411, config.strategy.kind === "breakout" ? "compression-breakout" : config.strategy.kind === "pullback" ? "trend-pullback" : config.strategy.kind === "mean-reversion" ? "mean-reversion" : "trend");
  let balance = config.balance;
  let peak = balance;
  let maxDrawdown = 0;
  let wins = 0;
  let losses = 0;
  let grossPnl = 0;
  let totalCosts = 0;
  let grossWins = 0;
  let grossLosses = 0;
  const curve = [balance];
  const start = config.strategy.tickWindow;

  for (let index = start; index < ticks.length - config.strategy.holdTicks; index += Math.max(config.strategy.holdTicks, 3)) {
    const signal = generateSignal(config, ticks.slice(0, index + 1));
    if (!signal) continue;
    const entryTick = ticks[index];
    const exitTick = ticks[index + config.strategy.holdTicks];
    const direction = signal.side === "buy" ? 1 : -1;
    const rawMovePips = direction * (exitTick.price - entryTick.price) * 10000;
    const boundedMovePips = Math.max(-config.strategy.stopLossPips, Math.min(config.strategy.takeProfitPips, rawMovePips));
    const dollarsPerPip = config.risk.riskPerTrade / config.strategy.stopLossPips;
    const gross = boundedMovePips * dollarsPerPip;
    const spreadPips = entryTick.bid !== undefined && entryTick.ask !== undefined ? (entryTick.ask - entryTick.bid) * 10000 : 0.8;
    const cost = (spreadPips + 0.10) * dollarsPerPip + 0.02;
    const pnl = Number((gross - cost).toFixed(2));
    grossPnl += gross;
    totalCosts += cost;
    balance += pnl;
    if (pnl > 0) { wins++; grossWins += pnl; } else { losses++; grossLosses += Math.abs(pnl); }
    peak = Math.max(peak, balance);
    maxDrawdown = Math.max(maxDrawdown, ((peak - balance) / peak) * 100);
    curve.push(Number(balance.toFixed(2)));
    if (config.balance - balance >= config.risk.dailyStop || maxDrawdown >= config.risk.maxDrawdown) break;
  }

  const trades = wins + losses;
  return {
    trades, wins, losses, winRate: trades ? wins / trades * 100 : 0,
    pnl: Number((balance - config.balance).toFixed(2)), grossPnl: Number(grossPnl.toFixed(2)), costs: Number(totalCosts.toFixed(2)),
    maxDrawdown: Number(maxDrawdown.toFixed(2)), profitFactor: grossLosses ? Number((grossWins / grossLosses).toFixed(2)) : grossWins ? 99 : 0,
    curve
  };
}

export function runStrategyLab(config: BotConfig) {
  const preferred: MarketRegime = config.strategy.kind === "momentum" ? "trend" : config.strategy.kind === "mean-reversion" ? "mean-reversion" : config.strategy.kind === "breakout" ? "compression-breakout" : "trend-pullback";
  const runs = Array.from({ length: 20 }, (_, index) => runBacktest(config, makeSyntheticTicks(1200, 1000 + index, preferred)));
  const trades = runs.reduce((sum, run) => sum + run.trades, 0);
  return {
    samples: runs.length,
    averagePnl: Number((runs.reduce((sum, run) => sum + run.pnl, 0) / runs.length).toFixed(2)),
    medianPnl: Number([...runs].sort((a, b) => a.pnl - b.pnl)[Math.floor(runs.length / 2)].pnl.toFixed(2)),
    profitableSamples: runs.filter((run) => run.pnl > 0).length,
    winRate: trades ? Number((runs.reduce((sum, run) => sum + run.wins, 0) / trades * 100).toFixed(2)) : 0,
    averageTrades: Number((trades / runs.length).toFixed(1)),
    averageCosts: Number((runs.reduce((sum, run) => sum + run.costs, 0) / runs.length).toFixed(2)),
    worstDrawdown: Math.max(...runs.map((run) => run.maxDrawdown))
  };
}
