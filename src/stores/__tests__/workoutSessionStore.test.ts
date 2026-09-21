import type { WorkoutSession, Program } from "@/types";

// ──────────────────────────────────────────────
// Import the store (after mocks are set up)
// ──────────────────────────────────────────────

import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { workoutStorage } from "@/storage/workoutStorage";

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────

// Mock all native / side-effect modules before importing the store
jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  multiSet: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
}));

jest.mock("@/storage/mmkv", () => ({
  zustandAsyncStorage: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@/storage/workoutStorage", () => ({
  workoutStorage: {
    save: jest.fn(() => Promise.resolve()),
    saveBatch: jest.fn(() => Promise.resolve()),
    get: jest.fn(() => Promise.resolve(null)),
    getBatch: jest.fn(() => Promise.resolve([])),
    remove: jest.fn(() => Promise.resolve()),
    removeBatch: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@/utils/notifications", () => ({
  scheduleRestCompleteNotification: jest.fn(() => Promise.resolve("notif-id")),
  cancelScheduledNotification: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/utils/restTimerLiveActivity", () => ({
  buildActiveRestTimerLiveActivityProps: jest.fn(() => ({})),
  buildRestTimerLiveActivityProps: jest.fn(() => ({})),
  endRestTimerLiveActivity: jest.fn(() => Promise.resolve()),
  startRestTimerLiveActivity: jest.fn(() => Promise.resolve()),
  updateRestTimerLiveActivity: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/stores/exerciseLibraryStore", () => ({
  useExerciseLibraryStore: {
    getState: jest.fn(() => ({
      exercises: [],
      updateCustomExerciseMuscles: jest.fn(),
    })),
    setState: jest.fn(),
    subscribe: jest.fn(),
    destroy: jest.fn(),
  },
}));

jest.mock("@/stores/uiPreferencesStore", () => ({
  useUiPreferencesStore: {
    getState: jest.fn(() => ({
      preferredWeightUnit: "kg",
    })),
    setState: jest.fn(),
    subscribe: jest.fn(),
    destroy: jest.fn(),
  },
}));

// Mock process.env to prevent USER_ID issues
jest.mock("@/constants/user", () => ({
  USER_ID: "test-user",
}));

const mockedWorkoutStorage = jest.mocked(workoutStorage);

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function makeProgram(overrides: Partial<Program> = {}): Program {
  return {
    _id: "prog-1",
    userId: "user-1",
    name: "Push Day",
    exercises: [
      {
        id: "pe-1",
        exerciseDefinitionId: "barbell-bench-press",
        trackingMode: "strength",
        name: "Barbell Bench Press",
        defaultSets: [{ type: "warmup" }, { type: "working" }, { type: "working" }],
        restSeconds: 90,
        notes: "",
        muscles: ["chest"],
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: 100,
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("workoutSessionStore", () => {
  // Reset the store before each test
  beforeEach(() => {
    useWorkoutSessionStore.setState({
      activeSession: null,
      history: [],
      historyIndex: [],
      deletedWorkoutIds: [],
      dirtyWorkoutIds: [],
      hasMoreHistory: true,
      activeRestTimer: null,
      pinnedExerciseNames: [],
      activeExerciseId: null,
      isDirty: false,
      lastSyncedAt: null,
    });
  });

  // ── Session lifecycle ────────────────────

  describe("startQuickSession", () => {
    it("creates an active session with _id, startedAt, and empty exercises", () => {
      useWorkoutSessionStore.getState().startQuickSession();
      const session = useWorkoutSessionStore.getState().activeSession;
      expect(session).not.toBeNull();
      expect(session!._id).toBeTruthy();
      expect(session!.exercises).toEqual([]);
      expect(session!.startedAt).toBeTruthy();
      expect(session!.updatedAt).toBeGreaterThan(0);
      expect(session!.userId).toBe("test-user");
      expect(useWorkoutSessionStore.getState().activeExerciseId).toBeNull();
    });
  });

  describe("startFromProgram", () => {
    it("copies exercises with defaultSets converted to sets and generates new IDs", () => {
      const program = makeProgram();
      useWorkoutSessionStore.getState().startFromProgram(program);
      const session = useWorkoutSessionStore.getState().activeSession;

      expect(session).not.toBeNull();
      expect(session!._id).toBeTruthy();
      expect(session!._id).not.toBe(program._id);
      expect(session!.programId).toBe(program._id);
      expect(session!.exercises).toHaveLength(1);

      const exercise = session!.exercises[0];
      expect(exercise.id).not.toBe(program.exercises[0].id);
      expect(exercise.exerciseDefinitionId).toBe("barbell-bench-press");
      expect(exercise.name).toBe("Barbell Bench Press");
      expect(exercise.restSeconds).toBe(90);
      expect(exercise.sets).toHaveLength(3); // 1 warmup + 2 working
      expect(exercise.sets[0].type).toBe("warmup");
      expect(exercise.sets[1].type).toBe("working");
      expect(exercise.sets[2].type).toBe("working");
      expect(exercise.sets[0].id).toBeTruthy();

      // Active exercise ID set to first exercise
      expect(useWorkoutSessionStore.getState().activeExerciseId).toBe(exercise.id);
    });
  });

  describe("completeSession", () => {
    it("sets completedAt and updatedAt, adds to historyIndex, marks dirty", () => {
      const program = makeProgram();
      useWorkoutSessionStore.getState().startFromProgram(program);
      const sessionId = useWorkoutSessionStore.getState().activeSession!._id;

      useWorkoutSessionStore.getState().completeSession();

      const state = useWorkoutSessionStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.historyIndex).toContain(sessionId);
      expect(state.dirtyWorkoutIds).toContain(sessionId);
      expect(state.isDirty).toBe(true);

      const completed = state.history[0];
      expect(completed).toBeDefined();
      expect(completed.completedAt).toBeTruthy();
      expect(completed.updatedAt).toBeGreaterThan(0);
    });

    it("discardSession clears activeSession", () => {
      useWorkoutSessionStore.getState().startQuickSession();
      expect(useWorkoutSessionStore.getState().activeSession).not.toBeNull();

      useWorkoutSessionStore.getState().discardSession();
      const state = useWorkoutSessionStore.getState();
      expect(state.activeSession).toBeNull();
      expect(state.activeRestTimer).toBeNull();
      expect(state.activeExerciseId).toBeNull();
    });
  });

  // ── Exercise mutations ────────────────────

  describe("addExercise", () => {
    it("appends an exercise with proper shape to the active session", () => {
      useWorkoutSessionStore.getState().startQuickSession();
      useWorkoutSessionStore.getState().addExercise({
        id: "bench-press",
        name: "Bench Press",
        muscles: ["chest"],
      } as any);

      const session = useWorkoutSessionStore.getState().activeSession!;
      expect(session.exercises).toHaveLength(1);

      const ex = session.exercises[0];
      expect(ex.id).toBeTruthy();
      expect(ex.name).toBe("Bench Press");
      expect(ex.exerciseDefinitionId).toBe("bench-press");
      expect(ex.trackingMode).toBe("strength");
      expect(ex.restSeconds).toBe(90);
      expect(ex.notes).toBe("");
      expect(ex.muscles).toEqual(["chest"]);
      expect(ex.sets).toHaveLength(3);
      expect(ex.sets[0]).toHaveProperty("id");
      expect(ex.sets[0]).toHaveProperty("weight");
      expect(ex.sets[0]).toHaveProperty("reps");
      expect(ex.sets[0]).toHaveProperty("type");
      expect(useWorkoutSessionStore.getState().activeExerciseId).toBe(ex.id);
    });

    it("does nothing when there is no active session", () => {
      // No active session started
      useWorkoutSessionStore.getState().addExercise({ id: "test", name: "Test" } as any);
      expect(useWorkoutSessionStore.getState().activeSession).toBeNull();
    });
  });

  // ── Set mutations ──────────────────────────

  describe("addSet", () => {
    it("appends a set with default shape to the exercise", () => {
      useWorkoutSessionStore.getState().startQuickSession();
      useWorkoutSessionStore.getState().addExercise({ id: "ex-1", name: "Ex" } as any);
      const exerciseId = useWorkoutSessionStore.getState().activeSession!.exercises[0].id;

      useWorkoutSessionStore.getState().addSet(exerciseId);
      const sets = useWorkoutSessionStore.getState().activeSession!.exercises[0].sets;
      expect(sets).toHaveLength(4); // 3 default + 1 added
      expect(sets[3].type).toBe("working");
      expect(sets[3].id).toBeTruthy();
    });
  });

  describe("removeSet", () => {
    it("removes the specified set from the exercise", () => {
      useWorkoutSessionStore.getState().startQuickSession();
      useWorkoutSessionStore.getState().addExercise({ id: "ex-1", name: "Ex" } as any);
      const exerciseId = useWorkoutSessionStore.getState().activeSession!.exercises[0].id;
      const setId = useWorkoutSessionStore.getState().activeSession!.exercises[0].sets[0].id;

      useWorkoutSessionStore.getState().removeSet(exerciseId, setId);
      const sets = useWorkoutSessionStore.getState().activeSession!.exercises[0].sets;
      expect(sets).toHaveLength(2); // was 3, removed 1
      expect(sets.find((s: any) => s.id === setId)).toBeUndefined();
    });
  });

  describe("updateSet", () => {
    it("updates the correct field on the correct set", () => {
      useWorkoutSessionStore.getState().startQuickSession();
      useWorkoutSessionStore.getState().addExercise({ id: "ex-1", name: "Ex" } as any);
      const exerciseId = useWorkoutSessionStore.getState().activeSession!.exercises[0].id;
      const setId = useWorkoutSessionStore.getState().activeSession!.exercises[0].sets[0].id;

      useWorkoutSessionStore.getState().updateSet(exerciseId, setId, "weight", 80);
      useWorkoutSessionStore.getState().updateSet(exerciseId, setId, "reps", 12);

      const set = useWorkoutSessionStore.getState().activeSession!.exercises[0].sets[0];
      expect(set.weight).toBe(80);
      expect(set.reps).toBe(12);

      // Other sets remain unchanged
      const otherSet = useWorkoutSessionStore.getState().activeSession!.exercises[0].sets[1];
      expect(otherSet.weight).toBeNull();
    });
  });

  describe("toggleSetCompletion", () => {
    it("toggles the completedAt timestamp on a set", () => {
      useWorkoutSessionStore.getState().startQuickSession();
      useWorkoutSessionStore.getState().addExercise({ id: "ex-1", name: "Ex" } as any);
      const exerciseId = useWorkoutSessionStore.getState().activeSession!.exercises[0].id;
      const setId = useWorkoutSessionStore.getState().activeSession!.exercises[0].sets[0].id;

      // Toggle on
      useWorkoutSessionStore.getState().toggleSetCompletion(exerciseId, setId);
      const s1 = useWorkoutSessionStore.getState().activeSession!.exercises[0].sets[0];
      expect(s1.completedAt).toBeTruthy();

      // Toggle off
      useWorkoutSessionStore.getState().toggleSetCompletion(exerciseId, setId);
      const s2 = useWorkoutSessionStore.getState().activeSession!.exercises[0].sets[0];
      expect(s2.completedAt).toBeUndefined();
    });
  });

  describe("setActiveExerciseId", () => {
    it("updates the activeExerciseId (persisted field)", () => {
      useWorkoutSessionStore.getState().setActiveExerciseId("ex-123");
      expect(useWorkoutSessionStore.getState().activeExerciseId).toBe("ex-123");

      useWorkoutSessionStore.getState().setActiveExerciseId(null);
      expect(useWorkoutSessionStore.getState().activeExerciseId).toBeNull();
    });
  });

  // ── Sync merge ────────────────────────────

  describe("applySyncMerge", () => {
    it("remote workout with higher updatedAt replaces local in history", () => {
      // Start with a local session in history
      const local: WorkoutSession = {
        _id: "merge-1",
        userId: "test-user",
        startedAt: "2026-06-01T10:00:00.000Z",
        completedAt: "2026-06-01T11:00:00.000Z",
        updatedAt: 100,
        notes: "local version",
        exercises: [
          {
            id: "ex-local",
            exerciseDefinitionId: "bench",
            trackingMode: "strength",
            name: "Bench Press",
            restSeconds: 90,
            notes: "",
            sets: [{ id: "s-local", weight: 80, reps: 10 } as any],
            muscles: ["chest"],
          },
        ],
      };

      const remote: WorkoutSession = {
        _id: "merge-1",
        userId: "test-user",
        startedAt: "2026-06-01T10:00:00.000Z",
        completedAt: "2026-06-01T11:00:00.000Z",
        updatedAt: 200, // higher = wins
        notes: "remote version",
        exercises: [
          {
            id: "ex-remote",
            exerciseDefinitionId: "bench",
            trackingMode: "strength",
            name: "Bench Press",
            restSeconds: 90,
            notes: "",
            sets: [{ id: "s-remote", weight: 100, reps: 8 } as any],
            muscles: ["chest"],
          },
        ],
      };

      useWorkoutSessionStore.setState({
        history: [local],
        historyIndex: ["merge-1"],
      });

      useWorkoutSessionStore.getState().applySyncMerge([remote], 300);
      const merged = useWorkoutSessionStore
        .getState()
        .history.find((w: any) => w._id === "merge-1");
      expect(merged).toBeDefined();
      expect(merged!.notes).toBe("remote version"); // remote won
      expect(merged!.exercises[0].id).toBe("ex-remote");
    });

    it("local workout with higher updatedAt survives (not replaced by remote)", () => {
      const local: WorkoutSession = {
        _id: "merge-2",
        userId: "test-user",
        startedAt: "2026-06-01T10:00:00.000Z",
        completedAt: "2026-06-01T11:00:00.000Z",
        updatedAt: 200, // higher than remote
        notes: "local version",
        exercises: [],
      };

      const remote: WorkoutSession = {
        _id: "merge-2",
        userId: "test-user",
        startedAt: "2026-06-01T10:00:00.000Z",
        completedAt: "2026-06-01T11:00:00.000Z",
        updatedAt: 100,
        notes: "remote version",
        exercises: [],
      };

      useWorkoutSessionStore.setState({
        history: [local],
        historyIndex: ["merge-2"],
      });

      useWorkoutSessionStore.getState().applySyncMerge([remote], 300);
      const merged = useWorkoutSessionStore
        .getState()
        .history.find((w: any) => w._id === "merge-2");
      expect(merged).toBeDefined();
      expect(merged!.notes).toBe("local version");
    });

    it("remote tombstone removes workout from history, historyIndex, dirtyWorkoutIds, deletedWorkoutIds", () => {
      const local: WorkoutSession = {
        _id: "tombstone-1",
        userId: "test-user",
        startedAt: "2026-06-01T10:00:00.000Z",
        completedAt: "2026-06-01T11:00:00.000Z",
        updatedAt: 100,
        notes: "will be deleted",
        exercises: [],
      };

      const tombstone: WorkoutSession = {
        _id: "tombstone-1",
        userId: "test-user",
        startedAt: "2026-06-01T10:00:00.000Z",
        completedAt: undefined,
        updatedAt: 200,
        deletedAt: 200,
        notes: "",
        exercises: [],
      };

      useWorkoutSessionStore.setState({
        history: [local],
        historyIndex: ["tombstone-1"],
        dirtyWorkoutIds: ["tombstone-1"],
        deletedWorkoutIds: [],
      });

      useWorkoutSessionStore.getState().applySyncMerge([tombstone], 300);

      const state = useWorkoutSessionStore.getState();
      expect(state.history.find((w: any) => w._id === "tombstone-1")).toBeUndefined();
      expect(state.historyIndex).not.toContain("tombstone-1");
      expect(state.dirtyWorkoutIds).not.toContain("tombstone-1");
      expect(state.deletedWorkoutIds).not.toContain("tombstone-1");
    });

    it("new remote workouts are appended to history and added to historyIndex", () => {
      const remote: WorkoutSession = {
        _id: "new-remote-1",
        userId: "test-user",
        startedAt: "2026-06-01T10:00:00.000Z",
        completedAt: "2026-06-01T11:00:00.000Z",
        updatedAt: 100,
        notes: "from server",
        exercises: [],
      };

      useWorkoutSessionStore.getState().applySyncMerge([remote], 200);

      const state = useWorkoutSessionStore.getState();
      expect(state.history.some((w: any) => w._id === "new-remote-1")).toBe(true);
      expect(state.historyIndex).toContain("new-remote-1");
    });

    it("hasMoreHistory computed correctly (true when historyIndex.length > history.length)", () => {
      // Add 3 IDs to index but only 1 in history cache
      useWorkoutSessionStore.setState({
        history: [
          {
            _id: "in-cache",
            userId: "test-user",
            startedAt: "2026-06-01T10:00:00.000Z",
            completedAt: "2026-06-01T11:00:00.000Z",
            updatedAt: 100,
            notes: "",
            exercises: [],
          },
        ],
        historyIndex: ["in-cache", "on-disk-1", "on-disk-2"],
      });

      // After merge, should still have more since index > cache
      useWorkoutSessionStore.getState().applySyncMerge([], 200);
      expect(useWorkoutSessionStore.getState().hasMoreHistory).toBe(true);
    });
  });

  // ── Cross-session rename (TEST-014) ─────────

  describe("renameExerciseDefinitionReferences", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("renames all matching exercises in in-memory history", () => {
      const sessionA: WorkoutSession = {
        _id: "sess-a",
        userId: "test-user",
        startedAt: "2026-06-01T10:00:00.000Z",
        completedAt: "2026-06-01T11:00:00.000Z",
        updatedAt: 100,
        notes: "",
        exercises: [
          {
            id: "ex-a1",
            exerciseDefinitionId: "custom-pushup",
            trackingMode: "strength",
            name: "Old Name",
            restSeconds: 60,
            notes: "",
            sets: [],
            muscles: ["chest"],
          },
          {
            id: "ex-a2",
            exerciseDefinitionId: "other-ex",
            trackingMode: "strength",
            name: "Unrelated",
            restSeconds: 60,
            notes: "",
            sets: [],
            muscles: [],
          },
        ],
      };

      useWorkoutSessionStore.setState({
        history: [sessionA],
        historyIndex: ["sess-a"],
        dirtyWorkoutIds: [],
        isDirty: false,
      });

      useWorkoutSessionStore
        .getState()
        .renameExerciseDefinitionReferences("custom-pushup", "Push-Up (Custom)");

      const state = useWorkoutSessionStore.getState();
      const renamedEx = state.history[0].exercises.find((e: any) => e.id === "ex-a1");
      expect(renamedEx!.name).toBe("Push-Up (Custom)");

      // Unrelated exercises not touched
      const unchangedEx = state.history[0].exercises.find((e: any) => e.id === "ex-a2");
      expect(unchangedEx!.name).toBe("Unrelated");

      // Session marked dirty
      expect(state.dirtyWorkoutIds).toContain("sess-a");
      expect(state.isDirty).toBe(true);
    });

    it("shard-only sessions get rewritten and marked dirty", async () => {
      const shardSession: WorkoutSession = {
        _id: "shard-only-1",
        userId: "test-user",
        startedAt: "2026-06-01T10:00:00.000Z",
        completedAt: "2026-06-01T11:00:00.000Z",
        updatedAt: 50,
        notes: "",
        exercises: [
          {
            id: "ex-shard",
            exerciseDefinitionId: "custom-legraise",
            trackingMode: "strength",
            name: "Old Leg Raise",
            restSeconds: 60,
            notes: "",
            sets: [],
            muscles: ["core"],
          },
        ],
      };

      // Mock getBatch to return the shard session
      mockedWorkoutStorage.getBatch.mockResolvedValueOnce([shardSession]);

      useWorkoutSessionStore.setState({
        history: [], // not in memory cache
        historyIndex: ["shard-only-1"],
        dirtyWorkoutIds: [],
        isDirty: false,
      });

      useWorkoutSessionStore
        .getState()
        .renameExerciseDefinitionReferences("custom-legraise", "Leg Raise (Custom)");

      // Flush microtasks so the async shard-rewrite IIFE completes
      // (getBatch then saveBatch are each one await)
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // The shard session should be saved via saveBatch
      expect(mockedWorkoutStorage.saveBatch).toHaveBeenCalled();
      const saved = mockedWorkoutStorage.saveBatch.mock.calls[0][0] as WorkoutSession[];
      const renamed = saved.find((s: WorkoutSession) => s._id === "shard-only-1");
      expect(renamed).toBeDefined();
      expect(renamed!.exercises[0].name).toBe("Leg Raise (Custom)");
    });

    it("activeRestTimer.exerciseName is updated when it references the renamed exercise", () => {
      const session: WorkoutSession = {
        _id: "sess-timer",
        userId: "test-user",
        startedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: 100,
        notes: "",
        exercises: [
          {
            id: "ex-timer",
            exerciseDefinitionId: "custom-plank",
            trackingMode: "strength",
            name: "Old Plank",
            restSeconds: 60,
            notes: "",
            sets: [],
            muscles: ["core"],
          },
        ],
      };

      useWorkoutSessionStore.setState({
        activeSession: session,
        history: [],
        historyIndex: [],
        activeRestTimer: {
          endTime: Date.now() + 30000,
          startTime: Date.now(),
          exerciseId: "ex-timer",
          exerciseName: "Old Plank",
          notificationId: "notif-1",
        },
      });

      useWorkoutSessionStore
        .getState()
        .renameExerciseDefinitionReferences("custom-plank", "Plank (Custom)");

      const timer = useWorkoutSessionStore.getState().activeRestTimer;
      expect(timer).not.toBeNull();
      expect(timer!.exerciseName).toBe("Plank (Custom)");
    });
  });

  describe("updateMusclesInHistory", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("propagates muscle changes to in-memory history sessions", () => {
      const session: WorkoutSession = {
        _id: "muscle-sess",
        userId: "test-user",
        startedAt: "2026-06-01T10:00:00.000Z",
        completedAt: "2026-06-01T11:00:00.000Z",
        updatedAt: 100,
        notes: "",
        exercises: [
          {
            id: "ex-m1",
            exerciseDefinitionId: "bench-press",
            trackingMode: "strength",
            name: "Bench Press",
            restSeconds: 90,
            notes: "",
            sets: [],
            muscles: ["chest"],
          },
        ],
      };

      useWorkoutSessionStore.setState({
        history: [session],
        historyIndex: ["muscle-sess"],
        dirtyWorkoutIds: [],
        isDirty: false,
      });

      useWorkoutSessionStore
        .getState()
        .updateMusclesInHistory("bench-press", ["chest", "shoulder"]);

      const state = useWorkoutSessionStore.getState();
      const updated = state.history[0].exercises[0];
      expect(updated.muscles).toEqual(["chest", "shoulder"]);
      expect(state.dirtyWorkoutIds).toContain("muscle-sess");
      expect(state.isDirty).toBe(true);
    });

    it("propagates muscle changes to shard-only sessions", async () => {
      const shardSession: WorkoutSession = {
        _id: "shard-muscle",
        userId: "test-user",
        startedAt: "2026-06-01T10:00:00.000Z",
        completedAt: "2026-06-01T11:00:00.000Z",
        updatedAt: 50,
        notes: "",
        exercises: [
          {
            id: "ex-sm1",
            exerciseDefinitionId: "pull-up",
            trackingMode: "strength",
            name: "Pull-Up",
            restSeconds: 60,
            notes: "",
            sets: [],
            muscles: ["back"],
          },
        ],
      };

      mockedWorkoutStorage.getBatch.mockResolvedValueOnce([shardSession]);

      useWorkoutSessionStore.setState({
        history: [],
        historyIndex: ["shard-muscle"],
        dirtyWorkoutIds: [],
        isDirty: false,
      });

      useWorkoutSessionStore.getState().updateMusclesInHistory("pull-up", ["back", "arms"]);

      // Flush the async shard rewrite (getBatch -> saveBatch -> mark dirty)
      await new Promise((resolve) => setImmediate(resolve));

      // saveBatch should have been called with the rewritten shard
      expect(mockedWorkoutStorage.saveBatch).toHaveBeenCalled();
      const saved = mockedWorkoutStorage.saveBatch.mock.calls[0][0] as WorkoutSession[];
      const updated = saved.find((s: WorkoutSession) => s._id === "shard-muscle");
      expect(updated).toBeDefined();
      expect(updated!.exercises[0].muscles).toEqual(["back", "arms"]);

      // Marked dirty
      const state = useWorkoutSessionStore.getState();
      expect(state.dirtyWorkoutIds).toContain("shard-muscle");
      expect(state.isDirty).toBe(true);
    });
  });
});
