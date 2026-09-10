import { BacktestResult, BotConfig, Tick } from "./types";
import { generateSignal } from "./strategy";

export function makeSyntheticTicks(count = 500, start = 1.085, volatility = 0.0012): Tick[] {
  let price = start;
  let seed = 7411;
  return Array.from({ length: count }, (_, index) => {
    seed = (seed * 16807) % 2147483647;
    price += ((seed / 2147483647) - 0.5) * volatility;
    return { time: index * 1000, price: Number(price.toFixed(5)) };
  });
}

export function runBacktest(config: BotConfig, suppliedTicks?: Tick[]): BacktestResult {
  const ticks = suppliedTicks ?? (config.platform === "deriv" ? makeSyntheticTicks(500, 512.4, 0.42) : makeSyntheticTicks());
  let balance = 10000;
  let peak = balance;
  let maxDrawdown = 0;
  let wins = 0;
  let losses = 0;
  const curve = [balance];
  const start = config.strategy.tickWindow;
  for (let i = start; i < ticks.length - config.strategy.holdTicks; i += Math.max(2, config.strategy.holdTicks)) {
    const signal = generateSignal(config, ticks.slice(0, i + 1));
    if (!signal) continue;
    const entry = ticks[i].price;
    const exit = ticks[i + config.strategy.holdTicks].price;
    const direction = signal.side === "buy" ? 1 : -1;
    const movement = config.platform === "deriv"
      ? ((Math.abs(Math.round(exit * 100)) % 2 === (config.strategy.parity === "even" ? 0 : 1)) ? 0.85 : -1)
      : direction * (exit - entry) * 10000;
    const pnl = Number((movement * config.risk.stake).toFixed(2));
    balance += pnl;
    if (pnl >= 0) wins++; else losses++;
    peak = Math.max(peak, balance);
    maxDrawdown = Math.max(maxDrawdown, ((peak - balance) / peak) * 100);
    curve.push(Number(balance.toFixed(2)));
  }
  const trades = wins + losses;
  return { trades, wins, losses, winRate: trades ? (wins / trades) * 100 : 0, pnl: Number((balance - 10000).toFixed(2)), maxDrawdown: Number(maxDrawdown.toFixed(2)), curve };
}
