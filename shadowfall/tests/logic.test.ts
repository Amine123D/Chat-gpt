import { describe, expect, it } from "vitest";
import { damage, need } from "../src/logic";

describe("combat damage", () => {
  it("always deals at least one damage", () => {
    expect(damage(0)).toBe(1);
    expect(damage(10, 100)).toBe(1);
  });
  it("applies defense and critical hits", () => {
    expect(damage(12, 2)).toBe(10);
    expect(damage(10, 0, true)).toBe(16);
  });
  it("handles invalid numbers safely", () => {
    expect(damage(Number.NaN)).toBe(1);
    expect(damage(8, Number.NaN)).toBe(8);
  });
});

describe("level progression", () => {
  it("increases the XP requirement with level", () => {
    expect(need(1)).toBe(65);
    expect(need(2)).toBe(90);
  });
  it("normalizes invalid or low levels", () => {
    expect(need(0)).toBe(65);
    expect(need(Number.NaN)).toBe(65);
  });
});
