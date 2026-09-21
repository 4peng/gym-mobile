// ──────────────────────────────────────────────
// TEST-008: Workout shard storage tests
// ──────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import { workoutStorage } from "@/storage/workoutStorage";
import type { WorkoutSession } from "@/types";

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  multiSet: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
}));

const mockedAsyncStorage = jest.mocked(AsyncStorage);

function makeWorkout(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    _id: "ws-1",
    userId: "user-1",
    startedAt: "2026-06-01T10:00:00.000Z",
    completedAt: "2026-06-01T11:00:00.000Z",
    updatedAt: 200,
    notes: "test workout",
    cumulativeRestSeconds: 0,
    exercises: [
      {
        id: "ex-1",
        exerciseDefinitionId: "bench-press",
        trackingMode: "strength",
        name: "Bench Press",
        restSeconds: 90,
        notes: "",
        sets: [
          {
            id: "s-1",
            weight: 100,
            reps: 10,
            type: "working",
            durationSeconds: null,
            distance: null,
            completedAt: "2026-06-01T10:05:00.000Z",
          },
          {
            id: "s-2",
            weight: 110,
            reps: 8,
            type: "working",
            durationSeconds: null,
            distance: null,
          },
        ],
        weightUnit: "kg",
        muscles: ["chest"],
        isBodyweight: false,
      },
    ],
    ...overrides,
  };
}

function makeTimedWorkout(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    _id: "ws-timed",
    userId: "user-1",
    startedAt: "2026-06-01T10:00:00.000Z",
    completedAt: "2026-06-01T10:30:00.000Z",
    updatedAt: 300,
    notes: "timed workout",
    cumulativeRestSeconds: 0,
    exercises: [
      {
        id: "ex-t1",
        exerciseDefinitionId: "plank",
        trackingMode: "timed",
        name: "Plank",
        restSeconds: 30,
        notes: "",
        sets: [
          {
            id: "st-1",
            weight: null,
            reps: null,
            type: "working",
            durationSeconds: 60,
            distance: null,
          },
          {
            id: "st-2",
            weight: null,
            reps: null,
            type: "working",
            durationSeconds: 45,
            distance: null,
          },
        ],
        weightUnit: "kg",
        muscles: ["core"],
        isBodyweight: false,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("workoutStorage", () => {
  describe("save then get round-trip", () => {
    it("preserves all fields through a save->get cycle", async () => {
      const workout = makeWorkout();
      mockedAsyncStorage.setItem.mockResolvedValueOnce(undefined);
      mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(workout));

      await workoutStorage.save(workout);
      const loaded = await workoutStorage.get(workout._id);

      expect(loaded).toEqual(workout);
    });
  });

  describe("saveBatch then getBatch", () => {
    it("returns multiple workouts", async () => {
      const w1 = makeWorkout({ _id: "batch-1" });
      const w2 = makeWorkout({ _id: "batch-2" });

      mockedAsyncStorage.multiSet.mockResolvedValueOnce(undefined);
      mockedAsyncStorage.multiGet.mockResolvedValueOnce([
        ["workout_batch-1", JSON.stringify(w1)],
        ["workout_batch-2", JSON.stringify(w2)],
      ]);

      await workoutStorage.saveBatch([w1, w2]);
      const loaded = await workoutStorage.getBatch(["batch-1", "batch-2"]);

      expect(loaded).toHaveLength(2);
      expect(loaded.find((w) => w._id === "batch-1")).toEqual(w1);
      expect(loaded.find((w) => w._id === "batch-2")).toEqual(w2);
    });
  });

  describe("get returns null for missing key", () => {
    it("returns null when there is no stored data", async () => {
      mockedAsyncStorage.getItem.mockResolvedValueOnce(null);
      const result = await workoutStorage.get("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("getBatch filters null results", () => {
    it("returns only the valid workouts, skipping null/missing", async () => {
      const w1 = makeWorkout({ _id: "exists" });
      mockedAsyncStorage.multiGet.mockResolvedValueOnce([
        ["workout_exists", JSON.stringify(w1)],
        ["workout_missing", null],
      ]);

      const loaded = await workoutStorage.getBatch(["exists", "missing"]);
      expect(loaded).toHaveLength(1);
      expect(loaded[0]._id).toBe("exists");
    });
  });

  describe("remove truly deletes the key", () => {
    it("get returns null after remove", async () => {
      const workout = makeWorkout();
      mockedAsyncStorage.setItem.mockResolvedValueOnce(undefined);
      mockedAsyncStorage.removeItem.mockResolvedValueOnce(undefined);
      mockedAsyncStorage.getItem.mockResolvedValueOnce(null);

      await workoutStorage.save(workout);
      await workoutStorage.remove(workout._id);
      const loaded = await workoutStorage.get(workout._id);

      expect(loaded).toBeNull();
      expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith("workout_ws-1");
    });
  });

  describe("normalizeWorkoutSession applies tracking mode normalization", () => {
    it("normalizes timed-mode sets (drops reps/weight, keeps durationSeconds)", async () => {
      const workout = makeTimedWorkout();
      mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(workout));

      const loaded = await workoutStorage.get(workout._id);
      expect(loaded).not.toBeNull();
      expect(loaded!.exercises[0].trackingMode).toBe("timed");

      // timed-mode sets should have reps/weight null and durationSeconds preserved
      expect(loaded!.exercises[0].sets[0].reps).toBeNull();
      expect(loaded!.exercises[0].sets[0].weight).toBeNull();
      expect(loaded!.exercises[0].sets[0].durationSeconds).toBe(60);
    });

    it("normalizes cardio-mode sets (drops reps/weight, keeps distance)", async () => {
      const workout = makeWorkout({
        _id: "ws-cardio",
        exercises: [
          {
            id: "ex-c1",
            exerciseDefinitionId: "run",
            trackingMode: "cardio",
            name: "Run",
            restSeconds: 0,
            notes: "",
            sets: [{ id: "sc-1", weight: null, reps: null, durationSeconds: 600, distance: 2.5 }],
            weightUnit: undefined,
            muscles: ["quads"],
          },
        ],
      });
      mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(workout));

      const loaded = await workoutStorage.get(workout._id);
      expect(loaded).not.toBeNull();
      expect(loaded!.exercises[0].trackingMode).toBe("cardio");
      expect(loaded!.exercises[0].sets[0].reps).toBeNull();
      expect(loaded!.exercises[0].sets[0].distance).toBe(2.5);
    });
  });
});
