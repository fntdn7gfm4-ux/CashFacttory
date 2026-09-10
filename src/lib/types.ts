export type Platform = "deriv" | "capital" | "ctrader" | "oanda";
export type BotStatus = "stopped" | "running" | "cooldown" | "risk-locked";
export type Side = "buy" | "sell";

export interface RiskLimits {
  dailyStop: number;
  maxDrawdown: number;
  maxConcurrent: number;
  cooldownSeconds: number;
  stake: number;
  maxStake: number;
}

export interface StrategyConfig {
  symbol: string;
  tickWindow: number;
  threshold: number;
  holdTicks: number;
  parity: "even" | "odd";
}

export interface BotConfig {
  platform: Platform;
  name: string;
  description: string;
  balance: number;
  risk: RiskLimits;
  strategy: StrategyConfig;
}

export interface Tick {
  time: number;
  price: number;
}

export interface Signal {
  side: Side;
  confidence: number;
  reason: string;
}

export interface Order {
  id: string;
  platform: Platform;
  symbol: string;
  side: Side;
  size: number;
  entry: number;
  exit: number;
  pnl: number;
  openedAt: number;
  closedAt: number;
  status: "closed";
  mode: "PAPER";
}

export interface BotRuntime {
  status: BotStatus;
  balance: number;
  equity: number;
  pnl: number;
  wins: number;
  losses: number;
  drawdown: number;
  prices: Tick[];
  orders: Order[];
  logs: string[];
  lastTradeAt: number;
}

export interface BacktestResult {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
  maxDrawdown: number;
  curve: number[];
}
