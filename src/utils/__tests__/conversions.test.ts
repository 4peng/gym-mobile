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
});
