import { describe, expect, it } from "vitest";
import { defaultConfigs } from "../src/lib/config";
import { createAdapter, derivEndpoints, integrationPolicy } from "../src/lib/adapters/platforms";

describe("Deriv direct adapter boundary", () => {
  it.each(defaultConfigs)("defaults $name to Deriv paper mode", async (config) => {
    const adapter = createAdapter(config.id);
    expect(adapter.environment).toBe("paper");
    expect(adapter.platform).toBe("deriv");
    await expect(adapter.getTick("EURUSD")).rejects.toThrow("desconectado");
  });

  it("keeps public, demo and real on separate official Deriv endpoints", () => {
    expect(derivEndpoints.public).toContain("/ws/public");
    expect(derivEndpoints.demo).toContain("/ws/demo?otp=");
    expect(derivEndpoints.live).toContain("/ws/real?otp=");
    expect(integrationPolicy.secretsInBrowser).toBe(false);
  });

  it("blocks external modes before the secure bridge is ready", () => {
    expect(() => createAdapter("microflow", "demo")).toThrow("bloqueado");
    expect(() => createAdapter("microflow", "live")).toThrow("bloqueado");
  });
});
