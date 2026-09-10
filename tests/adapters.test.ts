import { describe, expect, it } from "vitest";
import { createAdapter, demoEndpoints } from "../src/lib/adapters/platforms";

describe("platform adapters", () => {
  it.each(["deriv", "capital", "ctrader", "oanda"] as const)("defaults %s to paper mode", async (platform) => {
    const adapter = createAdapter(platform);
    expect(adapter.environment).toBe("paper");
    expect(adapter.platform).toBe(platform);
    await expect(adapter.getTick("TEST")).rejects.toThrow("desconectado");
  });

  it("contains demo endpoints only", () => {
    expect(demoEndpoints.capital).toContain("demo");
    expect(demoEndpoints.ctrader).toContain("demo");
    expect(demoEndpoints.oanda).toContain("practice");
  });
});
