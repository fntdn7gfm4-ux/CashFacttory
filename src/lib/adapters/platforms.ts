import { DerivPaperAdapter, TradingAdapter } from "./base";
import { BotId, Tick, TradingMode } from "../types";

class DerivPublicPaperAdapter extends DerivPaperAdapter {
  private socket?: WebSocket;
  private subscribedSymbol?: string;
  private pending?: { resolve: (tick: Tick) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

  async disconnect() {
    this.pending?.reject(new Error("Conexão Deriv encerrada"));
    if (this.socket) this.socket.close();
    this.socket = undefined;
    this.subscribedSymbol = undefined;
    await super.disconnect();
  }

  async getTick(symbol: string): Promise<Tick> {
    if (!this.connected) throw new Error("Conector Deriv desconectado");
    if (typeof WebSocket === "undefined") return super.getTick(symbol);
    if (this.subscribedSymbol && this.subscribedSymbol !== symbol) {
      this.socket?.close();
      this.socket = undefined;
    }
    this.subscribedSymbol = symbol;

    return new Promise<Tick>((resolve, reject) => {
      const timer = setTimeout(async () => {
        this.pending = undefined;
        try { resolve(await super.getTick(symbol)); } catch (error) { reject(error as Error); }
      }, 3500);
      this.pending = { resolve, reject, timer };

      if (this.socket?.readyState === WebSocket.OPEN) return;
      this.socket = new WebSocket(derivEndpoints.public);
      this.socket.onopen = () => this.socket?.send(JSON.stringify({ ticks: symbol, subscribe: 1, req_id: 1 }));
      this.socket.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as { msg_type?: string; tick?: { quote?: number; epoch?: number }; error?: { message?: string } };
        if (message.error) {
          clearTimeout(this.pending?.timer);
          const current = this.pending;
          this.pending = undefined;
          current?.reject(new Error(message.error.message ?? "Erro no feed público Deriv"));
          return;
        }
        if (message.msg_type !== "tick" || typeof message.tick?.quote !== "number" || !this.pending) return;
        clearTimeout(this.pending.timer);
        const current = this.pending;
        this.pending = undefined;
        current.resolve({ time: (message.tick.epoch ?? Math.floor(Date.now() / 1000)) * 1000, price: message.tick.quote, source: "deriv-public" });
      };
      this.socket.onerror = () => {
        if (!this.pending) return;
        clearTimeout(this.pending.timer);
        const current = this.pending;
        this.pending = undefined;
        super.getTick(symbol).then(current.resolve, current.reject);
      };
    });
  }
}

export const derivEndpoints = {
  rest: "https://api.derivws.com",
  public: "wss://api.derivws.com/trading/v1/options/ws/public",
  demo: "wss://api.derivws.com/trading/v1/options/ws/demo?otp=ONE_TIME_PASSWORD",
  live: "wss://api.derivws.com/trading/v1/options/ws/real?otp=ONE_TIME_PASSWORD",
  oauth: "https://auth.deriv.com/oauth2/auth"
} as const;

export function createAdapter(_botId: BotId, mode: TradingMode = "paper", executionBridgeReady = false): TradingAdapter {
  if (mode !== "paper" && !executionBridgeReady) {
    throw new Error(`Modo ${mode} bloqueado: aprovação, OAuth e executor seguro ainda não foram validados.`);
  }
  // Public Deriv ticks are available without auth; order execution stays simulated in PAPER.
  // Demo/live use a short-lived OTP URL issued server-side after OAuth/PAT authentication.
  return new DerivPublicPaperAdapter();
}

export const integrationPolicy = {
  broker: "Deriv",
  provider: "Deriv Options API",
  tradingUrl: "https://app.deriv.com/",
  secretsInBrowser: false,
  defaultMode: "paper" as const,
  demoRequires: ["oauth-or-pat", "demo-account", "otp"],
  liveRequires: ["oauth-or-pat", "real-account", "otp", "demo-validation", "explicit-live-unlock"]
};
