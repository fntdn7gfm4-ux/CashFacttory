export type BotId = "microflow" | "range-scout" | "squeeze-breakout" | "trend-pullback";
export type StrategyKind = "momentum" | "mean-reversion" | "breakout" | "pullback";
export type BotStatus = "stopped" | "running" | "cooldown" | "risk-locked";
export type TradingMode = "paper" | "demo" | "live";
export type Side = "buy" | "sell";

export interface RiskLimits {
  dailyStop: number;
  maxDrawdown: number;
  maxConcurrent: number;
  cooldownSeconds: number;
  riskPerTrade: number;
  maxRiskPerTrade: number;
}

export interface StrategyConfig {
  kind: StrategyKind;
  symbol: string;
  tickWindow: number;
  threshold: number;
  holdTicks: number;
  maxSpreadPips: number;
  stopLossPips: number;
  takeProfitPips: number;
  minimumVolatilityPips: number;
}

export interface BotConfig {
  id: BotId;
  name: string;
  shortName: string;
  description: string;
  hypothesis: string;
  balance: number;
  risk: RiskLimits;
  strategy: StrategyConfig;
}

export interface Tick { time: number; price: number; bid?: number; ask?: number }
export interface Signal { side: Side; confidence: number; reason: string }

export interface Order {
  id: string;
  botId: BotId;
  platform: "ctrader";
  symbol: string;
  side: Side;
  size: number;
  entry: number;
  exit: number;
  pnl: number;
  costs: number;
  openedAt: number;
  closedAt: number;
  status: "closed";
  mode: TradingMode;
}

export interface BotRuntime {
  status: BotStatus;
  mode: TradingMode;
  connected: boolean;
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
  grossPnl: number;
  costs: number;
  maxDrawdown: number;
  profitFactor: number;
  curve: number[];
}

export interface ConnectionReadiness { approval: boolean; oauth: boolean; demoValidated: boolean; liveUnlocked: boolean }
