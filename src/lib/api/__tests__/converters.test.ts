import {
  mapProgramToBackend,
  mapProgramFromBackend,
  mapWorkoutToBackend,
  mapWorkoutFromBackend,
} from "@/lib/api/converters";
import type { ProgramServer, WorkoutServer } from "@/lib/api/serverTypes";
import type { Program, WorkoutSession } from "@/types";

// These tests PIN DOWN current behavior of the client<->server converters so
// that a performance refactor can't silently change what gets sent/read.
// Do not "fix" any surprising behavior found here without updating callers;
// treat everything below as a snapshot of the code as it exists today.

function makeProgram(overrides: Partial<Program> = {}): Program {
  return {
    _id: "prog1",
    userId: "user1",
    name: "Push Day",
    exercises: [
      {
        id: "ex1",
        exerciseDefinitionId: "barbell-bench-press",
        trackingMode: "strength",
        name: "Barbell Bench Press",
        defaultSets: [
          { type: "warmup" },
          { type: "working" },
          { type: "working" },
          { type: "dropset" },
        ],
        restSeconds: 90,
        notes: "go heavy",
        weightUnit: "kg",
        initialWeight: 60,
        muscles: ["chest", "arms"],
        isBodyweight: false,
      },
      {
        id: "ex2",
        exerciseDefinitionId: "push-up",
        trackingMode: "strength",
        name: "Push-Up",
        defaultSets: [{ type: "working" }, { type: "working" }],
        restSeconds: 60,
        notes: "",
        weightUnit: undefined,
        initialWeight: null,
        muscles: ["chest"],
        isBodyweight: true,
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: 1234567890,
    ...overrides,
  };
}

describe("mapProgramToBackend", () => {
  it("maps every field including the full defaultSets template array", () => {
    const program = makeProgram();
    const server = mapProgramToBackend(program);

    expect(server).toEqual({
      _id: "prog1",
      userId: "user1",
      name: "Push Day",
      exercises: [
        {
          id: "ex1",
          exerciseDefinitionId: "barbell-bench-press",
          trackingMode: "strength",
          name: "Barbell Bench Press",
          defaultSets: [
            { type: "warmup" },
            { type: "working" },
            { type: "working" },
            { type: "dropset" },
          ],
          restSeconds: 90,
          notes: "go heavy",
          weightUnit: "kg",
          initialWeight: 60,
          muscles: ["chest", "arms"],
          isBodyweight: false,
        },
        {
          id: "ex2",
          exerciseDefinitionId: "push-up",
          trackingMode: "strength",
          name: "Push-Up",
          defaultSets: [{ type: "working" }, { type: "working" }],
          restSeconds: 60,
          notes: "",
          weightUnit: undefined,
          initialWeight: null,
          muscles: ["chest"],
          isBodyweight: true,
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: 1234567890,
      deletedAt: undefined,
    });
  });

  it("does not normalize trackingMode - passes it through verbatim", () => {
    const program = makeProgram();
    program.exercises[0].trackingMode = "bogus" as any;
    const server = mapProgramToBackend(program);
    expect(server.exercises[0].trackingMode).toBe("bogus");
  });
});

describe("mapProgramFromBackend", () => {
  it("round-trips a program through to-backend then from-backend unchanged", () => {
    const program = makeProgram();
    const roundTripped = mapProgramFromBackend(mapProgramToBackend(program));
    expect(roundTripped).toEqual(program);
  });

  it("backfills a legacy numeric defaultSets into an array of working-set templates", () => {
    const server: ProgramServer = {
      _id: "prog1",
      userId: "user1",
      name: "Legacy Program",
      exercises: [
        {
          id: "ex1",
          exerciseDefinitionId: "barbell-bench-press",
          trackingMode: "strength",
          name: "Barbell Bench Press",
          defaultSets: 4,
          restSeconds: 90,
          notes: "",
          muscles: ["chest"],
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: 1,
    };

    const program = mapProgramFromBackend(server);
    expect(program.exercises[0].defaultSets).toEqual([
      { type: "working" },
      { type: "working" },
      { type: "working" },
      { type: "working" },
    ]);
  });

  it("backfills defaultSets: 0 into an empty array (Array.from length 0)", () => {
    const server: ProgramServer = {
      _id: "prog1",
      userId: "user1",
      name: "Zero Sets",
      exercises: [
        {
          id: "ex1",
          name: "Mystery Move",
          trackingMode: "strength",
          defaultSets: 0,
          restSeconds: 90,
          notes: "",
          muscles: [],
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: 1,
    };

    const program = mapProgramFromBackend(server);
    expect(program.exercises[0].defaultSets).toEqual([]);
  });

  it("collapses unrecognized set-type values in an array to 'working'", () => {
    const server: ProgramServer = {
      _id: "prog1",
      userId: "user1",
      name: "Weird Sets",
      exercises: [
        {
          id: "ex1",
          name: "Some Move",
          trackingMode: "strength",
          defaultSets: [
            { type: "warmup" as const },
            { type: "superset" as any },
            { type: "dropset" as const },
            {} as any,
          ],
          restSeconds: 90,
          notes: "",
          muscles: [],
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: 1,
    };

    const program = mapProgramFromBackend(server);
    expect(program.exercises[0].defaultSets).toEqual([
      { type: "warmup" },
      { type: "working" },
      { type: "dropset" },
      { type: "working" },
    ]);
  });

  it("defaults defaultSets to three working sets when the field is missing entirely", () => {
    const server: ProgramServer = {
      _id: "prog1",
      userId: "user1",
      name: "No Sets Field",
      exercises: [
        {
          id: "ex1",
          name: "Some Move",
          trackingMode: "strength",
          defaultSets: undefined as any,
          restSeconds: 90,
          notes: "",
          muscles: [],
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: 1,
    };

    const program = mapProgramFromBackend(server);
    expect(program.exercises[0].defaultSets).toEqual([
      { type: "working" },
      { type: "working" },
      { type: "working" },
    ]);
  });

  it("normalizes an invalid or missing trackingMode to 'strength', but passes through 'timed'/'cardio'", () => {
    const server: ProgramServer = {
      _id: "prog1",
      userId: "user1",
      name: "Modes",
      exercises: [
        { id: "e1", name: "A", trackingMode: "bogus", defaultSets: 1, restSeconds: 60, notes: "", muscles: [] },
        { id: "e2", name: "B", trackingMode: undefined as any, defaultSets: 1, restSeconds: 60, notes: "", muscles: [] },
        { id: "e3", name: "C", trackingMode: "cardio", defaultSets: 1, restSeconds: 60, notes: "", muscles: [] },
        { id: "e4", name: "D", trackingMode: "timed", defaultSets: 1, restSeconds: 60, notes: "", muscles: [] },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: 1,
    };

    const program = mapProgramFromBackend(server);
    expect(program.exercises.map((e) => e.trackingMode)).toEqual([
      "strength",
      "strength",
      "cardio",
      "timed",
    ]);
  });

  it("coerces a non-number initialWeight to null and defaults missing muscles to []", () => {
    const server: ProgramServer = {
      _id: "prog1",
      userId: "user1",
      name: "Edge Cases",
      exercises: [
        {
          id: "e1",
          name: "A",
          trackingMode: "strength",
          defaultSets: 1,
          restSeconds: 60,
          notes: "",
          initialWeight: "60" as any,
          muscles: undefined as any,
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: 1,
    };

    const program = mapProgramFromBackend(server);
    expect(program.exercises[0].initialWeight).toBeNull();
    expect(program.exercises[0].muscles).toEqual([]);
  });

  it("stringifies a non-string _id (e.g. a real Mongo ObjectId-shaped value)", () => {
    const server: ProgramServer = {
      _id: { toString: () => "abc123" } as any,
      userId: "user1",
      name: "Id Coercion",
      exercises: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: 1,
    };

    const program = mapProgramFromBackend(server);
    expect(program._id).toBe("abc123");
  });
});

function makeWorkout(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    _id: "sess1",
    userId: "user1",
    programId: "prog1",
    startedAt: "2026-01-01T09:00:00.000Z",
    completedAt: "2026-01-01T10:00:00.000Z",
    updatedAt: 111,
    notes: "felt good",
    exercises: [
      {
        id: "ex1",
        exerciseDefinitionId: "barbell-bench-press",
        trackingMode: "strength",
        name: "Barbell Bench Press",
        restSeconds: 90,
        notes: "",
        weightUnit: "kg",
        muscles: ["chest"],
        isBodyweight: false,
        sets: [
          { id: "s1", weight: 100, reps: 10, type: "warmup", durationSeconds: null, distance: null, completedAt: "2026-01-01T09:05:00.000Z" },
          { id: "s2", weight: 110, reps: 8, type: "working", durationSeconds: null, distance: null },
          { id: "s3", weight: 120, reps: 6, type: "dropset", durationSeconds: null, distance: null },
        ],
      },
      {
        id: "ex2",
        exerciseDefinitionId: "run",
        trackingMode: "cardio",
        name: "Run",
        restSeconds: 0,
        notes: "",
        weightUnit: undefined,
        muscles: ["quads"],
        sets: [
          { id: "s4", weight: null, reps: null, type: "working", durationSeconds: 600, distance: 2.5 },
        ],
      },
    ],
    ...overrides,
  };
}

describe("mapWorkoutToBackend / mapWorkoutFromBackend", () => {
  it("round-trips a full workout session unchanged", () => {
    const workout = makeWorkout();
    const roundTripped = mapWorkoutFromBackend(mapWorkoutToBackend(workout));
    expect(roundTripped).toEqual(workout);
  });

  it("maps programId through unchanged on the way to the backend, even if empty string", () => {
    const workout = makeWorkout({ programId: "" });
    const server = mapWorkoutToBackend(workout);
    expect(server.programId).toBe("");
  });

  it("converts a nullish programId to undefined on the way to the backend", () => {
    const workout = makeWorkout({ programId: null as any });
    const server = mapWorkoutToBackend(workout);
    expect(server.programId).toBeUndefined();
  });

  it("collapses an empty-string programId to undefined when reading from the backend", () => {
    const server: WorkoutServer = {
      ...mapWorkoutToBackend(makeWorkout()),
      programId: "",
    };
    const workout = mapWorkoutFromBackend(server);
    expect(workout.programId).toBeUndefined();
  });

  it("defaults notes to '' when the backend omits it", () => {
    const server: WorkoutServer = mapWorkoutToBackend(makeWorkout());
    (server as any).notes = undefined;
    const workout = mapWorkoutFromBackend(server);
    expect(workout.notes).toBe("");
  });

  it("coerces non-number durationSeconds/distance to null when reading from the backend", () => {
    const server: WorkoutServer = mapWorkoutToBackend(makeWorkout());
    (server.exercises[0].sets[0] as any).durationSeconds = "not-a-number";
    (server.exercises[0].sets[0] as any).distance = undefined;
    const workout = mapWorkoutFromBackend(server);
    expect(workout.exercises[0].sets[0].durationSeconds).toBeNull();
    expect(workout.exercises[0].sets[0].distance).toBeNull();
  });

  it("normalizes an invalid exercise trackingMode to 'strength' when reading from the backend", () => {
    const server: WorkoutServer = mapWorkoutToBackend(makeWorkout());
    server.exercises[0].trackingMode = "bogus";
    const workout = mapWorkoutFromBackend(server);
    expect(workout.exercises[0].trackingMode).toBe("strength");
  });

  it("defaults missing muscles to [] when reading from the backend", () => {
    const server: WorkoutServer = mapWorkoutToBackend(makeWorkout());
    (server.exercises[0] as any).muscles = undefined;
    const workout = mapWorkoutFromBackend(server);
    expect(workout.exercises[0].muscles).toEqual([]);
  });

  it("stringifies a non-string _id and programId when reading from the backend", () => {
    const server: WorkoutServer = mapWorkoutToBackend(makeWorkout());
    (server as any)._id = { toString: () => "sess-oid" };
    (server as any).programId = { toString: () => "prog-oid" };
    const workout = mapWorkoutFromBackend(server);
    expect(workout._id).toBe("sess-oid");
    expect(workout.programId).toBe("prog-oid");
  });
});
