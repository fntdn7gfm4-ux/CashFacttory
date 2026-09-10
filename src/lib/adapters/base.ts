import { Order, Platform, Side, Tick } from "../types";

export interface PlaceOrderInput { symbol: string; side: Side; size: number; price: number }
export interface TradingAdapter {
  readonly platform: Platform;
  readonly environment: "paper" | "demo";
  connect(): Promise<{ connected: true; balance: number }>;
  disconnect(): Promise<void>;
  getTick(symbol: string): Promise<Tick>;
  placeOrder(input: PlaceOrderInput): Promise<Order>;
}

export abstract class PaperAdapter implements TradingAdapter {
  abstract readonly platform: Platform;
  readonly environment = "paper" as const;
  protected balance = 10000;
  protected connected = false;
  private price = 1.085;

  async connect() {
    this.connected = true;
    return { connected: true as const, balance: this.balance };
  }

  async disconnect() { this.connected = false; }

  async getTick(_symbol: string): Promise<Tick> {
    if (!this.connected) throw new Error("Adapter desconectado");
    this.price += (Math.random() - 0.5) * 0.0007;
    return { time: Date.now(), price: Number(this.price.toFixed(5)) };
  }

  async placeOrder(input: PlaceOrderInput): Promise<Order> {
    if (!this.connected) throw new Error("Adapter desconectado");
    const exit = input.price + (Math.random() - 0.48) * 0.0008;
    const direction = input.side === "buy" ? 1 : -1;
    const pnl = Number((direction * (exit - input.price) * 10000 * input.size).toFixed(2));
    this.balance += pnl;
    return {
      id: crypto.randomUUID(), platform: this.platform, symbol: input.symbol,
      side: input.side, size: input.size, entry: input.price, exit,
      pnl, openedAt: Date.now() - 900, closedAt: Date.now(), status: "closed", mode: "PAPER"
    };
  }
}
