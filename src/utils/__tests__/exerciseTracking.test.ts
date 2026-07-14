import {
  normalizeTrackingMode,
  inferTrackingModeFromExerciseDefinition,
  getTrackingModeLabel,
  normalizeSetForTrackingMode,
} from "@/utils/exerciseTracking";
import type { WorkoutSet } from "@/types";

describe("normalizeTrackingMode", () => {
  it("passes through 'timed' and 'cardio' unchanged", () => {
    expect(normalizeTrackingMode("timed")).toBe("timed");
    expect(normalizeTrackingMode("cardio")).toBe("cardio");
  });

  it("passes through 'strength' unchanged", () => {
    expect(normalizeTrackingMode("strength")).toBe("strength");
  });

  it("defaults any other value (including undefined/null) to 'strength'", () => {
    expect(normalizeTrackingMode("bogus")).toBe("strength");
    expect(normalizeTrackingMode(undefined)).toBe("strength");
    expect(normalizeTrackingMode(null)).toBe("strength");
    expect(normalizeTrackingMode(123)).toBe("strength");
  });
});

describe("inferTrackingModeFromExerciseDefinition", () => {
  it("infers 'timed' for known timed catalog ids", () => {
    expect(inferTrackingModeFromExerciseDefinition({ id: "plank" })).toBe("timed");
  });

  it("infers 'cardio' for known cardio catalog ids", () => {
    expect(inferTrackingModeFromExerciseDefinition({ id: "run" })).toBe("cardio");
  });

  it("defaults to 'strength' for any other id", () => {
    expect(inferTrackingModeFromExerciseDefinition({ id: "barbell-bench-press" })).toBe("strength");
  });

  it("defaults to 'strength' when the definition is null/undefined or has no id", () => {
    expect(inferTrackingModeFromExerciseDefinition(null)).toBe("strength");
    expect(inferTrackingModeFromExerciseDefinition(undefined)).toBe("strength");
    expect(inferTrackingModeFromExerciseDefinition({ id: "" })).toBe("strength");
    expect(inferTrackingModeFromExerciseDefinition({ id: "   " })).toBe("strength");
  });
});

describe("getTrackingModeLabel", () => {
  it("returns the human-readable label for each mode", () => {
    expect(getTrackingModeLabel("strength")).toBe("Strength");
    expect(getTrackingModeLabel("timed")).toBe("Timed");
    expect(getTrackingModeLabel("cardio")).toBe("Cardio");
  });
});

describe("normalizeSetForTrackingMode", () => {
  const baseSet: WorkoutSet = { id: "s1", weight: 40, reps: 8, type: "working" };

  it("clears weight/reps/distance for 'timed' mode, keeping a numeric durationSeconds", () => {
    const result = normalizeSetForTrackingMode({ ...baseSet, durationSeconds: 30 }, "timed");
    expect(result).toEqual({ id: "s1", type: "working", weight: null, reps: null, durationSeconds: 30, distance: null });
  });

  it("nulls durationSeconds for 'timed' mode when it isn't a number", () => {
    const result = normalizeSetForTrackingMode(baseSet, "timed");
    expect(result.durationSeconds).toBeNull();
  });

  it("clears weight/reps for 'cardio' mode, keeping numeric durationSeconds and distance", () => {
    const result = normalizeSetForTrackingMode({ ...baseSet, durationSeconds: 600, distance: 5 }, "cardio");
    expect(result).toEqual({ id: "s1", type: "working", weight: null, reps: null, durationSeconds: 600, distance: 5 });
  });

  it("clears durationSeconds/distance for 'strength' mode and keeps numeric weight/reps", () => {
    const result = normalizeSetForTrackingMode(baseSet, "strength");
    expect(result).toEqual({ id: "s1", type: "working", weight: 40, reps: 8, durationSeconds: null, distance: null });
  });

  it("falls back to initialWeight for 'strength' mode when the set's weight isn't a number", () => {
    const result = normalizeSetForTrackingMode({ ...baseSet, weight: null }, "strength", 20);
    expect(result.weight).toBe(20);
  });

  it("nulls reps for 'strength' mode when reps isn't a number", () => {
    const result = normalizeSetForTrackingMode({ ...baseSet, reps: null as any }, "strength");
    expect(result.reps).toBeNull();
  });

  it("treats an unrecognized trackingMode as 'strength' via normalizeTrackingMode", () => {
    const result = normalizeSetForTrackingMode(baseSet, "bogus" as any);
    expect(result).toEqual({ id: "s1", type: "working", weight: 40, reps: 8, durationSeconds: null, distance: null });
  });
});
