import { BotConfig, BotId, ConnectionReadiness } from "./types";

export const botMeta: Record<BotId, { color: string; number: string }> = {
  microflow: { color: "#39d6b4", number: "01" },
  "range-scout": { color: "#55a7ff", number: "02" },
  "squeeze-breakout": { color: "#f5b85a", number: "03" },
  "trend-pullback": { color: "#b98cff", number: "04" }
};

const risk = { dailyStop: 20, maxDrawdown: 4, maxConcurrent: 1, cooldownSeconds: 45, riskPerTrade: 0.5, maxRiskPerTrade: 1 };

export const defaultReadiness: ConnectionReadiness = { publicFeed: true, oauth: false, demoValidated: false, liveUnlocked: false };

export const defaultConfigs: BotConfig[] = [
  {
    id: "microflow", name: "Microflow Momentum", shortName: "Momentum",
    description: "Continuação curta quando a sequência de ticks é direcional e eficiente.",
    hypothesis: "Momentum no Volatility 100 (1s), janela 16, confiança 0,66 e saída em 5 ticks.", balance: 1000,
    risk: { ...risk },
    strategy: { kind: "momentum", symbol: "1HZ100V", tickWindow: 16, threshold: 0.66, holdTicks: 5, maxSpreadPips: 1.2, stopLossPips: 2.4, takeProfitPips: 2.8, minimumVolatilityPips: 0.9 }
  },
  {
    id: "range-scout", name: "Range Scout", shortName: "Reversão",
    description: "Retorno à média após desvio extremo, somente em mercado lateral e com spread estreito.",
    hypothesis: "Busca deslocamentos de 1,55 desvios-padrão, autocorrelação negativa e baixa eficiência direcional.", balance: 1000,
    risk: { ...risk, cooldownSeconds: 60 },
    strategy: { kind: "mean-reversion", symbol: "1HZ100V", tickWindow: 28, threshold: 1.55, holdTicks: 7, maxSpreadPips: 1.0, stopLossPips: 2.2, takeProfitPips: 2.2, minimumVolatilityPips: 1.1 }
  },
  {
    id: "squeeze-breakout", name: "Squeeze Breakout", shortName: "Rompimento",
    description: "Rompimento após compressão de volatilidade, confirmado por expansão e direção dos ticks.",
    hypothesis: "Exige compressão prévia e fechamento além da faixa recente para reduzir entradas no ruído.", balance: 1000,
    risk: { ...risk, cooldownSeconds: 75 },
    strategy: { kind: "breakout", symbol: "1HZ100V", tickWindow: 24, threshold: 0.70, holdTicks: 8, maxSpreadPips: 1.2, stopLossPips: 2.6, takeProfitPips: 3.4, minimumVolatilityPips: 1.2 }
  },
  {
    id: "trend-pullback", name: "Trend Pullback", shortName: "Retração",
    description: "Entrada na retomada de uma tendência curta após uma retração controlada.",
    hypothesis: "Combina inclinação rápida/lenta, eficiência de trajetória e retomada no último tick.", balance: 1000,
    risk: { ...risk, cooldownSeconds: 60 },
    strategy: { kind: "pullback", symbol: "1HZ100V", tickWindow: 32, threshold: 0.40, holdTicks: 4, maxSpreadPips: 1.0, stopLossPips: 2.2, takeProfitPips: 2.6, minimumVolatilityPips: 1.0 }
  }
];
