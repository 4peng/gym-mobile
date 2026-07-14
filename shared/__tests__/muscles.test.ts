import {
  expandPrimaryMusclesForDetailedMode,
  collapseDetailedMusclesToPrimary,
  PRIMARY_TO_DETAILED_MAP,
  DETAILED_TO_PRIMARY_MAP,
  PRIMARY_MUSCLE_GROUPS,
  DETAILED_MODE_MUSCLE_GROUPS,
  // eslint-disable-next-line @typescript-eslint/no-var-requires
} from "../muscles.js";

// Pins down the primary<->detailed muscle expansion/collapse round-trip and
// documents that PRIMARY_TO_DETAILED_MAP is intentionally partial (only
// shoulder/back/arms have detailed sub-groups; everything else passes through
// unchanged).

describe("PRIMARY_TO_DETAILED_MAP partiality", () => {
  it("only defines detailed sub-groups for shoulder, back, and arms", () => {
    expect(Object.keys(PRIMARY_TO_DETAILED_MAP).sort()).toEqual(["arms", "back", "shoulder"]);
  });

  it("has no entry for primary groups like chest/core/glutes/etc", () => {
    expect("chest" in PRIMARY_TO_DETAILED_MAP).toBe(false);
    expect((PRIMARY_TO_DETAILED_MAP as any).chest).toBeUndefined();
  });
});

describe("expandPrimaryMusclesForDetailedMode", () => {
  it("expands a mapped primary muscle into its detailed sub-groups", () => {
    expect(expandPrimaryMusclesForDetailedMode(["shoulder"])).toEqual([
      "front_delts",
      "side_delts",
      "rear_delts",
    ]);
  });

  it("passes through an unmapped primary muscle unchanged", () => {
    expect(expandPrimaryMusclesForDetailedMode(["chest"])).toEqual(["chest"]);
  });

  it("expands mixed mapped/unmapped muscles and dedupes the result", () => {
    expect(expandPrimaryMusclesForDetailedMode(["shoulder", "chest"])).toEqual([
      "front_delts",
      "side_delts",
      "rear_delts",
      "chest",
    ]);
    expect(expandPrimaryMusclesForDetailedMode(["back", "arms", "back"])).toEqual([
      "upper_back",
      "lats",
      "lower_back",
      "biceps",
      "triceps",
      "forearms",
    ]);
  });

  it("returns [] for []", () => {
    expect(expandPrimaryMusclesForDetailedMode([])).toEqual([]);
  });
});

describe("collapseDetailedMusclesToPrimary", () => {
  it("collapses a detailed sub-group back to its primary group", () => {
    expect(collapseDetailedMusclesToPrimary(["front_delts"])).toEqual(["shoulder"]);
  });

  it("passes through a value with no reverse mapping unchanged (e.g. already-primary 'chest')", () => {
    expect(collapseDetailedMusclesToPrimary(["chest"])).toEqual(["chest"]);
  });

  it("collapses and dedupes multiple detailed groups that share a primary group", () => {
    expect(collapseDetailedMusclesToPrimary(["front_delts", "side_delts"])).toEqual(["shoulder"]);
    expect(collapseDetailedMusclesToPrimary(["front_delts", "lats", "chest"])).toEqual([
      "shoulder",
      "back",
      "chest",
    ]);
  });
});

describe("expand -> collapse round-trip", () => {
  it("collapsing an expansion of a mapped primary group returns the original single group", () => {
    for (const primary of Object.keys(PRIMARY_TO_DETAILED_MAP)) {
      const expanded = expandPrimaryMusclesForDetailedMode([primary]);
      expect(collapseDetailedMusclesToPrimary(expanded)).toEqual([primary]);
    }
  });

  it("round-trips every unmapped primary muscle group as a no-op", () => {
    const unmapped = PRIMARY_MUSCLE_GROUPS.filter((m) => !(m in PRIMARY_TO_DETAILED_MAP));
    expect(collapseDetailedMusclesToPrimary(expandPrimaryMusclesForDetailedMode(unmapped))).toEqual(
      unmapped
    );
  });
});

describe("DETAILED_MODE_MUSCLE_GROUPS", () => {
  it("is the flat expansion of every primary group in order, mapped ones replaced by their detailed groups", () => {
    expect(DETAILED_MODE_MUSCLE_GROUPS).toEqual(
      PRIMARY_MUSCLE_GROUPS.flatMap((m) => (PRIMARY_TO_DETAILED_MAP as any)[m] ?? [m])
    );
  });

  it("every DETAILED_TO_PRIMARY_MAP key appears somewhere in DETAILED_MODE_MUSCLE_GROUPS", () => {
    for (const detailed of Object.keys(DETAILED_TO_PRIMARY_MAP)) {
      expect(DETAILED_MODE_MUSCLE_GROUPS).toContain(detailed);
    }
  });
});
