import { BotConfig, BotRuntime } from "./types";

export interface RiskDecision { allowed: boolean; reason?: string }

export function assessRisk(config: BotConfig, runtime: BotRuntime, now = Date.now()): RiskDecision {
  if (runtime.status === "risk-locked") return { allowed: false, reason: "Bot bloqueado pelo motor de risco" };
  if (-runtime.pnl >= config.risk.dailyStop) return { allowed: false, reason: "Stop diário atingido" };
  if (runtime.drawdown >= config.risk.maxDrawdown) return { allowed: false, reason: "Drawdown máximo atingido" };
  if (config.risk.stake <= 0 || config.risk.stake > config.risk.maxStake) return { allowed: false, reason: "Stake fora dos limites" };
  if (now - runtime.lastTradeAt < config.risk.cooldownSeconds * 1000) return { allowed: false, reason: "Cooldown ativo" };
  return { allowed: true };
}

export function positionSize(config: BotConfig, balance: number): number {
  return Math.min(config.risk.stake, config.risk.maxStake, Math.max(0, balance));
}
