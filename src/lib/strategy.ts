import { BotConfig, Signal, Tick } from "./types";

const pip = 0.0001;
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
const stdev = (values: number[]) => {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
};
const ema = (values: number[], period: number) => {
  const alpha = 2 / (period + 1);
  return values.slice(1).reduce((value, next) => next * alpha + value * (1 - alpha), values[0]);
};

function diagnostics(ticks: Tick[]) {
  const prices = ticks.map((tick) => tick.price);
  const moves = prices.slice(1).map((price, index) => price - prices[index]);
  const path = moves.reduce((sum, move) => sum + Math.abs(move), 0);
  const displacement = prices.at(-1)! - prices[0];
  const efficiency = path ? Math.abs(displacement) / path : 0;
  const directionRatio = Math.max(
    moves.filter((move) => move > 0).length,
    moves.filter((move) => move < 0).length
  ) / Math.max(moves.length, 1);
  const energy = moves.reduce((sum, move) => sum + move * move, 0);
  const lagProduct = moves.slice(1).reduce((sum, move, index) => sum + move * moves[index], 0);
  return { prices, moves, displacement, efficiency, directionRatio, serialCorrelation: energy ? lagProduct / energy : 0, volatilityPips: stdev(moves) / pip };
}

export function generateSignal(config: BotConfig, ticks: Tick[]): Signal | null {
  const window = ticks.slice(-config.strategy.tickWindow);
  if (window.length < config.strategy.tickWindow) return null;
  const last = window.at(-1)!;
  const spreadPips = last.bid !== undefined && last.ask !== undefined ? (last.ask - last.bid) / pip : 0.8;
  if (spreadPips > config.strategy.maxSpreadPips) return null;

  const d = diagnostics(window);
  if (d.volatilityPips < config.strategy.minimumVolatilityPips / 4) return null;

  if (config.strategy.kind === "momentum") {
    if (d.directionRatio < config.strategy.threshold || d.efficiency < 0.70) return null;
    const side = d.displacement > 0 ? "buy" : "sell";
    return { side, confidence: Math.min(0.99, (d.directionRatio + d.efficiency) / 2), reason: "Sequência direcional eficiente com spread aprovado" };
  }

  if (config.strategy.kind === "mean-reversion") {
    const average = mean(d.prices);
    const deviation = stdev(d.prices);
    const z = deviation ? (d.prices.at(-1)! - average) / deviation : 0;
    if (Math.abs(z) < config.strategy.threshold || d.efficiency > 0.38 || d.serialCorrelation > 0.12) return null;
    return { side: z > 0 ? "sell" : "buy", confidence: Math.min(0.99, Math.abs(z) / 2.5), reason: `Desvio de ${Math.abs(z).toFixed(2)}σ em regime lateral` };
  }

  if (config.strategy.kind === "breakout") {
    const split = Math.max(8, Math.floor(d.prices.length * 0.7));
    const base = d.prices.slice(0, split);
    const trigger = d.prices.slice(split);
    const baseMoves = base.slice(1).map((price, index) => price - base[index]);
    const triggerMoves = trigger.slice(1).map((price, index) => price - trigger[index]);
    const baseVol = stdev(baseMoves);
    const triggerVol = stdev(triggerMoves);
    const ceiling = Math.max(...base);
    const floor = Math.min(...base);
    const lastPrice = trigger.at(-1)!;
    const directional = triggerMoves.filter((move) => Math.sign(move) === Math.sign(lastPrice - base.at(-1)!)).length / Math.max(triggerMoves.length, 1);
    if (triggerVol < baseVol * 1.18 || directional < config.strategy.threshold || (lastPrice <= ceiling && lastPrice >= floor)) return null;
    return { side: lastPrice > ceiling ? "buy" : "sell", confidence: Math.min(0.99, directional), reason: "Rompimento após compressão com expansão de volatilidade" };
  }

  const fast = ema(d.prices, 7);
  const slow = ema(d.prices, 18);
  const trend = fast - slow;
  const recent = d.moves.slice(-4);
  const resumed = Math.sign(recent.at(-1) ?? 0) === Math.sign(trend);
  const pullbackMoves = recent.slice(0, -1).filter((move) => Math.sign(move) === -Math.sign(trend)).length;
  const pullbackDepthPips = -recent.slice(0, -1).reduce((sum, move) => sum + move, 0) * Math.sign(trend) / pip;
  const trendStrength = Math.abs(trend) / Math.max(stdev(d.prices), pip / 10);
  if (!resumed || pullbackMoves < 2 || pullbackDepthPips < 1.2 || d.efficiency < 0.25 || Math.sign(d.displacement) !== Math.sign(trend) || trendStrength < config.strategy.threshold) return null;
  return { side: trend > 0 ? "buy" : "sell", confidence: Math.min(0.99, trendStrength), reason: "Retomada após retração em tendência curta confirmada" };
}
