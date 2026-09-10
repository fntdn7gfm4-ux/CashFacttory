import { BotConfig, Signal, Tick } from "./types";

export function generateSignal(config: BotConfig, ticks: Tick[]): Signal | null {
  const window = ticks.slice(-config.strategy.tickWindow);
  if (window.length < config.strategy.tickWindow) return null;

  if (config.platform === "deriv") {
    const desired = config.strategy.parity === "even" ? 0 : 1;
    const matches = window.filter((tick) => Math.abs(Math.round(tick.price * 100)) % 2 === desired).length;
    const ratio = matches / window.length;
    if (ratio < config.strategy.threshold) return null;
    return {
      side: config.strategy.parity === "even" ? "buy" : "sell",
      confidence: ratio,
      reason: `${matches}/${window.length} últimos dígitos foram ${config.strategy.parity === "even" ? "pares" : "ímpares"}`
    };
  }

  const moves = window.slice(1).map((tick, index) => tick.price - window[index].price);
  const upRatio = moves.filter((move) => move > 0).length / Math.max(1, moves.length);
  const first = window[0].price;
  const last = window.at(-1)!.price;
  const displacement = (last - first) / first;
  const pathLength = moves.reduce((sum, move) => sum + Math.abs(move), 0);
  const efficiency = pathLength ? Math.abs(last - first) / pathLength : 0;
  const lagProduct = moves.slice(1).reduce((sum, move, index) => sum + move * moves[index], 0);
  const moveEnergy = moves.reduce((sum, move) => sum + move * move, 0);
  const serialCorrelation = moveEnergy ? lagProduct / moveEnergy : 0;
  const regimeWindow = ticks.slice(-config.strategy.tickWindow * 3);
  const regimeMoves = regimeWindow.slice(1).map((tick, index) => tick.price - regimeWindow[index].price);
  const regimePath = regimeMoves.reduce((sum, move) => sum + Math.abs(move), 0);
  const regimeEfficiency = regimePath && regimeWindow.length > 1
    ? Math.abs(regimeWindow.at(-1)!.price - regimeWindow[0].price) / regimePath
    : 1;

  if (config.platform === "capital" && Math.max(upRatio, 1 - upRatio) >= config.strategy.threshold && efficiency < 0.24) {
    return { side: upRatio > 0.5 ? "sell" : "buy", confidence: Math.max(upRatio, 1 - upRatio), reason: "Reversão em regime lateral confirmado" };
  }
  if (config.platform === "ctrader" && Math.max(upRatio, 1 - upRatio) >= config.strategy.threshold && efficiency > 0.70) {
    return { side: upRatio > 0.5 ? "buy" : "sell", confidence: Math.max(upRatio, 1 - upRatio), reason: "Momentum confirmado por sequência eficiente" };
  }
  const normalized = Math.abs(displacement) * 10000;
  if (config.platform === "oanda" && regimeWindow.length === config.strategy.tickWindow * 3 && normalized >= config.strategy.threshold && efficiency < 0.22 && regimeEfficiency < 0.20 && serialCorrelation < -0.15) {
    return { side: displacement > 0 ? "sell" : "buy", confidence: Math.min(0.99, normalized), reason: "Retorno à média em regime lateral" };
  }
  return null;
}
