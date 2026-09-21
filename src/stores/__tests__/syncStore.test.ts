// ──────────────────────────────────────────────
// Sync Store Tests (forceResync)
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Import stores (after mocks)
// ──────────────────────────────────────────────

import { useSyncStore } from "@/stores/syncStore";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { useExerciseLibraryStore } from "@/stores/exerciseLibraryStore";

const mockAsyncStorageMultiRemove = jest.fn();
const mockAsyncStorageGetAllKeys = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  multiSet: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiRemove: (...args: any[]) => mockAsyncStorageMultiRemove(...args),
  getAllKeys: (...args: any[]) => mockAsyncStorageGetAllKeys(...args),
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
      customExercises: [
        { id: "custom-ex-1", name: "My Custom Exercise", muscles: ["chest"] },
      ],
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

// Mock the sync engine
const mockEngineRunFullSync = jest.fn();
jest.mock("@/lib/api/sync", () => ({
  runFullSync: (...args: any[]) => mockEngineRunFullSync(...args),
}));

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("forceResync", () => {
  const programSetState = jest.spyOn(useProgramStore, "setState");
  const workoutSetState = jest.spyOn(useWorkoutSessionStore, "setState");

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset sync store
    useSyncStore.setState({
      isSyncing: false,
      isManualSync: false,
      lastSyncAttempt: null,
      lastSyncSuccess: null,
    });

    // Reset program store
    useProgramStore.setState({
      programs: [
        {
          _id: "prog-1",
          userId: "test-user",
          name: "Old Program",
          exercises: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: 100,
        },
        {
          _id: "prog-2",
          userId: "test-user",
          name: "Another Program",
          exercises: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: 200,
        },
      ],
      deletedProgramIds: ["prog-3"],
      dirtyProgramIds: ["prog-1"],
      isDirty: true,
      lastSyncedAt: 500,
    });

    // Reset workout session store
    useWorkoutSessionStore.setState({
      activeSession: {
        _id: "active-1",
        userId: "test-user",
        startedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: 100,
        notes: "in progress",
        exercises: [],
      },
      history: [
        {
          _id: "hist-1",
          userId: "test-user",
          startedAt: "2026-06-01T09:00:00.000Z",
          completedAt: "2026-06-01T10:00:00.000Z",
          updatedAt: 100,
          notes: "",
          exercises: [],
        },
      ],
      historyIndex: ["hist-1", "hist-2"],
      deletedWorkoutIds: ["hist-del"],
      dirtyWorkoutIds: ["hist-1"],
      hasMoreHistory: false,
      activeRestTimer: {
        endTime: 1000,
        startTime: 500,
        exerciseId: "ex-1",
        exerciseName: "Bench Press",
        notificationId: "notif-1",
      },
      pinnedExerciseNames: ["push-up", "pull-up"],
      activeExerciseId: "ex-1",
      isDirty: true,
      lastSyncedAt: 500,
    });

    mockEngineRunFullSync.mockResolvedValue(true);
    mockAsyncStorageGetAllKeys.mockResolvedValue([
      "program-store",
      "workout-session-store",
      "workout-stats-index-v1",
      "workout_hist-1",
      "workout_hist-2",
      "some-other-key",
      "another-key",
    ]);
  });

  afterEach(() => {
    programSetState.mockClear();
    workoutSetState.mockClear();
  });

  it("clears only app-owned AsyncStorage keys", async () => {
    await useSyncStore.getState().forceResync();

    // Should filter only app-owned keys
    expect(mockAsyncStorageGetAllKeys).toHaveBeenCalled();

    // multiRemove should receive only the app-owned keys
    expect(mockAsyncStorageMultiRemove).toHaveBeenCalledTimes(1);
    const removedKeys = mockAsyncStorageMultiRemove.mock.calls[0][0];
    expect(removedKeys).toContain("program-store");
    expect(removedKeys).toContain("workout-session-store");
    expect(removedKeys).toContain("workout-stats-index-v1");
    expect(removedKeys).toContain("workout_hist-1");
    expect(removedKeys).toContain("workout_hist-2");
    // Should NOT include non-app keys
    expect(removedKeys).not.toContain("some-other-key");
    expect(removedKeys).not.toContain("another-key");
  });

  it("preserves pinnedExerciseNames across reset", async () => {
    await useSyncStore.getState().forceResync();

    // pinnedExerciseNames should have been saved before reset and restored
    const state = useWorkoutSessionStore.getState();
    expect(state.pinnedExerciseNames).toEqual(["push-up", "pull-up"]);
  });

  it("resets programStore state", async () => {
    await useSyncStore.getState().forceResync();

    // programStore setState should have been called with reset values
    expect(programSetState).toHaveBeenCalledWith({
      programs: [],
      deletedProgramIds: [],
      isDirty: false,
      lastSyncedAt: null,
    });
  });

  it("resets workoutSessionStore state (pinnedExerciseNames preserved)", async () => {
    await useSyncStore.getState().forceResync();

    // workoutSessionStore setState should have been called with reset values
    const setStateCall = workoutSetState.mock.calls.find(
      (call: any) => call[0].activeSession === null
    );
    expect(setStateCall).toBeDefined();
    expect(setStateCall![0]).toMatchObject({
      activeSession: null,
      history: [],
      historyIndex: [],
      deletedWorkoutIds: [],
      dirtyWorkoutIds: [],
      hasMoreHistory: true,
      activeRestTimer: null,
      isDirty: false,
      lastSyncedAt: null,
    });
    // pinnedExerciseNames preserved
    expect((setStateCall![0] as { pinnedExerciseNames?: string[] }).pinnedExerciseNames).toEqual(["push-up", "pull-up"]);
  });

  it("triggers full sync after reset", async () => {
    await useSyncStore.getState().forceResync();

    expect(mockEngineRunFullSync).toHaveBeenCalledTimes(1);
  });

  it("custom exercises in exerciseLibraryStore survive (they are local-only)", async () => {
    // Get the exerciseLibrary state before forceResync
    const preState = useExerciseLibraryStore.getState();

    await useSyncStore.getState().forceResync();

    // The exerciseLibraryStore is never touched by forceResync
    // (it only clears program-store and workout-session-store keys)
    // So custom exercises should be untouched
    const postState = useExerciseLibraryStore.getState();
    expect(postState.customExercises).toEqual(preState.customExercises);
    expect(postState.customExercises).toEqual([
      { id: "custom-ex-1", name: "My Custom Exercise", muscles: ["chest"] },
    ]);
  });

  it("returns false when already syncing", async () => {
    useSyncStore.setState({ isSyncing: true });
    const result = await useSyncStore.getState().forceResync();
    expect(result).toBe(false);
    expect(mockEngineRunFullSync).not.toHaveBeenCalled();
  });

  it("returns false and sets lastSyncSuccess to false when engine fails", async () => {
    mockEngineRunFullSync.mockResolvedValue(false);

    const result = await useSyncStore.getState().forceResync();

    expect(result).toBe(false);
    expect(useSyncStore.getState().lastSyncSuccess).toBe(false);
  });

  it("sets isSyncing state correctly during and after forceResync", async () => {
    // Start resync
    const promise = useSyncStore.getState().forceResync();

    // During sync
    expect(useSyncStore.getState().isSyncing).toBe(true);

    await promise;

    // After sync
    expect(useSyncStore.getState().isSyncing).toBe(false);
  });
});
