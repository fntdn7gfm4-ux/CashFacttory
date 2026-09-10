import { createAdapter } from "./adapters/platforms";
import { generateSignal } from "./strategy";
import { assessRisk, positionSize } from "./risk";
import { BotConfig, BotId, BotRuntime } from "./types";

const adapters = new Map<BotId, ReturnType<typeof createAdapter>>();

export function initialRuntime(config: BotConfig): BotRuntime {
  return {
    status: "stopped", mode: "paper", connected: true, balance: config.balance, equity: config.balance, pnl: 0,
    wins: 0, losses: 0, drawdown: 0,
    prices: Array.from({ length: 36 }, (_, index) => ({ time: Date.now() - (36 - index) * 1000, price: 1.085 + Math.sin(index / 3) * 0.00035 + index * 0.000004 })),
    orders: [], logs: ["PAPER ativo — laboratório Deriv local, sem credenciais e sem ordens externas."], lastTradeAt: 0
  };
}

export async function simulateStep(config: BotConfig, runtime: BotRuntime): Promise<BotRuntime> {
  if (runtime.mode !== "paper") return { ...runtime, status: "stopped", logs: ["Modo externo bloqueado até aprovação e OAuth.", ...runtime.logs].slice(0, 40) };
  let adapter = adapters.get(config.id);
  if (!adapter) { adapter = createAdapter(config.id); await adapter.connect(); adapters.set(config.id, adapter); }
  const tick = await adapter.getTick(config.strategy.symbol);
  const prices = [...runtime.prices, tick].slice(-120);
  const next = { ...runtime, prices, connected: true };
  const signal = generateSignal(config, prices);
  if (!signal) return next;
  const risk = assessRisk(config, runtime);
  if (!risk.allowed) {
    const locked = risk.reason?.includes("Stop") || risk.reason?.includes("Drawdown");
    return { ...next, status: locked ? "risk-locked" : runtime.status, logs: [`${new Date().toLocaleTimeString("pt-BR")} · ${risk.reason}`, ...runtime.logs].slice(0, 40) };
  }
  const order = await adapter.placeOrder({ botId: config.id, symbol: config.strategy.symbol, side: signal.side, size: positionSize(config, runtime.balance), price: tick.price });
  const pnl = Number((runtime.pnl + order.pnl).toFixed(2));
  const balance = Number((runtime.balance + order.pnl).toFixed(2));
  const peak = Math.max(config.balance, balance, ...runtime.orders.map((item) => config.balance + item.pnl));
  const drawdown = Number((((peak - balance) / peak) * 100).toFixed(2));
  return {
    ...next, balance, equity: balance, pnl, drawdown,
    wins: runtime.wins + (order.pnl > 0 ? 1 : 0), losses: runtime.losses + (order.pnl <= 0 ? 1 : 0),
    orders: [order, ...runtime.orders].slice(0, 100), lastTradeAt: Date.now(),
    logs: [`${new Date().toLocaleTimeString("pt-BR")} · ${signal.reason} · ${order.side.toUpperCase()} · ${order.pnl >= 0 ? "+" : ""}$${order.pnl}`, ...runtime.logs].slice(0, 40)
  };
}
