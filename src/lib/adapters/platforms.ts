import { CTraderPaperAdapter, TradingAdapter } from "./base";
import { BotId, TradingMode } from "../types";

class PaperStrategyAdapter extends CTraderPaperAdapter {}

export const ctraderEndpoints = {
  demo: "wss://demo.ctraderapi.com:5036",
  live: "wss://live.ctraderapi.com:5036",
  oauth: "https://openapi.ctrader.com/apps/auth"
} as const;

export function createAdapter(_botId: BotId, mode: TradingMode = "paper", executionBridgeReady = false): TradingAdapter {
  if (mode !== "paper" && !executionBridgeReady) {
    throw new Error(`Modo ${mode} bloqueado: aprovação, OAuth e executor seguro ainda não foram validados.`);
  }
  // The safe local simulator is the only executable adapter before approval.
  // Demo/live will be supplied by the server-side bridge without changing strategy code.
  return new PaperStrategyAdapter();
}

export const integrationPolicy = {
  broker: "Deriv",
  venue: "CT Deriv",
  provider: "cTrader Open API",
  tradingUrl: "https://ct.deriv.com/",
  verifiedEurUsdVolume: { minLots: 0.01, maxLots: 20 },
  secretsInBrowser: false,
  defaultMode: "paper" as const,
  demoRequires: ["approved-app", "oauth", "demo-account"],
  liveRequires: ["approved-app", "oauth", "demo-validation", "explicit-live-unlock"]
};
