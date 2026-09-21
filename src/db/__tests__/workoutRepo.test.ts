import { createNodeDriver } from "./nodeDriver";
import { createWorkoutRepo, type WorkoutRepo } from "../workoutRepo";
import type { WorkoutSession } from "@/types";

jest.mock("../dbVersion", () => ({ bumpDbVersion: jest.fn() }));

function makeSession(
  id: string,
  completedAt: string,
  overrides: Partial<WorkoutSession> = {},
): WorkoutSession {
  return {
    _id: id,
    userId: "u",
    startedAt: new Date(new Date(completedAt).getTime() - 3_600_000).toISOString(),
    completedAt,
    updatedAt: 1,
    notes: "",
    exercises: [
      {
        id: `${id}-ex1`,
        exerciseDefinitionId: "barbell-bench-press",
        trackingMode: "strength",
        name: "Barbell Bench Press",
        restSeconds: 90,
        notes: "",
        weightUnit: "kg",
        muscles: ["chest"],
        sets: [{ id: `${id}-s1`, weight: 100, reps: 5, type: "working", completedAt }],
      },
      {
        id: `${id}-ex2`,
        exerciseDefinitionId: "pull-up",
        trackingMode: "strength",
        name: "Pull-Up",
        restSeconds: 60,
        notes: "",
        weightUnit: "kg",
        muscles: ["back"],
        sets: [{ id: `${id}-s2`, weight: null, reps: 8, type: "working", completedAt }],
      },
    ],
    ...overrides,
  };
}

let repo: WorkoutRepo;
beforeEach(() => {
  repo = createWorkoutRepo(createNodeDriver(), "test-user");
});

describe("workoutRepo", () => {
  it("round-trips a session and stamps the repo user id", () => {
    const s = makeSession("a", "2026-06-01T10:00:00.000Z", {
      notes: "felt good",
      cumulativeRestSeconds: 120,
      programId: "p1",
    });
    repo.upsertMany([s]);
    expect(repo.get("a")).toEqual({ ...s, userId: "test-user" });
    expect(repo.count()).toBe(1);
  });

  it("skips sessions without completedAt", () => {
    repo.upsertMany([makeSession("x", "2026-06-01T10:00:00.000Z", { completedAt: undefined })]);
    expect(repo.count()).toBe(0);
  });

  it("upsert replaces exercises instead of appending", () => {
    repo.upsertMany([makeSession("a", "2026-06-01T10:00:00.000Z")]);
    const edited = makeSession("a", "2026-06-01T10:00:00.000Z");
    edited.exercises = [edited.exercises[0]];
    repo.upsertMany([edited]);
    expect(repo.get("a")!.exercises).toHaveLength(1);
  });

  it("lists newest first with paging", () => {
    repo.upsertMany([
      makeSession("old", "2026-01-01T10:00:00.000Z"),
      makeSession("new", "2026-06-01T10:00:00.000Z"),
      makeSession("mid", "2026-03-01T10:00:00.000Z"),
    ]);
    expect(repo.list(2).map((s) => s._id)).toEqual(["new", "mid"]);
    expect(repo.list(2, 2).map((s) => s._id)).toEqual(["old"]);
  });

  it("deleteMany cascades to exercises", () => {
    repo.upsertMany([makeSession("a", "2026-06-01T10:00:00.000Z")]);
    repo.deleteMany(["a"]);
    expect(repo.get("a")).toBeNull();
    expect(repo.exerciseHistory("barbell-bench-press")).toEqual([]);
  });

  it("exerciseHistory returns occurrences by identity key, newest first, optionally since a date", () => {
    repo.upsertMany([
      makeSession("a", "2026-01-01T10:00:00.000Z"),
      makeSession("b", "2026-06-01T10:00:00.000Z"),
    ]);
    const all = repo.exerciseHistory("barbell-bench-press");
    expect(all.map((r) => r.workoutId)).toEqual(["b", "a"]);
    expect(all[0].exercise.name).toBe("Barbell Bench Press");
    expect(
      repo
        .exerciseHistory("barbell-bench-press", "2026-03-01T00:00:00.000Z")
        .map((r) => r.workoutId),
    ).toEqual(["b"]);
  });

  it("latestExercise resolves the identity key from a name-only exercise too", () => {
    const s = makeSession("a", "2026-06-01T10:00:00.000Z");
    s.exercises[0].exerciseDefinitionId = undefined; // identity falls back to the normalized name
    repo.upsertMany([s]);
    expect(repo.latestExercise("barbell-bench-press")?.id).toBe("a-ex1");
    expect(repo.latestExercise("nothing")).toBeNull();
  });

  it("recentExercises caps rows per exercise", () => {
    repo.upsertMany(
      Array.from({ length: 12 }, (_, i) =>
        makeSession(`s${i}`, `2026-01-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`),
      ),
    );
    const rows = repo.recentExercises(10);
    const bench = rows.filter((r) => r.identityKey === "barbell-bench-press");
    expect(bench).toHaveLength(10);
    expect(bench[0].workoutId).toBe("s11"); // newest first within the exercise
    expect(rows.filter((r) => r.identityKey === "pull-up")).toHaveLength(10);
  });

  it("summariesSince and lastUsedByProgram read only the columns they need", () => {
    repo.upsertMany([
      makeSession("a", "2026-01-01T10:00:00.000Z", { programId: "p1" }),
      makeSession("b", "2026-06-01T10:00:00.000Z", { programId: "p1" }),
      makeSession("c", "2026-05-01T10:00:00.000Z"),
    ]);
    expect(repo.summariesSince("2026-04-01T00:00:00.000Z").map((r) => r.completedAt)).toEqual([
      "2026-06-01T10:00:00.000Z",
      "2026-05-01T10:00:00.000Z",
    ]);
    expect(repo.lastUsedByProgram().get("p1")).toBe(new Date("2026-06-01T10:00:00.000Z").getTime());
  });

  it("rewriteExercises re-indexes identity keys and bumps updatedAt only for changed sessions", () => {
    repo.upsertMany([
      makeSession("a", "2026-06-01T10:00:00.000Z"),
      makeSession("b", "2026-05-01T10:00:00.000Z", { exercises: [] }),
    ]);
    const before = Date.now();
    const changed = repo.rewriteExercises((ex) => {
      if (ex.exerciseDefinitionId !== "pull-up") return false;
      ex.exerciseDefinitionId = "";
      ex.name = "Chin-Up";
      return true;
    });
    expect(changed).toEqual(["a"]);
    expect(repo.get("a")!.updatedAt).toBeGreaterThanOrEqual(before);
    expect(repo.get("b")!.updatedAt).toBe(1);
    expect(repo.exerciseHistory("pull-up")).toEqual([]);
    expect(repo.exerciseHistory("chin-up").map((r) => r.exercise.name)).toEqual(["Chin-Up"]);
  });

  it("updateSet and updateDate edit in place and report existence", () => {
    repo.upsertMany([makeSession("a", "2026-06-01T10:00:00.000Z")]);
    expect(repo.updateSet("a", "a-ex1", "a-s1", "weight", 105)).toBe(true);
    expect(repo.updateSet("a", "a-ex1", "missing", "weight", 1)).toBe(false);
    expect(repo.get("a")!.exercises[0].sets[0].weight).toBe(105);
    expect(repo.updateDate("a", "2026-07-01T10:00:00.000Z")).toBe(true);
    expect(repo.updateDate("nope", "2026-07-01T10:00:00.000Z")).toBe(false);
    expect(repo.get("a")!.completedAt).toBe("2026-07-01T10:00:00.000Z");
  });

  it("updatedAtOf and clear", () => {
    repo.upsertMany([makeSession("a", "2026-06-01T10:00:00.000Z", { updatedAt: 42 })]);
    expect(repo.updatedAtOf(["a", "zzz"]).get("a")).toBe(42);
    repo.clear();
    expect(repo.count()).toBe(0);
  });
});
