import { resolveExercisePlaceholders, resolveSetOnComplete } from "@/utils/placeholders";
import type { WorkoutSession, WorkoutSet } from "@/types";

// Pins down resolveExercisePlaceholders's two-pass algorithm: (1) seed from
// the most recent completed history match by identity key, positionally
// mapped (padding with the last historical set for extra current sets), then
// (2) fill-forward any value the user has already typed in the current
// session over subsequent un-filled placeholders.

function historySession(): WorkoutSession {
  return {
    _id: "s1",
    userId: "u1",
    startedAt: "2026-01-01T09:00:00.000Z",
    completedAt: "2026-01-01T10:00:00.000Z",
    updatedAt: 1,
    notes: "",
    exercises: [
      {
        id: "e1",
        exerciseDefinitionId: "barbell-bench-press",
        trackingMode: "strength",
        name: "Barbell Bench Press",
        restSeconds: 90,
        notes: "",
        weightUnit: "kg",
        muscles: ["chest"],
        sets: [
          { id: "st1", weight: 100, reps: 10 },
          { id: "st2", weight: 105, reps: 8 },
          { id: "st3", weight: 110, reps: 6 },
        ],
      },
    ],
  };
}

describe("resolveExercisePlaceholders", () => {
  it("seeds from history positionally and pads extra sets with the last historical set", () => {
    const currentSets: WorkoutSet[] = [
      { id: "c1", weight: null, reps: null },
      { id: "c2", weight: null, reps: null },
      { id: "c3", weight: null, reps: null },
      { id: "c4", weight: null, reps: null }, // beyond history length -> pads with last set
    ];

    const result = resolveExercisePlaceholders("barbell-bench-press", currentSets, [historySession()], "kg");

    expect(result).toEqual([
      { weight: 100, reps: 10 },
      { weight: 105, reps: 8 },
      { weight: 110, reps: 6 },
      { weight: 110, reps: 6 },
    ]);
  });

  it("fill-forwards a value the user typed into the current session over subsequent placeholders, without re-converting units", () => {
    const currentSets: WorkoutSet[] = [
      { id: "c1", weight: null, reps: null },
      { id: "c2", weight: 50, reps: null }, // user typed 50 for set 2; own placeholder is untouched
      { id: "c3", weight: null, reps: null }, // gets overridden to 50 (fill-forward), reps kept from history
      { id: "c4", weight: null, reps: null },
    ];

    const result = resolveExercisePlaceholders("barbell-bench-press", currentSets, [historySession()], "kg");

    expect(result).toEqual([
      { weight: 100, reps: 10 },
      { weight: 105, reps: 8 }, // unaffected by the user's own entry at this index
      { weight: 50, reps: 6 },
      { weight: 50, reps: 6 },
    ]);
  });

  it("converts weight units when target unit differs from the historical entry's unit", () => {
    const currentSets: WorkoutSet[] = [{ id: "c1", weight: null, reps: null }];
    const result = resolveExercisePlaceholders("barbell-bench-press", currentSets, [historySession()], "lbs");
    // 100kg -> lbs: 100*2.20462=220.462 -> round to nearest 0.5 -> 220.5
    expect(result).toEqual([{ weight: 220.5, reps: 10 }]);
  });

  it("returns all-null placeholders when there is no matching exercise in history", () => {
    const currentSets: WorkoutSet[] = [
      { id: "c1", weight: null, reps: null },
      { id: "c2", weight: 50, reps: null },
    ];
    const result = resolveExercisePlaceholders("some-unknown-exercise", currentSets, [historySession()], "kg");
    expect(result).toEqual([
      { weight: null, reps: null },
      { weight: null, reps: null },
    ]);
  });

  it("ignores sessions without a completedAt (in-progress/abandoned)", () => {
    const inProgress: WorkoutSession = { ...historySession(), _id: "s2", completedAt: undefined };
    const currentSets: WorkoutSet[] = [{ id: "c1", weight: null, reps: null }];
    const result = resolveExercisePlaceholders("barbell-bench-press", currentSets, [inProgress], "kg");
    expect(result).toEqual([{ weight: null, reps: null }]);
  });

  it("returns an empty array when there are no current sets", () => {
    const result = resolveExercisePlaceholders("barbell-bench-press", [], [historySession()], "kg");
    expect(result).toEqual([]);
  });
});

describe("resolveSetOnComplete", () => {
  it("prefers the current set's own value over the placeholder", () => {
    expect(resolveSetOnComplete({ id: "c1", weight: 50, reps: 5 } as WorkoutSet, { weight: 100, reps: 10 })).toEqual({
      weight: 50,
      reps: 5,
    });
  });

  it("falls back to the placeholder when the current set is untouched", () => {
    expect(
      resolveSetOnComplete({ id: "c1", weight: null, reps: null } as WorkoutSet, { weight: 100, reps: 10 })
    ).toEqual({ weight: 100, reps: 10 });
  });

  it("falls back to 0 when both the current set and the placeholder are null", () => {
    expect(
      resolveSetOnComplete({ id: "c1", weight: null, reps: null } as WorkoutSet, { weight: null, reps: null })
    ).toEqual({ weight: 0, reps: 0 });
  });
});
