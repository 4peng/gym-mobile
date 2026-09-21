import type { Program, WorkoutSession } from "@/types";

import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { workoutRepo } from "@/db";

jest.mock("@/storage/asyncStorage", () => ({
  zustandAsyncStorage: jest.requireActual("./testStorage").createMemoryStorage(),
}));
jest.mock("@/db", () => {
  const { createWorkoutRepo } = jest.requireActual("@/db/workoutRepo");
  const { createNodeDriver } = jest.requireActual("@/db/__tests__/nodeDriver");
  return { workoutRepo: createWorkoutRepo(createNodeDriver(), "test-user") };
});
jest.mock("@/utils/notifications", () => ({
  scheduleRestCompleteNotification: jest.fn(() => Promise.resolve("notif-1")),
  cancelScheduledNotification: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/utils/restTimerLiveActivity", () => ({
  buildActiveRestTimerLiveActivityProps: jest.fn(() => null),
  buildRestTimerLiveActivityProps: jest.fn(() => null),
  endRestTimerLiveActivity: jest.fn(() => Promise.resolve()),
  startRestTimerLiveActivity: jest.fn(() => Promise.resolve()),
  updateRestTimerLiveActivity: jest.fn(() => Promise.resolve()),
}));
const mockUpdateCustomExerciseMuscles = jest.fn();
jest.mock("@/stores/exerciseLibraryStore", () => ({
  useExerciseLibraryStore: {
    getState: () => ({ updateCustomExerciseMuscles: mockUpdateCustomExerciseMuscles }),
  },
}));
jest.mock("@/stores/uiPreferencesStore", () => ({
  useUiPreferencesStore: { getState: () => ({ preferredWeightUnit: "kg" }) },
}));

const store = () => useWorkoutSessionStore.getState();

function storedSession(
  id: string,
  completedAt: string,
  overrides: Partial<WorkoutSession> = {},
): WorkoutSession {
  return {
    _id: id,
    userId: "test-user",
    startedAt: "2026-06-01T10:00:00.000Z",
    completedAt,
    updatedAt: 1,
    notes: "",
    exercises: [
      {
        id: `${id}-ex`,
        exerciseDefinitionId: "custom-abc",
        trackingMode: "strength",
        name: "Old Name",
        restSeconds: 60,
        notes: "",
        weightUnit: "lbs",
        muscles: ["back"],
        sets: [{ id: `${id}-s`, weight: 100, reps: 5, type: "working", completedAt }],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  workoutRepo.clear();
  useWorkoutSessionStore.setState({
    activeSession: null,
    activeRestTimer: null,
    pinnedExerciseNames: [],
    activeExerciseId: null,
    dirtyWorkoutIds: [],
    deletedWorkoutIds: [],
  });
  mockUpdateCustomExerciseMuscles.mockClear();
});

describe("session lifecycle", () => {
  it("startQuickSession creates an empty active session", () => {
    store().startQuickSession();
    const s = store().activeSession!;
    expect(s.exercises).toEqual([]);
    expect(s.userId).toBe("default-user");
    expect(store().activeExerciseId).toBeNull();
  });

  it("startFromProgram expands set templates and focuses the first exercise", () => {
    const program: Program = {
      _id: "p1",
      userId: "test-user",
      name: "Push",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: 1,
      exercises: [
        {
          id: "pe1",
          exerciseDefinitionId: "barbell-bench-press",
          trackingMode: "strength",
          name: "Bench",
          defaultSets: [{ type: "warmup" }, { type: "working" }],
          restSeconds: 120,
          notes: "",
          weightUnit: "kg",
          initialWeight: 60,
          muscles: ["chest"],
        },
      ],
    };
    store().startFromProgram(program);
    const ex = store().activeSession!.exercises[0];
    expect(ex.sets.map((s) => s.type)).toEqual(["warmup", "working"]);
    expect(ex.sets[0].weight).toBe(60);
    expect(ex.programExerciseId).toBe("pe1");
    expect(store().activeSession!.programId).toBe("p1");
    expect(store().activeExerciseId).toBe(ex.id);
  });

  it("completeSession stores only completed sets, drops empty exercises, and marks the session dirty", () => {
    store().startQuickSession();
    store().addExercise({ id: "barbell-bench-press", name: "Bench", muscles: ["chest"] });
    store().addExercise({ id: "squat", name: "Squat", muscles: ["quads"] });
    const [bench] = store().activeSession!.exercises;
    store().updateSet(bench.id, bench.sets[0].id, "weight", 100);
    store().toggleSetCompletion(bench.id, bench.sets[0].id);
    const sessionId = store().activeSession!._id;

    expect(store().completeSession()).toBe(true);
    expect(store().activeSession).toBeNull();
    expect(store().dirtyWorkoutIds).toEqual([sessionId]);
    const stored = workoutRepo.get(sessionId)!;
    expect(stored.exercises).toHaveLength(1);
    expect(stored.exercises[0].sets).toHaveLength(1);
    expect(stored.completedAt).toBeDefined();
  });

  it("completeSession with nothing completed stores nothing", () => {
    store().startQuickSession();
    store().addExercise({ id: "squat", name: "Squat", muscles: ["quads"] });
    expect(store().completeSession()).toBe(false);
    expect(workoutRepo.count()).toBe(0);
    expect(store().dirtyWorkoutIds).toEqual([]);
    expect(store().activeSession).toBeNull();
  });

  it("deleteHistorySession removes locally and queues the cloud delete", () => {
    workoutRepo.upsertMany([storedSession("w1", "2026-06-01T11:00:00.000Z")]);
    useWorkoutSessionStore.setState({ dirtyWorkoutIds: ["w1"] });
    store().deleteHistorySession("w1");
    expect(workoutRepo.get("w1")).toBeNull();
    expect(store().deletedWorkoutIds).toEqual(["w1"]);
    expect(store().dirtyWorkoutIds).toEqual([]);
  });

  it("updateHistorySet and updateSessionDate write through to the repo and mark dirty", () => {
    workoutRepo.upsertMany([storedSession("w1", "2026-06-01T11:00:00.000Z")]);
    store().updateHistorySet("w1", "w1-ex", "w1-s", "reps", 8);
    store().updateSessionDate("w1", "2026-07-01T11:00:00.000Z");
    const s = workoutRepo.get("w1")!;
    expect(s.exercises[0].sets[0].reps).toBe(8);
    expect(s.completedAt).toBe("2026-07-01T11:00:00.000Z");
    expect(store().dirtyWorkoutIds).toEqual(["w1"]);
    store().updateHistorySet("missing", "x", "y", "reps", 1);
    expect(store().dirtyWorkoutIds).toEqual(["w1"]);
  });
});

describe("exercise defaults from history", () => {
  it("addExercise inherits the unit and tracking mode of the last stored occurrence", () => {
    workoutRepo.upsertMany([
      storedSession("w1", "2026-06-01T11:00:00.000Z", {
        exercises: [
          {
            ...storedSession("w1", "").exercises[0],
            exerciseDefinitionId: "plank",
            trackingMode: "timed",
            weightUnit: "lbs",
          },
        ],
      }),
    ]);
    store().startQuickSession();
    store().addExercise({ id: "plank", name: "Plank", muscles: ["core"] });
    const ex = store().activeSession!.exercises[0];
    expect(ex.trackingMode).toBe("timed");
    expect(ex.weightUnit).toBe("lbs");
    expect(ex.sets[0].durationSeconds).toBeNull();
    expect(ex.sets[0].weight).toBeNull();
  });

  it("toggleSetType cycles working → warmup → dropset → working", () => {
    store().startQuickSession();
    store().addExercise({ id: "squat", name: "Squat", muscles: ["quads"] });
    const ex = store().activeSession!.exercises[0];
    const type = () => store().activeSession!.exercises[0].sets[0].type;
    store().toggleSetType(ex.id, ex.sets[0].id);
    expect(type()).toBe("warmup");
    store().toggleSetType(ex.id, ex.sets[0].id);
    expect(type()).toBe("dropset");
    store().toggleSetType(ex.id, ex.sets[0].id);
    expect(type()).toBe("working");
  });
});

describe("exercise-definition propagation", () => {
  it("rename updates stored sessions, the active session and the rest timer label", () => {
    workoutRepo.upsertMany([
      storedSession("w1", "2026-06-01T11:00:00.000Z"),
      storedSession("w2", "2026-05-01T11:00:00.000Z", { exercises: [] }),
    ]);
    store().startQuickSession();
    store().addExercise({ id: "custom-abc", name: "Old Name", muscles: [] });
    const activeEx = store().activeSession!.exercises[0];
    useWorkoutSessionStore.setState({
      activeRestTimer: {
        startTime: 1,
        endTime: 2,
        exerciseId: activeEx.id,
        exerciseName: "Old Name",
        notificationId: "n",
      },
    });

    store().renameExerciseDefinitionReferences("custom-abc", "New Name");

    expect(workoutRepo.get("w1")!.exercises[0].name).toBe("New Name");
    expect(store().dirtyWorkoutIds).toEqual(["w1"]);
    expect(store().activeSession!.exercises[0].name).toBe("New Name");
    expect(store().activeRestTimer!.exerciseName).toBe("New Name");
  });

  it("updateMusclesInHistory updates every occurrence and the custom library entry", () => {
    workoutRepo.upsertMany([storedSession("w1", "2026-06-01T11:00:00.000Z")]);
    store().updateMusclesInHistory("custom-abc", ["back", "arms"]);
    expect(workoutRepo.get("w1")!.exercises[0].muscles).toEqual(["back", "arms"]);
    expect(store().dirtyWorkoutIds).toEqual(["w1"]);
    expect(mockUpdateCustomExerciseMuscles).toHaveBeenCalledWith("custom-abc", ["back", "arms"]);
  });

  it("removeExerciseDefinitionReferences orphans the exercise (identity falls back to its name)", () => {
    workoutRepo.upsertMany([storedSession("w1", "2026-06-01T11:00:00.000Z")]);
    store().removeExerciseDefinitionReferences("custom-abc");
    expect(workoutRepo.get("w1")!.exercises[0].exerciseDefinitionId).toBe("");
    expect(workoutRepo.exerciseHistory("old name")).toHaveLength(1);
  });
});

describe("backup bookkeeping", () => {
  it("importWorkouts stores completed sessions and optionally marks them dirty", () => {
    store().importWorkouts(
      [
        storedSession("w1", "2026-06-01T11:00:00.000Z"),
        storedSession("w2", "2026-06-02T11:00:00.000Z", { completedAt: undefined }),
      ],
      true,
    );
    expect(workoutRepo.count()).toBe(1);
    expect(store().dirtyWorkoutIds).toEqual(["w1"]);
  });

  it("clearDirtyWorkouts keeps ids edited after the push started", () => {
    workoutRepo.upsertMany([
      storedSession("w1", "2026-06-01T11:00:00.000Z", { updatedAt: 100 }),
      storedSession("w2", "2026-06-01T11:00:00.000Z", { updatedAt: 300 }),
    ]);
    useWorkoutSessionStore.setState({ dirtyWorkoutIds: ["w1", "w2", "gone"] });
    store().clearDirtyWorkouts(["w1", "w2", "gone"], 200);
    expect(store().dirtyWorkoutIds).toEqual(["w2"]);
  });

  it("clearDeletedWorkouts drops acknowledged ids", () => {
    useWorkoutSessionStore.setState({ deletedWorkoutIds: ["a", "b"] });
    store().clearDeletedWorkouts(["a"]);
    expect(store().deletedWorkoutIds).toEqual(["b"]);
  });

  it("togglePinExercise normalizes the key and toggles", () => {
    store().togglePinExercise("Barbell Bench Press");
    expect(store().pinnedExerciseNames).toEqual(["barbell-bench-press"]);
    store().togglePinExercise("barbell-bench-press");
    expect(store().pinnedExerciseNames).toEqual([]);
  });
});

describe("rest timer", () => {
  it("startRestTimer replaces a running timer and banks its elapsed rest", async () => {
    store().startQuickSession();
    store().addExercise({ id: "squat", name: "Squat", muscles: [] });
    const ex = store().activeSession!.exercises[0];
    useWorkoutSessionStore.setState({
      activeRestTimer: {
        startTime: Date.now() - 30_000,
        endTime: Date.now() + 30_000,
        exerciseId: ex.id,
        exerciseName: "Squat",
        notificationId: "old",
      },
    });
    await store().startRestTimer(ex.id, 90, "Squat");
    expect(store().activeSession!.cumulativeRestSeconds).toBeGreaterThanOrEqual(29);
    expect(store().activeRestTimer!.notificationId).toBe("notif-1");
  });

  it("clearExpiredTimer only clears timers that have ended", () => {
    store().startQuickSession();
    useWorkoutSessionStore.setState({
      activeRestTimer: {
        startTime: Date.now() - 100_000,
        endTime: Date.now() - 10_000,
        exerciseId: "x",
        exerciseName: "X",
        notificationId: "n",
      },
    });
    store().clearExpiredTimer();
    expect(store().activeRestTimer).toBeNull();
    expect(store().activeSession!.cumulativeRestSeconds).toBe(90);
    useWorkoutSessionStore.setState({
      activeRestTimer: {
        startTime: Date.now(),
        endTime: Date.now() + 10_000,
        exerciseId: "x",
        exerciseName: "X",
        notificationId: "n",
      },
    });
    store().clearExpiredTimer();
    expect(store().activeRestTimer).not.toBeNull();
  });
});

describe("persistence", () => {
  it("migrate drops the pre-SQLite history fields and keeps the live session", () => {
    const migrate = useWorkoutSessionStore.persist.getOptions().migrate!;
    const migrated = migrate(
      {
        activeSession: { _id: "live", exercises: [] },
        history: [{ _id: "old" }],
        historyIndex: ["old"],
        dirtyWorkoutIds: ["old"],
        pinnedExerciseNames: ["Bench"],
      },
      5,
    ) as any;
    expect(migrated.history).toBeUndefined();
    expect(migrated.historyIndex).toBeUndefined();
    expect(migrated.activeSession._id).toBe("live");
    expect(migrated.dirtyWorkoutIds).toEqual(["old"]);
    expect(migrated.pinnedExerciseNames).toEqual(["bench"]);
  });
});
