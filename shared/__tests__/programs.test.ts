import {
  normalizeExercise,
  normalizeSets,
  validateRoutineDraft,
  copyExercises,
  DEFAULT_EXERCISE_SETS,
  DEFAULT_EXERCISE_REST_SECONDS,
  DEFAULT_WEIGHT_UNIT,
  DEFAULT_TRACKING_MODE,
} from "../programs.js";

// Pins down the shared program/exercise normalization utilities. These must
// never throw for any input shape and must produce deterministic defaults.

describe("normalizeExercise", () => {
  it("returns defaults when called with an empty object", () => {
    const result = normalizeExercise({} as any);
    expect(result.name).toBe("");
    expect(result.defaultSets).toEqual(DEFAULT_EXERCISE_SETS); // 3 working sets
    expect(result.restSeconds).toBe(DEFAULT_EXERCISE_REST_SECONDS); // 90
    expect(result.trackingMode).toBe(DEFAULT_TRACKING_MODE); // "strength"
    expect(result.weightUnit).toBe(DEFAULT_WEIGHT_UNIT); // "kg"
    expect(result.initialWeight).toBeNull();
    expect(result.notes).toBe("");
    expect(result.muscles).toEqual([]);
    expect(result.isBodyweight).toBe(false);
    expect(result.exerciseDefinitionId).toBe("");
    expect(typeof result.id).toBe("string");
  });

  it("returns defaults when called with null", () => {
    const result = normalizeExercise(null, undefined);
    expect(result.name).toBe("");
    expect(result.defaultSets).toHaveLength(3);
    expect(result.trackingMode).toBe("strength");
  });

  it("returns defaults when called with undefined", () => {
    const result = normalizeExercise(undefined, undefined);
    expect(result.name).toBe("");
    expect(result.defaultSets).toHaveLength(3);
    expect(result.trackingMode).toBe("strength");
  });

  it("passes through valid fields", () => {
    const result = normalizeExercise({
      name: " Bench Press ",
      trackingMode: "cardio",
      restSeconds: 120,
      weightUnit: "lbs",
      initialWeight: 100,
      isBodyweight: true,
      muscles: ["chest", "shoulder"],
      notes: "go heavy",
      exerciseDefinitionId: "bench-press",
    } as any);
    expect(result.name).toBe("Bench Press");
    expect(result.trackingMode).toBe("cardio");
    expect(result.restSeconds).toBe(120);
    expect(result.weightUnit).toBe("lbs");
    expect(result.initialWeight).toBe(100);
    expect(result.isBodyweight).toBe(true);
    expect(result.muscles).toEqual(["chest", "shoulder"]);
    expect(result.notes).toBe("go heavy");
    expect(result.exerciseDefinitionId).toBe("bench-press");
  });

  it("normalizes invalid tracking mode to 'strength'", () => {
    expect(normalizeExercise({ trackingMode: "bogus" } as any).trackingMode).toBe("strength");
    expect(normalizeExercise({ trackingMode: undefined } as any).trackingMode).toBe("strength");
    expect(normalizeExercise({ trackingMode: null } as any).trackingMode).toBe("strength");
  });

  it("coerces non-number restSeconds to default 90", () => {
    expect(normalizeExercise({ restSeconds: "abc" } as any).restSeconds).toBe(90);
    expect(normalizeExercise({ restSeconds: undefined } as any).restSeconds).toBe(90);
  });

  it("coerces negative numbers for restSeconds to 0", () => {
    expect(normalizeExercise({ restSeconds: -5 } as any).restSeconds).toBe(0);
  });

  it("defaults non-lbs weightUnit to 'kg'", () => {
    expect(normalizeExercise({ weightUnit: "lbs" } as any).weightUnit).toBe("lbs");
    expect(normalizeExercise({ weightUnit: "kg" } as any).weightUnit).toBe("kg");
    expect(normalizeExercise({ weightUnit: undefined } as any).weightUnit).toBe("kg");
    expect(normalizeExercise({ weightUnit: "stones" } as any).weightUnit).toBe("kg");
  });

  it("sanitizes initialWeight: empty string, null, negative become null", () => {
    expect(normalizeExercise({ initialWeight: "" } as any).initialWeight).toBeNull();
    expect(normalizeExercise({ initialWeight: null } as any).initialWeight).toBeNull();
    expect(normalizeExercise({ initialWeight: -10 } as any).initialWeight).toBeNull();
  });

  it("deduplicates and filters invalid muscles", () => {
    const result = normalizeExercise({
      muscles: ["chest", "", "chest", "shoulder"],
    } as any);
    expect(result.muscles).toEqual(["chest", "shoulder"]);
  });

  it("generates an id when missing", () => {
    const idFn = () => "gen-id-123";
    const result = normalizeExercise({} as any, idFn);
    expect(result.id).toBe("gen-id-123");
  });

  it("preserves existing id when present", () => {
    const result = normalizeExercise({ id: "ex-1" } as any, () => "new-id");
    expect(result.id).toBe("ex-1");
  });
});

describe("normalizeSets", () => {
  it("backfills a numeric count into working-set templates", () => {
    const result = normalizeSets(3);
    expect(result).toHaveLength(3);
    result.forEach((s: any) => expect(s.type).toBe("working"));
  });

  it("backfills count=0 to 1 working set (minimum)", () => {
    const result = normalizeSets(0);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("working");
  });

  it("backfills count=null to 1 working set (Number(null)=0, min=1)", () => {
    const result = normalizeSets(null);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("working");
  });

  it("backfills count=undefined to 3 working sets", () => {
    const result = normalizeSets(undefined);
    expect(result).toHaveLength(3);
  });

  it("preserves an array of valid set types", () => {
    const result = normalizeSets([{ type: "warmup" }, { type: "dropset" }, { type: "working" }]);
    expect(result).toEqual([
      { type: "warmup" },
      { type: "dropset" },
      { type: "working" },
    ]);
  });

  it("defaults invalid set types to 'working'", () => {
    const result = normalizeSets([{ type: "invalid" } as any, {} as any]);
    expect(result).toEqual([{ type: "working" }, { type: "working" }]);
  });

  it("filters null items in the array to 'working'", () => {
    const result = normalizeSets([null, undefined, { type: "warmup" }]);
    expect(result).toEqual([{ type: "working" }, { type: "working" }, { type: "warmup" }]);
  });

  it("returns 3 working sets for NaN count", () => {
    const result = normalizeSets(NaN);
    expect(result).toHaveLength(3);
  });
});

describe("validateRoutineDraft", () => {
  it("returns error for empty name", () => {
    const error = validateRoutineDraft("", [{ name: "Bench Press" }] as any);
    expect(error).toBe("Please enter a program name.");
  });

  it("returns error for whitespace-only name", () => {
    const error = validateRoutineDraft("   ", [{ name: "Bench Press" }] as any);
    expect(error).toBe("Please enter a program name.");
  });

  it("returns error for empty exercises array", () => {
    const error = validateRoutineDraft("Push Day", []);
    expect(error).toBe("Add at least one exercise before saving.");
  });

  it("returns error when an exercise has no name", () => {
    const error = validateRoutineDraft("Push Day", [{ name: "" }] as any);
    expect(error).toBe("Exercise 1 needs a name.");
  });

  it("returns error when second exercise has no name", () => {
    const error = validateRoutineDraft("Push Day", [
      { name: "Bench Press" },
      { name: "" },
    ] as any);
    expect(error).toBe("Exercise 2 needs a name.");
  });

  it("returns null for a valid draft", () => {
    const error = validateRoutineDraft("Push Day", [{ name: "Bench Press" }] as any);
    expect(error).toBeNull();
  });

  it("handles null/undefined exercises gracefully", () => {
    const error = validateRoutineDraft("Test", null as any);
    expect(error).toBe("Add at least one exercise before saving.");
  });
});

describe("copyExercises", () => {
  it("generates new IDs while preserving data fields", () => {
    let counter = 0;
    const idFn = () => `new-id-${++counter}`;
    const exercises = [
      { name: "Bench Press", restSeconds: 90 },
      { name: "Squat", restSeconds: 120 },
    ];

    const copies = copyExercises(exercises, idFn);
    expect(copies).toHaveLength(2);
    expect(copies[0].id).toBe("new-id-1");
    expect(copies[1].id).toBe("new-id-2");
    expect(copies[0].name).toBe("Bench Press");
    expect(copies[1].name).toBe("Squat");
    expect(copies[0].restSeconds).toBe(90);
    expect(copies[1].restSeconds).toBe(120);
  });

  it("returns empty array for non-array input", () => {
    expect(copyExercises(null, () => "x")).toEqual([]);
    expect(copyExercises(undefined, () => "x")).toEqual([]);
  });

  it("normalizes each copy", () => {
    const copies = copyExercises([{ trackingMode: "bogus" }] as any, () => "id-1");
    expect(copies[0].trackingMode).toBe("strength");
  });
});
