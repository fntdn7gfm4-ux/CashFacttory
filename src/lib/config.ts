import { BotConfig, Platform } from "./types";

export const platformMeta: Record<Platform, { color: string; short: string }> = {
  deriv: { color: "#ff5a61", short: "DV" },
  capital: { color: "#00d49c", short: "CP" },
  ctrader: { color: "#36a3ff", short: "CT" },
  oanda: { color: "#ffb454", short: "OA" }
};

const risk = {
  dailyStop: 50,
  maxDrawdown: 12,
  maxConcurrent: 1,
  cooldownSeconds: 8,
  stake: 2,
  maxStake: 5
};

export const defaultConfigs: BotConfig[] = [
  {
    platform: "deriv",
    name: "Deriv Digits",
    description: "Paridade real do último dígito em ticks sintéticos.",
    balance: 10000,
    risk: { ...risk },
    strategy: { symbol: "R_100", tickWindow: 12, threshold: 0.6, holdTicks: 1, parity: "even" }
  },
  {
    platform: "capital",
    name: "Capital Pulse",
    description: "Reversão curta após desequilíbrio direcional de ticks.",
    balance: 10000,
    risk: { ...risk },
    strategy: { symbol: "EURUSD", tickWindow: 18, threshold: 0.64, holdTicks: 4, parity: "even" }
  },
  {
    platform: "ctrader",
    name: "cTrader Microflow",
    description: "Momentum de microestrutura com confirmação por janela.",
    balance: 10000,
    risk: { ...risk },
    strategy: { symbol: "EURUSD", tickWindow: 16, threshold: 0.66, holdTicks: 5, parity: "even" }
  },
  {
    platform: "oanda",
    name: "OANDA Tick Edge",
    description: "Retorno à média em deslocamentos curtos normalizados.",
    balance: 10000,
    risk: { ...risk },
    strategy: { symbol: "EUR_USD", tickWindow: 20, threshold: 0.68, holdTicks: 6, parity: "even" }
  }
];
