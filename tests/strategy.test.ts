import { describe, expect, it } from "vitest";
import { defaultConfigs } from "../src/lib/config";
import { generateSignal } from "../src/lib/strategy";
import { Tick } from "../src/lib/types";

const ticks = (prices: number[]): Tick[] => prices.map((price, time) => ({ price, time }));

describe("cTrader strategy signals", () => {
  it("preserves the original Microflow settings and detects efficient momentum", () => {
    const config = { ...defaultConfigs[0], strategy: { ...defaultConfigs[0].strategy, minimumVolatilityPips: 0 } };
    expect(config.strategy).toMatchObject({ symbol: "EURUSD", tickWindow: 16, threshold: 0.66, holdTicks: 5 });
    const prices = Array.from({ length: 16 }, (_, index) => 1.08 + index * 0.0001 + (index % 3) * 0.00001);
    expect(generateSignal(config, ticks(prices))?.side).toBe("buy");
  });

  it("reverts an extreme price only in a low-efficiency window", () => {
    const config = { ...defaultConfigs[1], strategy: { ...defaultConfigs[1].strategy, tickWindow: 10, threshold: 1.2, minimumVolatilityPips: 0 } };
    const signal = generateSignal(config, ticks([1, 1.0002, 0.9999, 1.0001, 0.9998, 1.0002, 0.9999, 1.0001, 1.0000, 1.0008]));
    expect(signal?.side).toBe("sell");
    expect(signal?.reason).toContain("regime lateral");
  });

  it("requires expansion and a range break for breakout", () => {
    const config = { ...defaultConfigs[2], strategy: { ...defaultConfigs[2].strategy, tickWindow: 20, threshold: 0.6, minimumVolatilityPips: 0 } };
    const base = Array.from({ length: 14 }, (_, index) => 1 + (index % 2 ? 0.000002 : -0.000002));
    const signal = generateSignal(config, ticks([...base, 1.00001, 1.00007, 1.00014, 1.00025, 1.00038, 1.00054]));
    expect(signal?.side).toBe("buy");
  });

  it("waits for a pullback and resumption", () => {
    const config = { ...defaultConfigs[3], strategy: { ...defaultConfigs[3].strategy, tickWindow: 32, threshold: 0.2, minimumVolatilityPips: 0 } };
    const trend = Array.from({ length: 28 }, (_, index) => 1 + index * 0.00009);
    const signal = generateSignal(config, ticks([...trend, trend.at(-1)! + 0.00008, trend.at(-1)! - 0.00004, trend.at(-1)! - 0.00013, trend.at(-1)! + 0.00012]));
    expect(signal?.side).toBe("buy");
  });
});
