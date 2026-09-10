import { describe, expect, it } from "vitest";
import { defaultConfigs } from "../src/lib/config";
import { assessRisk, positionSize } from "../src/lib/risk";
import { initialRuntime } from "../src/lib/simulator";

describe("risk engine", () => {
  it("blocks after daily stop", () => {
    const config = defaultConfigs[0];
    const runtime = { ...initialRuntime(config), pnl: -config.risk.dailyStop };
    expect(assessRisk(config, runtime).reason).toBe("Stop diário atingido");
  });

  it("blocks risk above the configured ceiling", () => {
    const config = { ...defaultConfigs[1], risk: { ...defaultConfigs[1].risk, riskPerTrade: 2, maxRiskPerTrade: 1 } };
    expect(assessRisk(config, initialRuntime(config)).allowed).toBe(false);
  });

  it("enforces cooldown and sizes from stop distance", () => {
    const config = defaultConfigs[2];
    const runtime = { ...initialRuntime(config), lastTradeAt: Date.now() };
    expect(assessRisk(config, runtime).reason).toBe("Cooldown ativo");
    const expectedLots = Math.max(0.01, Number((config.risk.riskPerTrade / (config.strategy.stopLossPips * 10)).toFixed(2)));
    expect(positionSize(config, 1000)).toBe(expectedLots);
  });

  it("respects the verified EURUSD CT Deriv minimum volume", () => {
    const config = { ...defaultConfigs[0], risk: { ...defaultConfigs[0].risk, riskPerTrade: 0.01, maxRiskPerTrade: 1 } };
    expect(positionSize(config, 1000)).toBe(0.01);
  });
});
