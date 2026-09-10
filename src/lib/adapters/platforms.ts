import { PaperAdapter } from "./base";
import { Platform } from "../types";

class DerivAdapter extends PaperAdapter { readonly platform = "deriv" as const; }
class CapitalAdapter extends PaperAdapter { readonly platform = "capital" as const; }
class CTraderAdapter extends PaperAdapter { readonly platform = "ctrader" as const; }
class OandaAdapter extends PaperAdapter { readonly platform = "oanda" as const; }

export function createAdapter(platform: Platform): PaperAdapter {
  const adapters = {
    deriv: DerivAdapter,
    capital: CapitalAdapter,
    ctrader: CTraderAdapter,
    oanda: OandaAdapter
  };
  const Adapter = adapters[platform];
  return new Adapter();
}

/**
 * External API integration boundary.
 * Live mode is intentionally absent. Demo implementations should be added here,
 * server-side only, after credentials are supplied by the account owner.
 */
export const demoEndpoints = {
  deriv: "wss://ws.derivws.com/websockets/v3",
  capital: "https://demo-api-capital.backend-capital.com",
  ctrader: "wss://demo.ctraderapi.com:5036",
  oanda: "https://api-fxpractice.oanda.com"
} as const;
