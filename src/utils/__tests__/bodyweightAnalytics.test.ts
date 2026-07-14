import { isBodyweightStrengthExercise, resolveEffectiveStrengthLoad } from "@/utils/bodyweightAnalytics";

// Pins down current bodyweight-detection and load-resolution rules
// (isBodyweight flag, catalog id set, name-pattern fallback, and how the
// analytics bodyweight is combined with logged "extra" load across units).

describe("isBodyweightStrengthExercise", () => {
  it("returns true when the exercise carries an explicit isBodyweight flag, even for an unrelated name", () => {
    expect(isBodyweightStrengthExercise({ name: "Random", isBodyweight: true } as any)).toBe(true);
  });

  it("returns true for known bodyweight catalog ids resolved through identity normalization", () => {
    expect(isBodyweightStrengthExercise({ name: "Push-Up" } as any)).toBe(true);
    expect(isBodyweightStrengthExercise({ exerciseDefinitionId: "pull-up", name: "x" } as any)).toBe(true);
  });

  it("returns true for name-pattern matches not in the explicit id set (e.g. plural 'Dips')", () => {
    expect(isBodyweightStrengthExercise({ name: "Dips" } as any)).toBe(true);
  });

  it("returns false for loaded/equipment exercises", () => {
    expect(isBodyweightStrengthExercise({ name: "Barbell Bench Press" } as any)).toBe(false);
  });
});

describe("resolveEffectiveStrengthLoad", () => {
  it("converts logged weight units for a non-bodyweight exercise", () => {
    // 100kg -> lbs: 100 * 2.20462 = 220.462, rounded to nearest 0.5 = 220.5
    expect(
      resolveEffectiveStrengthLoad({ name: "Barbell Bench Press" } as any, 100, "kg", "lbs", null, "kg")
    ).toBe(220.5);
  });

  it("passes through a null logged weight unconverted for a non-bodyweight exercise", () => {
    expect(
      resolveEffectiveStrengthLoad({ name: "Barbell Bench Press" } as any, null, "kg", "lbs", null, "kg")
    ).toBeNull();
  });

  it("returns 0 for a bodyweight exercise with no logged extra weight and no analytics bodyweight", () => {
    expect(
      resolveEffectiveStrengthLoad({ name: "Push-Up" } as any, null, "kg", "kg", null, "kg")
    ).toBe(0);
  });

  it("returns just the extra load for a bodyweight exercise when analytics bodyweight is unavailable", () => {
    expect(
      resolveEffectiveStrengthLoad({ name: "Weighted Dip" } as any, 20, "kg", "kg", null, "kg")
    ).toBe(20);
  });

  it("returns the analytics bodyweight alone when there is no extra logged load", () => {
    expect(
      resolveEffectiveStrengthLoad({ name: "Push-Up" } as any, null, "kg", "kg", 80, "kg")
    ).toBe(80);
  });

  it("sums converted bodyweight and converted extra load, both normalized to the target unit", () => {
    // extra: 10kg -> lbs = 10*2.20462=22.0462 -> round to 0.5 -> 22
    // bodyweight: 80kg -> lbs = 80*2.20462=176.3696 -> round to 0.5 -> 176.5
    // total: 176.5 + 22 = 198.5
    expect(
      resolveEffectiveStrengthLoad({ name: "Weighted Dip" } as any, 10, "kg", "lbs", 80, "kg")
    ).toBe(198.5);
  });
});
