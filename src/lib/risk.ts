import { BotConfig, BotRuntime } from "./types";

export interface RiskDecision { allowed: boolean; reason?: string }

export function assessRisk(config: BotConfig, runtime: BotRuntime, now = Date.now()): RiskDecision {
  if (runtime.status === "risk-locked") return { allowed: false, reason: "Bot bloqueado pelo motor de risco" };
  if (-runtime.pnl >= config.risk.dailyStop) return { allowed: false, reason: "Stop diário atingido" };
  if (runtime.drawdown >= config.risk.maxDrawdown) return { allowed: false, reason: "Drawdown máximo atingido" };
  if (config.risk.riskPerTrade <= 0 || config.risk.riskPerTrade > config.risk.maxRiskPerTrade) return { allowed: false, reason: "Risco por operação fora dos limites" };
  if (now - runtime.lastTradeAt < config.risk.cooldownSeconds * 1000) return { allowed: false, reason: "Cooldown ativo" };
  return { allowed: true };
}

export function positionSize(config: BotConfig, balance: number): number {
  const riskBudget = Math.min(config.risk.riskPerTrade, config.risk.maxRiskPerTrade, Math.max(0, balance));
  return Math.max(0.01, Number(riskBudget.toFixed(2)));
}
