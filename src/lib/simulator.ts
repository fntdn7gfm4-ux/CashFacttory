import { createAdapter } from "./adapters/platforms";
import { generateSignal } from "./strategy";
import { assessRisk, positionSize } from "./risk";
import { BotConfig, BotRuntime, Platform } from "./types";

const adapters = new Map<Platform, ReturnType<typeof createAdapter>>();

export function initialRuntime(config: BotConfig): BotRuntime {
  const base = config.platform === "deriv" ? 512.34 : 1.085;
  return {
    status: "stopped", balance: config.balance, equity: config.balance, pnl: 0,
    wins: 0, losses: 0, drawdown: 0,
    prices: Array.from({ length: 24 }, (_, i) => ({ time: Date.now() - (24 - i) * 1000, price: base + Math.sin(i / 3) * (config.platform === "deriv" ? 0.4 : 0.0005) })),
    orders: [], logs: ["PAPER MODE inicializado — nenhuma ordem real será enviada."], lastTradeAt: 0
  };
}

export async function simulateStep(config: BotConfig, runtime: BotRuntime): Promise<BotRuntime> {
  let adapter = adapters.get(config.platform);
  if (!adapter) {
    adapter = createAdapter(config.platform);
    await adapter.connect();
    adapters.set(config.platform, adapter);
  }
  const tick = await adapter.getTick(config.strategy.symbol);
  const scaledTick = config.platform === "deriv" ? { ...tick, price: tick.price * 472 } : tick;
  const prices = [...runtime.prices, scaledTick].slice(-80);
  const next = { ...runtime, prices };
  const signal = generateSignal(config, prices);
  if (!signal) return next;
  const risk = assessRisk(config, runtime);
  if (!risk.allowed) {
    const locked = risk.reason?.includes("Stop") || risk.reason?.includes("Drawdown");
    return { ...next, status: locked ? "risk-locked" : runtime.status, logs: [`${new Date().toLocaleTimeString("pt-BR")} · ${risk.reason}`, ...runtime.logs].slice(0, 40) };
  }
  const order = await adapter.placeOrder({ symbol: config.strategy.symbol, side: signal.side, size: positionSize(config, runtime.balance), price: scaledTick.price });
  const pnl = Number((runtime.pnl + order.pnl).toFixed(2));
  const balance = Number((runtime.balance + order.pnl).toFixed(2));
  const peak = Math.max(config.balance, ...runtime.orders.reduce<number[]>((values, item) => [...values, config.balance + item.pnl], []), balance);
  const drawdown = Number((((peak - balance) / peak) * 100).toFixed(2));
  return {
    ...next, balance, equity: balance, pnl, drawdown,
    wins: runtime.wins + (order.pnl >= 0 ? 1 : 0), losses: runtime.losses + (order.pnl < 0 ? 1 : 0),
    orders: [order, ...runtime.orders].slice(0, 100), lastTradeAt: Date.now(),
    logs: [`${new Date().toLocaleTimeString("pt-BR")} · ${signal.reason} · ${order.side.toUpperCase()} · ${order.pnl >= 0 ? "+" : ""}$${order.pnl}`, ...runtime.logs].slice(0, 40)
  };
}
