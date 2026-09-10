import { BotId, Order, Side, Tick, TradingMode } from "../types";

export interface PlaceOrderInput { botId: BotId; symbol: string; side: Side; size: number; price: number }
export interface TradingAdapter {
  readonly platform: "ctrader";
  readonly environment: TradingMode;
  connect(): Promise<{ connected: true; balance: number }>;
  disconnect(): Promise<void>;
  getTick(symbol: string): Promise<Tick>;
  placeOrder(input: PlaceOrderInput): Promise<Order>;
}

export abstract class CTraderPaperAdapter implements TradingAdapter {
  readonly platform = "ctrader" as const;
  readonly environment = "paper" as const;
  protected balance = 1000;
  protected connected = false;
  private price = 1.085;

  async connect() { this.connected = true; return { connected: true as const, balance: this.balance }; }
  async disconnect() { this.connected = false; }

  async getTick(_symbol: string): Promise<Tick> {
    if (!this.connected) throw new Error("Conector cTrader desconectado");
    const move = (Math.random() - 0.49) * 0.00032;
    this.price += move;
    const spread = (0.55 + Math.random() * 0.45) * 0.0001;
    return { time: Date.now(), price: Number(this.price.toFixed(5)), bid: Number((this.price - spread / 2).toFixed(5)), ask: Number((this.price + spread / 2).toFixed(5)) };
  }

  async placeOrder(input: PlaceOrderInput): Promise<Order> {
    if (!this.connected) throw new Error("Conector cTrader desconectado");
    const exit = input.price + (Math.random() - 0.49) * 0.00065;
    const direction = input.side === "buy" ? 1 : -1;
    const costs = Number((input.size * 0.11).toFixed(2));
    const pnl = Number((direction * (exit - input.price) * 10000 * input.size * 10 - costs).toFixed(2));
    this.balance += pnl;
    return {
      id: crypto.randomUUID(), botId: input.botId, platform: "ctrader", symbol: input.symbol,
      side: input.side, size: input.size, entry: input.price, exit, pnl, costs,
      openedAt: Date.now() - 900, closedAt: Date.now(), status: "closed", mode: "paper"
    };
  }
}
