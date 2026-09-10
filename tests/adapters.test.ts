import { describe, expect, it } from "vitest";
import { defaultConfigs } from "../src/lib/config";
import { createAdapter, ctraderEndpoints, integrationPolicy } from "../src/lib/adapters/platforms";

describe("cTrader adapter boundary", () => {
  it.each(defaultConfigs)("defaults $name to cTrader paper mode", async (config) => {
    const adapter = createAdapter(config.id);
    expect(adapter.environment).toBe("paper");
    expect(adapter.platform).toBe("ctrader");
    await expect(adapter.getTick("EURUSD")).rejects.toThrow("desconectado");
  });

  it("keeps demo and live on separate official endpoints", () => {
    expect(ctraderEndpoints.demo).toContain("demo.ctraderapi.com");
    expect(ctraderEndpoints.live).toContain("live.ctraderapi.com");
    expect(integrationPolicy.secretsInBrowser).toBe(false);
  });

  it("blocks external modes before the secure bridge is ready", () => {
    expect(() => createAdapter("microflow", "demo")).toThrow("bloqueado");
    expect(() => createAdapter("microflow", "live")).toThrow("bloqueado");
  });
});
