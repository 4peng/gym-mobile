import AsyncStorage from "@react-native-async-storage/async-storage";
import { createNodeDriver } from "./nodeDriver";
import { createWorkoutRepo } from "../workoutRepo";
import { migrateFromAsyncStorage } from "../migrateFromAsyncStorage";

jest.mock("../dbVersion", () => ({ bumpDbVersion: jest.fn() }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const shard = (id: string, completed: boolean) =>
  JSON.stringify({
    _id: id,
    startedAt: "2026-06-01T10:00:00.000Z",
    completedAt: completed ? "2026-06-01T11:00:00.000Z" : undefined,
    exercises: [
      {
        id: `${id}-e`,
        name: "Bench",
        trackingMode: "strength",
        sets: [{ id: "s", weight: 100, reps: 5 }],
      },
    ],
  });

beforeEach(() => jest.clearAllMocks());

describe("migrateFromAsyncStorage", () => {
  it("imports completed shards, skips incomplete and corrupt ones, then removes the keys", async () => {
    storage.getAllKeys.mockResolvedValue([
      "workout_a",
      "workout_b",
      "workout_bad",
      "workout-stats-index-v1",
      "program-store",
    ]);
    storage.multiGet.mockResolvedValue([
      ["workout_a", shard("a", true)],
      ["workout_b", shard("b", false)],
      ["workout_bad", "{not json"],
    ]);
    const repo = createWorkoutRepo(createNodeDriver(), "u");

    expect(await migrateFromAsyncStorage(repo)).toBe(1);
    expect(repo.get("a")?.exercises[0].sets[0].weight).toBe(100);
    expect(repo.count()).toBe(1);
    expect(storage.multiRemove).toHaveBeenCalledWith([
      "workout_a",
      "workout_b",
      "workout_bad",
      "workout-stats-index-v1",
    ]);
  });

  it("is a no-op once no legacy keys remain", async () => {
    storage.getAllKeys.mockResolvedValue(["program-store"]);
    const repo = createWorkoutRepo(createNodeDriver(), "u");
    expect(await migrateFromAsyncStorage(repo)).toBe(0);
    expect(storage.multiGet).not.toHaveBeenCalled();
  });
});
