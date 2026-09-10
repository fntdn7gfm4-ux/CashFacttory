import { describe, expect, it } from "vitest";
import { nextMartingaleLevel, nextParity, targetReached } from "../src/components/ParityLab";

describe("Parity basket safeguards", () => {
  it("alternates even and odd after every contract", () => {
    expect(nextParity("even")).toBe("odd");
    expect(nextParity("odd")).toBe("even");
  });

  it("never advances martingale beyond level two", () => {
    expect(nextMartingaleLevel(0, false)).toBe(1);
    expect(nextMartingaleLevel(1, false)).toBe(2);
    expect(nextMartingaleLevel(2, false)).toBe(0);
    expect(nextMartingaleLevel(2, true)).toBe(0);
  });

  it("stops only when a positive target is reached", () => {
    expect(targetReached(1, 1)).toBe(true);
    expect(targetReached(0.99, 1)).toBe(false);
    expect(targetReached(0, 0)).toBe(false);
  });
});
