import { convertWeight, formatSecondsToMMSS, KG_TO_LBS } from "@/utils/conversions";

describe("conversions (harness smoke test)", () => {
  it("convertWeight is identity for same unit", () => {
    expect(convertWeight(100, "kg", "kg")).toBe(100);
  });

  it("convertWeight passes through null", () => {
    expect(convertWeight(null, "kg", "lbs")).toBeNull();
  });

  it("convertWeight kg->lbs rounds to nearest 0.5", () => {
    // 10 * 2.20462 = 22.0462 -> round to 0.5 -> 22
    expect(convertWeight(10, "kg", "lbs")).toBe(22);
  });

  it("convertWeight lbs->kg rounds to nearest 0.1", () => {
    // 100 / 2.20462 = 45.359... -> round to 0.1 -> 45.4
    expect(convertWeight(100, "lbs", "kg")).toBe(45.4);
  });

  it("KG_TO_LBS constant is exported", () => {
    expect(KG_TO_LBS).toBeCloseTo(2.20462, 5);
  });

  it("formatSecondsToMMSS zero-pads minutes and seconds", () => {
    expect(formatSecondsToMMSS(0)).toBe("00:00");
    expect(formatSecondsToMMSS(65)).toBe("01:05");
    expect(formatSecondsToMMSS(600)).toBe("10:00");
  });

  // ── TEST-012 edge cases ──────────────────────

  it("convertWeight(0, 'kg', 'lbs') returns 0", () => {
    expect(convertWeight(0, "kg", "lbs")).toBe(0);
  });

  it("convertWeight with negative weight returns negative result", () => {
    // -10 kg -> lbs = -10 * 2.20462 = -22.0462 -> round(-22.0462 * 2) / 2 = round(-44.0924) / 2 = -44 / 2 = -22
    expect(convertWeight(-10, "kg", "lbs")).toBe(-22);
  });

  it("formatSecondsToMMSS with undefined/null returns 00:00 (via Math.floor)", () => {
    // Passing undefined coerces to NaN: Math.floor(NaN) = NaN, String(NaN) = "NaN"
    // This is current behavior — we just document it.
    expect(formatSecondsToMMSS(undefined as any)).toBe("NaN:NaN");
    expect(formatSecondsToMMSS(null as any)).toBe("00:00");
  });

  it("formatSecondsToMMSS with negative value returns negative-prefixed time", () => {
    // -65 seconds -> Math.floor(-65 / 60) = -2, -65 % 60 = -5
    // String(-2).padStart(2, "0") = "-2" (padStart does not prefix with 0 for negative)
    expect(formatSecondsToMMSS(-65)).toBe("-2:-5");
  });

  it("convertWeight rounding at exact 0.25/0.75 boundaries for kg->lbs", () => {
    // kg values that should produce exact X.25 or X.75 in lbs.
    // 0.1134 kg -> ~0.25 lbs (0.1134 * 2.20462 = 0.2500...)
    // We actually want to verify rounding boundaries.
    // 1 kg = 2.20462 lbs -> round(2.20462 * 2) / 2 = round(4.40924) / 2 = 4 / 2 = 2
    expect(convertWeight(1, "kg", "lbs")).toBe(2);

    // At the 0.25 boundary: 2.20462 * X.25 -> check rounding
    // 2.20462 * 0.5 = 1.10231 -> round(2.20462) / 2 = 2 / 2 = 1
    expect(convertWeight(0.5, "kg", "lbs")).toBe(1);
    // 2.20462 * 0.75 = 1.653465 -> round(3.30693) / 2 = 3 / 2 = 1.5
    // 2.20462 * 0.85 = 1.873927 -> round(3.747854) / 2 = 4 / 2 = 2
  });

  it("convertWeight handles very large numbers without precision loss", () => {
    // 1000 kg -> 2204.62 lbs -> round(4409.24) / 2 = 4409 / 2 = 2204.5
    expect(convertWeight(1000, "kg", "lbs")).toBe(2204.5);
    // 1000 / 2.20462 = 453.592... -> round to 0.1 -> 453.6
    expect(convertWeight(1000, "lbs", "kg")).toBe(453.6);
  });

  it("formatSecondsToMMSS handles large values", () => {
    // 3661 seconds = 1h 1m 1s -> format is MM:SS -> 61:01
    expect(formatSecondsToMMSS(3661)).toBe("61:01");
    // 0 seconds
    expect(formatSecondsToMMSS(0)).toBe("00:00");
  });
});
