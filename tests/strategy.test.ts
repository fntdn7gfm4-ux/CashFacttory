import { describe, expect, it } from "vitest";
import { defaultConfigs } from "../src/lib/config";
import { generateSignal } from "../src/lib/strategy";
import { Tick } from "../src/lib/types";

describe("signal generator", () => {
  it("preserves Deriv even/odd digit semantics", () => {
    const config = { ...defaultConfigs[0], strategy: { ...defaultConfigs[0].strategy, tickWindow: 5, threshold: 0.6, parity: "even" as const } };
    const ticks: Tick[] = [100.12, 100.24, 100.36, 100.47, 100.58].map((price, time) => ({ price, time }));
    const signal = generateSignal(config, ticks);
    expect(signal?.side).toBe("buy");
    expect(signal?.confidence).toBe(0.8);
  });

  it("does not invent digit parity for Capital", () => {
    const config = { ...defaultConfigs[1], strategy: { ...defaultConfigs[1].strategy, tickWindow: 5, threshold: 0.7 } };
    const ticks = [1, 1.01, 1.02, 1.03, 1.04].map((price, time) => ({ price, time }));
    const signal = generateSignal(config, ticks);
    expect(signal?.side).toBe("sell");
    expect(signal?.reason).toContain("desequilíbrio");
  });
});
