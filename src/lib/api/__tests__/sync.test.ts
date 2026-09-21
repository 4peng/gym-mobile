// ──────────────────────────────────────────────
// Sync Engine Tests
// ──────────────────────────────────────────────

// NOTE: All jest.mock() factory functions must be self-contained. Module-level
// const/let are in the temporal dead zone when the factories run because jest
// hoists mock() calls above all imports. We inline mock creation instead.

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

jest.mock("@/constants/user", () => ({
  USER_ID: "test-user",
}));

// Store mocks — inline factory creates fresh jest.fn() for getState each time
jest.mock("@/stores/programStore", () => ({
  useProgramStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}));

jest.mock("@/stores/workoutSessionStore", () => ({
  useWorkoutSessionStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}));

// API module mocks
jest.mock("@/lib/api/programs", () => ({
  deleteRemoteProgram: jest.fn(),
  batchUpsertPrograms: jest.fn(),
  fetchPrograms: jest.fn(),
}));

jest.mock("@/lib/api/workouts", () => ({
  deleteRemoteWorkout: jest.fn(),
  batchUpsertWorkouts: jest.fn(),
  fetchWorkouts: jest.fn(),
}));

// ──────────────────────────────────────────────
// Import module under test (imports resolve AFTER mocks are registered)
// ──────────────────────────────────────────────

import { syncPrograms, syncWorkouts, runFullSync } from "@/lib/api/sync";
import type { Program, WorkoutSession } from "@/types";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import {
  deleteRemoteProgram,
  batchUpsertPrograms,
  fetchPrograms,
} from "@/lib/api/programs";
import {
  deleteRemoteWorkout,
  batchUpsertWorkouts,
  fetchWorkouts,
} from "@/lib/api/workouts";

function makeProgram(id: string, updatedAt: number, overrides: Partial<Program> = {}): Program {
  return {
    _id: id,
    userId: "test-user",
    name: `Program ${id}`,
    exercises: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
    ...overrides,
  };
}

function makeWorkoutSession(id: string, updatedAt: number, overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    _id: id,
    userId: "test-user",
    startedAt: "2026-06-01T10:00:00.000Z",
    completedAt: "2026-06-01T11:00:00.000Z",
    updatedAt,
    notes: "",
    exercises: [],
    ...overrides,
  };
}

function getProgramGetState() {
  return (useProgramStore as any).getState;
}

function getWorkoutGetState() {
  return (useWorkoutSessionStore as any).getState;
}

function setupProgramState(overrides: Record<string, any> = {}) {
  const defaults = {
    deletedProgramIds: [],
    dirtyProgramIds: [],
    programs: [],
    lastSyncedAt: null,
    clearDeletedPrograms: jest.fn(),
    clearDirtyPrograms: jest.fn(),
    applySyncMerge: jest.fn(),
  };
  getProgramGetState().mockReturnValue({ ...defaults, ...overrides });
}

function setupWorkoutState(overrides: Record<string, any> = {}) {
  const defaults = {
    history: [],
    historyIndex: [],
    dirtyWorkoutIds: [],
    deletedWorkoutIds: [],
    lastSyncedAt: null,
    clearDeletedWorkouts: jest.fn(),
    clearDirtyWorkouts: jest.fn(),
    applySyncMerge: jest.fn(),
  };
  getWorkoutGetState().mockReturnValue({ ...defaults, ...overrides });
}

describe("syncPrograms", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupProgramState();
    setupWorkoutState();
    (deleteRemoteProgram as jest.Mock).mockResolvedValue(true);
    (batchUpsertPrograms as jest.Mock).mockImplementation((programs: Program[]) => Promise.resolve(programs));
    (fetchPrograms as jest.Mock).mockResolvedValue([]);
  });

  it("when deletedProgramIds is non-empty, calls deleteRemoteProgram for each ID", async () => {
    setupProgramState({
      deletedProgramIds: ["p1", "p2"],
    });

    await syncPrograms();

    expect(deleteRemoteProgram).toHaveBeenCalledTimes(2);
    expect(deleteRemoteProgram).toHaveBeenCalledWith("p1");
    expect(deleteRemoteProgram).toHaveBeenCalledWith("p2");
  });

  it("dirty programs with deletedAt are filtered out before push", async () => {
    const alive = makeProgram("p1", 100);
    const deleted = makeProgram("p2", 100, { deletedAt: 50 });

    setupProgramState({
      dirtyProgramIds: ["p1", "p2"],
      programs: [alive, deleted],
    });

    await syncPrograms();

    expect(batchUpsertPrograms).toHaveBeenCalledTimes(1);
    const pushed = (batchUpsertPrograms as jest.Mock).mock.calls[0][0];
    expect(pushed).toHaveLength(1);
    expect(pushed[0]._id).toBe("p1");
  });

  it("pushStartedAt guard prevents clearing dirtyIds for edits made during sync", async () => {
    const program = makeProgram("p1", 100);
    const mockClearDirty = jest.fn();

    setupProgramState({
      dirtyProgramIds: ["p1"],
      programs: [program],
      clearDirtyPrograms: mockClearDirty,
    });

    let capturedPushStartedAt: number = 0;
    mockClearDirty.mockImplementation((ids: string[], pushedAt: number) => {
      capturedPushStartedAt = pushedAt;
    });

    await syncPrograms();

    expect(mockClearDirty).toHaveBeenCalledWith(["p1"], expect.any(Number));
    expect(capturedPushStartedAt).toBeGreaterThan(0);
  });

  it("watermark uses lastSyncedAt - 10000 (minimum 1)", async () => {
    setupProgramState({ lastSyncedAt: 50000 });
    await syncPrograms();
    expect(fetchPrograms).toHaveBeenCalledWith(40000);
  });

  it("fetch uses undefined since when lastSyncedAt is null (full sync)", async () => {
    setupProgramState({ lastSyncedAt: null });
    await syncPrograms();
    expect(fetchPrograms).toHaveBeenCalledWith(undefined);
  });

  it("watermark uses minimum 1 when lastSyncedAt - 10000 would be <= 0", async () => {
    setupProgramState({ lastSyncedAt: 500 });
    await syncPrograms();
    expect(fetchPrograms).toHaveBeenCalledWith(1);
  });
});

describe("syncWorkouts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupProgramState();
    setupWorkoutState();
    (deleteRemoteWorkout as jest.Mock).mockResolvedValue(true);
    (batchUpsertWorkouts as jest.Mock).mockImplementation((workouts: WorkoutSession[]) => Promise.resolve(workouts));
    (fetchWorkouts as jest.Mock).mockResolvedValue([]);
  });

  it("loads dirty workouts from shards when not in memory cache", async () => {
    const shardWorkout = makeWorkoutSession("w-shard", 100);

    setupWorkoutState({
      history: [],
      historyIndex: ["w-shard"],
      dirtyWorkoutIds: ["w-shard"],
    });

    const { workoutStorage } = require("@/storage/workoutStorage");
    (workoutStorage.getBatch as jest.Mock).mockResolvedValue([shardWorkout]);

    await syncWorkouts();

    expect(workoutStorage.getBatch).toHaveBeenCalledWith(["w-shard"]);
    expect(batchUpsertWorkouts).toHaveBeenCalledTimes(1);
    const pushed = (batchUpsertWorkouts as jest.Mock).mock.calls[0][0];
    expect(pushed).toHaveLength(1);
    expect(pushed[0]._id).toBe("w-shard");
  });

  it("filters out dirty workouts without completedAt or with deletedAt", async () => {
    const incomplete = makeWorkoutSession("w-incomplete", 100, { completedAt: undefined });
    const deleted = makeWorkoutSession("w-deleted", 100, { deletedAt: 50 });
    const valid = makeWorkoutSession("w-valid", 100);

    setupWorkoutState({
      history: [incomplete, deleted, valid],
      historyIndex: ["w-incomplete", "w-deleted", "w-valid"],
      dirtyWorkoutIds: ["w-incomplete", "w-deleted", "w-valid"],
    });

    await syncWorkouts();

    expect(batchUpsertWorkouts).toHaveBeenCalledTimes(1);
    const pushed = (batchUpsertWorkouts as jest.Mock).mock.calls[0][0];
    expect(pushed).toHaveLength(1);
    expect(pushed[0]._id).toBe("w-valid");
  });

  it("handles deletedWorkoutIds by calling deleteRemoteWorkout", async () => {
    setupWorkoutState({ deletedWorkoutIds: ["w-del-1", "w-del-2"] });

    await syncWorkouts();

    expect(deleteRemoteWorkout).toHaveBeenCalledTimes(2);
    expect(deleteRemoteWorkout).toHaveBeenCalledWith("w-del-1");
    expect(deleteRemoteWorkout).toHaveBeenCalledWith("w-del-2");
  });
});

describe("runFullSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupProgramState();
    setupWorkoutState();
    (fetchPrograms as jest.Mock).mockResolvedValue([]);
    (fetchWorkouts as jest.Mock).mockResolvedValue([]);
    (batchUpsertPrograms as jest.Mock).mockImplementation((programs: Program[]) => Promise.resolve(programs));
    (batchUpsertWorkouts as jest.Mock).mockImplementation((workouts: WorkoutSession[]) => Promise.resolve(workouts));
  });

  it("calls both syncPrograms and syncWorkouts", async () => {
    const result = await runFullSync();
    expect(result).toBe(true);
    expect(fetchPrograms).toHaveBeenCalled();
    expect(fetchWorkouts).toHaveBeenCalled();
  });

  it("returns false when syncPrograms fails", async () => {
    setupProgramState({
      dirtyProgramIds: ["p1"],
      programs: [makeProgram("p1", 100)],
    });
    (batchUpsertPrograms as jest.Mock).mockResolvedValue(null);

    const result = await runFullSync();
    expect(result).toBe(false);
  });

  it("handles concurrent calls via _syncing guard (no crash)", async () => {
    const [r1, r2] = await Promise.all([
      runFullSync(),
      runFullSync(),
    ]);
    expect(r1).toBe(true);
    expect(r2).toBe(true);
  });
});
