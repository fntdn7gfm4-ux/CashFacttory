import { describe, expect, it } from "vitest";
import { clampParityDuration, createParityRows, lossLimitReached, nextMartingaleLevel, parityMarkets, targetReached } from "../src/components/ParityLab";

describe("Parity basket safeguards", () => {
  it("creates one enabled bot for each supported EVEN/ODD market", () => {
    const rows = createParityRows();
    expect(rows).toHaveLength(parityMarkets.length);
    expect(rows).toHaveLength(15);
    expect(rows.every((row) => row.enabled)).toBe(true);
    expect(clampParityDuration(0)).toBe(1);
    expect(clampParityDuration(20)).toBe(10);
  });
  it("never advances martingale beyond the default level two", () => {
    expect(nextMartingaleLevel(0, false)).toBe(1);
    expect(nextMartingaleLevel(1, false)).toBe(2);
    expect(nextMartingaleLevel(2, false)).toBe(0);
    expect(nextMartingaleLevel(2, true)).toBe(0);
  });

  it("respects a configurable martingale ceiling", () => {
    expect(nextMartingaleLevel(0, false, 0)).toBe(0);
    expect(nextMartingaleLevel(0, false, 1)).toBe(1);
    expect(nextMartingaleLevel(1, false, 1)).toBe(0);
    expect(nextMartingaleLevel(3, false, 5)).toBe(4);
    expect(nextMartingaleLevel(5, false, 5)).toBe(0);
  });

  it("stops only when a positive target is reached", () => {
    expect(targetReached(1, 1)).toBe(true);
    expect(targetReached(0.99, 1)).toBe(false);
    expect(targetReached(0, 0)).toBe(false);
  });

  it("stops only when the loss limit is breached", () => {
    expect(lossLimitReached(-2, 2)).toBe(true);
    expect(lossLimitReached(-1.99, 2)).toBe(false);
    expect(lossLimitReached(-5, 0)).toBe(false);
  });
});
