import {
  getExerciseIdentityKey,
  normalizeExerciseIdentityKey,
  matchesExerciseSearchQuery,
  normalizeExerciseDisplayName,
} from "@/utils/exerciseIdentity";

// Pins down current identity-key normalization behavior (catalog exact match,
// signature match, misspelling/typo rules, and the plain-text fallback) so a
// refactor of the lookup maps can't silently change matching behavior.

describe("normalizeExerciseIdentityKey", () => {
  it("maps a catalog name to the catalog id (exact match)", () => {
    expect(normalizeExerciseIdentityKey("Barbell Bench Press")).toBe("barbell-bench-press");
  });

  it("maps a catalog alias to the catalog id", () => {
    expect(normalizeExerciseIdentityKey("bench press")).toBe("barbell-bench-press");
    expect(normalizeExerciseIdentityKey("shoulder press")).toBe("overhead-press");
  });

  it("trims and lowercases before matching", () => {
    expect(normalizeExerciseIdentityKey("  Overhead Press  ")).toBe("overhead-press");
  });

  it("fixes common dumbbell misspellings", () => {
    expect(normalizeExerciseIdentityKey("dumbells")).toBe("dumbbell");
    expect(normalizeExerciseIdentityKey("dumbell")).toBe("dumbbell");
    expect(normalizeExerciseIdentityKey("dumbel")).toBe("dumbbell");
    expect(normalizeExerciseIdentityKey("Dumbell Curl")).toBe("dumbbell-curl");
  });

  it("normalizes pull-up/chin-up/push-up/dip spelling variants to the catalog id", () => {
    expect(normalizeExerciseIdentityKey("pull ups")).toBe("pull-up");
    expect(normalizeExerciseIdentityKey("pull-ups")).toBe("pull-up");
    expect(normalizeExerciseIdentityKey("pullups")).toBe("pull-up");
    expect(normalizeExerciseIdentityKey("chin-ups")).toBe("chin-up");
    expect(normalizeExerciseIdentityKey("push ups")).toBe("push-up");
    expect(normalizeExerciseIdentityKey("scapular pull ups")).toBe("scapular-pull-up");
    expect(normalizeExerciseIdentityKey("dips")).toBe("dip");
    expect(normalizeExerciseIdentityKey("Dip")).toBe("dip");
  });

  it("replaces '&' with 'and' and collapses non-alphanumerics to spaces for unknown text", () => {
    expect(normalizeExerciseIdentityKey("Bench & Press")).toBe("bench and press");
  });

  it("turns a custom- prefixed id into normalized plain text (hyphen becomes a space), not a catalog id", () => {
    expect(normalizeExerciseIdentityKey("custom-abc123")).toBe("custom abc123");
    expect(normalizeExerciseIdentityKey("custom-abc123XYZ")).toBe("custom abc123xyz");
  });

  it("returns '' for empty/nullish input", () => {
    expect(normalizeExerciseIdentityKey("")).toBe("");
    expect(normalizeExerciseIdentityKey(undefined)).toBe("");
    expect(normalizeExerciseIdentityKey(null)).toBe("");
  });
});

describe("getExerciseIdentityKey", () => {
  it("prefers exerciseDefinitionId over name when both are present", () => {
    expect(
      getExerciseIdentityKey({ exerciseDefinitionId: "custom-xyz", name: "My Custom Move" })
    ).toBe("custom xyz");
  });

  it("gives two entries with the same custom exerciseDefinitionId the same identity, regardless of name", () => {
    const a = getExerciseIdentityKey({ exerciseDefinitionId: "custom-xyz", name: "My Custom Move" });
    const b = getExerciseIdentityKey({ exerciseDefinitionId: "custom-xyz", name: "Different Name" });
    expect(a).toBe(b);
  });

  it("falls back to name when exerciseDefinitionId is absent", () => {
    expect(getExerciseIdentityKey({ name: "Bench Press" } as any)).toBe("barbell-bench-press");
  });

  it("falls back to name when exerciseDefinitionId is an empty string", () => {
    expect(getExerciseIdentityKey({ exerciseDefinitionId: "", name: "Bench Press" } as any)).toBe(
      "barbell-bench-press"
    );
  });

  it("falls back to name when exerciseDefinitionId is null", () => {
    expect(getExerciseIdentityKey({ exerciseDefinitionId: null, name: "Push-Up" } as any)).toBe(
      "push-up"
    );
  });
});

describe("matchesExerciseSearchQuery", () => {
  it("matches a substring of the normalized name", () => {
    expect(
      matchesExerciseSearchQuery({ name: "Barbell Bench Press", aliases: ["bench press"] }, "bench")
    ).toBe(true);
  });

  it("matches out-of-order tokens against the candidate name", () => {
    expect(matchesExerciseSearchQuery({ name: "Barbell Bench Press" }, "press barbell")).toBe(true);
  });

  it("matches everything for an empty/whitespace query", () => {
    expect(matchesExerciseSearchQuery({ name: "Barbell Bench Press" }, "")).toBe(true);
  });

  it("returns false when no candidate matches", () => {
    expect(matchesExerciseSearchQuery({ name: "Barbell Bench Press" }, "squat")).toBe(false);
  });
});

describe("normalizeExerciseDisplayName", () => {
  it("trims and collapses internal whitespace runs to a single space", () => {
    expect(normalizeExerciseDisplayName("  a   b  c ")).toBe("a b c");
  });
});
