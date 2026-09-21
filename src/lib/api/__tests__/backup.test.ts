import type { Program, WorkoutSession } from "@/types";

import { backupEverything, isLocalEmpty, pushPending, restoreFromCloud } from "@/lib/api/backup";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { workoutRepo } from "@/db";
import { batchDeletePrograms, batchUpsertPrograms, fetchPrograms } from "@/lib/api/programs";
import { batchDeleteWorkouts, batchUpsertWorkouts, fetchWorkouts } from "@/lib/api/workouts";

jest.mock("@/storage/asyncStorage", () => ({
  zustandAsyncStorage: jest.requireActual("@/stores/__tests__/testStorage").createMemoryStorage(),
}));
jest.mock("@/db", () => {
  const { createWorkoutRepo } = jest.requireActual("@/db/workoutRepo");
  const { createNodeDriver } = jest.requireActual("@/db/__tests__/nodeDriver");
  return { workoutRepo: createWorkoutRepo(createNodeDriver(), "test-user") };
});
jest.mock("@/utils/notifications", () => ({
  scheduleRestCompleteNotification: jest.fn(),
  cancelScheduledNotification: jest.fn(),
}));
jest.mock("@/utils/restTimerLiveActivity", () => ({
  buildActiveRestTimerLiveActivityProps: jest.fn(),
  buildRestTimerLiveActivityProps: jest.fn(),
  endRestTimerLiveActivity: jest.fn(),
  startRestTimerLiveActivity: jest.fn(),
  updateRestTimerLiveActivity: jest.fn(),
}));
jest.mock("@/stores/exerciseLibraryStore", () => ({
  useExerciseLibraryStore: { getState: () => ({ updateCustomExerciseMuscles: jest.fn() }) },
}));
jest.mock("@/stores/uiPreferencesStore", () => ({
  useUiPreferencesStore: { getState: () => ({ preferredWeightUnit: "kg" }) },
}));
jest.mock("@/lib/api/programs", () => ({
  fetchPrograms: jest.fn(),
  batchUpsertPrograms: jest.fn(),
  batchDeletePrograms: jest.fn(),
}));
jest.mock("@/lib/api/workouts", () => ({
  fetchWorkouts: jest.fn(),
  batchUpsertWorkouts: jest.fn(),
  batchDeleteWorkouts: jest.fn(),
}));

const api = {
  fetchPrograms: fetchPrograms as jest.Mock,
  upsertPrograms: batchUpsertPrograms as jest.Mock,
  deletePrograms: batchDeletePrograms as jest.Mock,
  fetchWorkouts: fetchWorkouts as jest.Mock,
  upsertWorkouts: batchUpsertWorkouts as jest.Mock,
  deleteWorkouts: batchDeleteWorkouts as jest.Mock,
};

const program = (id: string): Program => ({
  _id: id,
  userId: "test-user",
  name: id,
  exercises: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: 1,
});
const session = (id: string, updatedAt = 1): WorkoutSession => ({
  _id: id,
  userId: "test-user",
  startedAt: "2026-06-01T10:00:00.000Z",
  completedAt: `2026-06-01T11:00:${id.slice(-2).padStart(2, "0")}.000Z`,
  updatedAt,
  notes: "",
  exercises: [],
});

beforeEach(() => {
  jest.clearAllMocks();
  workoutRepo.clear();
  useProgramStore.setState({ programs: [], dirtyProgramIds: [], deletedProgramIds: [] });
  useWorkoutSessionStore.setState({ dirtyWorkoutIds: [], deletedWorkoutIds: [] });
  api.upsertPrograms.mockImplementation((p: Program[]) => Promise.resolve(p));
  api.upsertWorkouts.mockImplementation((w: WorkoutSession[]) => Promise.resolve(w));
  api.deletePrograms.mockResolvedValue(true);
  api.deleteWorkouts.mockResolvedValue(true);
});

describe("pushPending", () => {
  it("does nothing when nothing is pending", async () => {
    expect(await pushPending()).toBe(true);
    expect(api.upsertPrograms).not.toHaveBeenCalled();
    expect(api.upsertWorkouts).not.toHaveBeenCalled();
  });

  it("pushes deletes then dirty items in chunks of 50 and clears bookkeeping", async () => {
    const sessions = Array.from({ length: 60 }, (_, i) =>
      session(`w${String(i).padStart(2, "0")}`),
    );
    workoutRepo.upsertMany(sessions);
    useProgramStore.setState({
      programs: [program("p1")],
      dirtyProgramIds: ["p1"],
      deletedProgramIds: ["gone-p"],
    });
    useWorkoutSessionStore.setState({
      dirtyWorkoutIds: sessions.map((s) => s._id),
      deletedWorkoutIds: ["gone-w"],
    });

    expect(await pushPending()).toBe(true);
    expect(api.deletePrograms).toHaveBeenCalledWith(["gone-p"]);
    expect(api.deleteWorkouts).toHaveBeenCalledWith(["gone-w"]);
    expect(api.upsertPrograms).toHaveBeenCalledTimes(1);
    expect(api.upsertWorkouts).toHaveBeenCalledTimes(2);
    expect(api.upsertWorkouts.mock.calls[0][0]).toHaveLength(50);
    expect(useProgramStore.getState()).toMatchObject({
      dirtyProgramIds: [],
      deletedProgramIds: [],
    });
    expect(useWorkoutSessionStore.getState()).toMatchObject({
      dirtyWorkoutIds: [],
      deletedWorkoutIds: [],
    });
  });

  it("keeps a workout dirty if it was edited during the push", async () => {
    workoutRepo.upsertMany([session("w1", 1)]);
    useWorkoutSessionStore.setState({ dirtyWorkoutIds: ["w1"] });
    api.upsertWorkouts.mockImplementation(async (w: WorkoutSession[]) => {
      workoutRepo.upsertMany([session("w1", Date.now() + 10_000)]); // concurrent edit lands mid-flight
      return w;
    });
    await pushPending();
    expect(useWorkoutSessionStore.getState().dirtyWorkoutIds).toEqual(["w1"]);
  });

  it("drops dirty ids whose session no longer exists locally", async () => {
    useWorkoutSessionStore.setState({ dirtyWorkoutIds: ["ghost"] });
    await pushPending();
    expect(api.upsertWorkouts).not.toHaveBeenCalled();
    expect(useWorkoutSessionStore.getState().dirtyWorkoutIds).toEqual([]);
  });

  it("returns false and keeps bookkeeping when a request fails", async () => {
    useProgramStore.setState({
      programs: [program("p1")],
      dirtyProgramIds: ["p1"],
      deletedProgramIds: ["gone"],
    });
    api.deletePrograms.mockResolvedValue(false);
    api.upsertPrograms.mockResolvedValue(null);
    expect(await pushPending()).toBe(false);
    expect(useProgramStore.getState()).toMatchObject({
      dirtyProgramIds: ["p1"],
      deletedProgramIds: ["gone"],
    });
  });
});

describe("restoreFromCloud", () => {
  it("pages through every session and replaces local data", async () => {
    workoutRepo.upsertMany([session("local")]);
    useProgramStore.setState({ programs: [program("local")], dirtyProgramIds: ["local"] });
    useWorkoutSessionStore.setState({ dirtyWorkoutIds: ["local"], deletedWorkoutIds: ["x"] });
    api.fetchPrograms.mockResolvedValue([program("c1")]);
    const page1 = Array.from({ length: 200 }, (_, i) => session(`a${String(i).padStart(3, "0")}`));
    api.fetchWorkouts.mockResolvedValueOnce(page1).mockResolvedValueOnce([session("b1")]);

    expect(await restoreFromCloud()).toBe(true);
    expect(api.fetchWorkouts).toHaveBeenNthCalledWith(1, 200, 0);
    expect(api.fetchWorkouts).toHaveBeenNthCalledWith(2, 200, 200);
    expect(workoutRepo.count()).toBe(201);
    expect(workoutRepo.get("local")).toBeNull();
    expect(useProgramStore.getState().programs.map((p) => p._id)).toEqual(["c1"]);
    expect(useProgramStore.getState().dirtyProgramIds).toEqual([]);
    expect(useWorkoutSessionStore.getState()).toMatchObject({
      dirtyWorkoutIds: [],
      deletedWorkoutIds: [],
    });
  });

  it("leaves local data untouched when a fetch fails", async () => {
    workoutRepo.upsertMany([session("local")]);
    api.fetchPrograms.mockResolvedValue([]);
    api.fetchWorkouts.mockResolvedValue(null);
    expect(await restoreFromCloud()).toBe(false);
    expect(workoutRepo.count()).toBe(1);
  });
});

describe("backupEverything / isLocalEmpty", () => {
  it("re-uploads every program and session after flushing pending changes", async () => {
    workoutRepo.upsertMany(Array.from({ length: 3 }, (_, i) => session(`w${i}`)));
    useProgramStore.setState({ programs: [program("p1")], dirtyProgramIds: [] });
    expect(await backupEverything()).toBe(true);
    expect(api.upsertPrograms).toHaveBeenCalledWith([expect.objectContaining({ _id: "p1" })]);
    expect(
      api.upsertWorkouts.mock.calls
        .flatMap((c) => c[0])
        .map((w: WorkoutSession) => w._id)
        .sort(),
    ).toEqual(["w0", "w1", "w2"]);
  });

  it("isLocalEmpty is true only with no programs and no sessions", () => {
    expect(isLocalEmpty()).toBe(true);
    useProgramStore.setState({ programs: [program("p1")] });
    expect(isLocalEmpty()).toBe(false);
  });
});
