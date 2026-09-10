import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index.js";

describe("Deriv server bridge", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lets the OTP endpoint validate a real account without assuming a status label", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (String(url).endsWith("/accounts")) {
        return new Response(JSON.stringify({ data: [{ account_id: "real-test", account_type: "real", currency: "USD", balance: 0 }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: { url: "wss://api.derivws.com/trading/v1/options/ws/real?otp=test" } }), { status: 200 });
    }));
    const env = { DERIV_ACCESS_TOKEN: "test-token", DERIV_APP_ID: "test-app", DERIV_DEMO_VALIDATED: "true", DERIV_LIVE_UNLOCKED: "true", ASSETS: { fetch: vi.fn() } };
    const response = await worker.fetch(new Request("https://example.test/api/deriv/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "live", confirmation: "ATIVAR REAL" }),
    }), env);

    expect(response.status, await response.clone().text()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ mode: "live" });
  });
});
