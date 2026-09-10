import { describe, expect, it } from "vitest";
import { defaultConfigs } from "../src/lib/config";
import { assessRisk } from "../src/lib/risk";
import { initialRuntime } from "../src/lib/simulator";

describe("risk engine", () => {
  it("blocks after daily stop", () => {
    const config = defaultConfigs[0];
    const runtime = { ...initialRuntime(config), pnl: -config.risk.dailyStop };
    expect(assessRisk(config, runtime).reason).toBe("Stop diário atingido");
  });

  it("blocks oversized stake", () => {
    const config = { ...defaultConfigs[1], risk: { ...defaultConfigs[1].risk, stake: 20, maxStake: 5 } };
    expect(assessRisk(config, initialRuntime(config)).allowed).toBe(false);
  });

  it("enforces cooldown", () => {
    const config = defaultConfigs[2];
    const runtime = { ...initialRuntime(config), lastTradeAt: Date.now() };
    expect(assessRisk(config, runtime).reason).toBe("Cooldown ativo");
  });
});
