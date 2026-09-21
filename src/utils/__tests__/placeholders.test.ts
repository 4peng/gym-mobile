import { resolveExercisePlaceholders, resolveSetOnComplete } from "@/utils/placeholders";
import type { WorkoutExercise, WorkoutSet } from "@/types";

// Two-pass algorithm: (1) seed from the most recent occurrence positionally
// (padding with its last set), then (2) fill-forward anything the user already
// typed in this session over later, still-empty placeholders.

const previous: WorkoutExercise = {
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
};
const empty = (id: string): WorkoutSet => ({ id, weight: null, reps: null });

describe("resolveExercisePlaceholders", () => {
  it("seeds positionally and pads extra sets with the last previous set", () => {
    expect(
      resolveExercisePlaceholders(
        [empty("c1"), empty("c2"), empty("c3"), empty("c4")],
        previous,
        "kg",
      ),
    ).toEqual([
      { weight: 100, reps: 10 },
      { weight: 105, reps: 8 },
      { weight: 110, reps: 6 },
      { weight: 110, reps: 6 },
    ]);
  });

  it("fill-forwards a typed value over later placeholders without touching its own row", () => {
    const sets: WorkoutSet[] = [
      empty("c1"),
      { id: "c2", weight: 50, reps: null },
      empty("c3"),
      empty("c4"),
    ];
    expect(resolveExercisePlaceholders(sets, previous, "kg")).toEqual([
      { weight: 100, reps: 10 },
      { weight: 105, reps: 8 },
      { weight: 50, reps: 6 },
      { weight: 50, reps: 6 },
    ]);
  });

  it("converts previous weights into the target unit", () => {
    expect(resolveExercisePlaceholders([empty("c1")], previous, "lbs")).toEqual([
      { weight: 220.5, reps: 10 },
    ]);
  });

  it("returns null placeholders (but still fill-forwards) without a previous occurrence", () => {
    expect(
      resolveExercisePlaceholders(
        [empty("c1"), { id: "c2", weight: 50, reps: null }, empty("c3")],
        null,
        "kg",
      ),
    ).toEqual([
      { weight: null, reps: null },
      { weight: null, reps: null },
      { weight: 50, reps: null },
    ]);
  });

  it("returns an empty array when there are no current sets", () => {
    expect(resolveExercisePlaceholders([], previous, "kg")).toEqual([]);
  });
});

describe("resolveSetOnComplete", () => {
  it("prefers the set's own value, then the placeholder, then 0", () => {
    expect(
      resolveSetOnComplete({ id: "c", weight: 50, reps: 5 }, { weight: 100, reps: 10 }),
    ).toEqual({ weight: 50, reps: 5 });
    expect(resolveSetOnComplete(empty("c"), { weight: 100, reps: 10 })).toEqual({
      weight: 100,
      reps: 10,
    });
    expect(resolveSetOnComplete(empty("c"), { weight: null, reps: null })).toEqual({
      weight: 0,
      reps: 0,
    });
  });
});
