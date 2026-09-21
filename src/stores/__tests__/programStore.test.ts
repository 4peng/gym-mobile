// ──────────────────────────────────────────────
// Program Store Tests
// ──────────────────────────────────────────────

// Mock native / side-effect modules before importing the store
import { useProgramStore } from "@/stores/programStore";
import type { Program } from "@/types";

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

jest.mock("@/constants/user", () => ({
  USER_ID: "test-user",
}));

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("ProgramStore", () => {
  beforeEach(() => {
    useProgramStore.setState({
      programs: [],
      deletedProgramIds: [],
      dirtyProgramIds: [],
      isDirty: false,
      lastSyncedAt: null,
    });
  });

  describe("applySyncMerge", () => {
    it("remote program with higher updatedAt replaces local", () => {
      const local = makeProgram("p1", 100, { name: "Local Name" });
      const remote = makeProgram("p1", 200, { name: "Remote Name" });

      useProgramStore.setState({ programs: [local] });
      useProgramStore.getState().applySyncMerge([remote], 300);

      const programs = useProgramStore.getState().programs;
      expect(programs).toHaveLength(1);
      expect(programs[0].name).toBe("Remote Name");
      expect(programs[0].updatedAt).toBe(200);
    });

    it("local program with higher updatedAt survives (is not replaced)", () => {
      const local = makeProgram("p2", 200, { name: "Local Name" });
      const remote = makeProgram("p2", 100, { name: "Remote Name" });

      useProgramStore.setState({ programs: [local] });
      useProgramStore.getState().applySyncMerge([remote], 300);

      const programs = useProgramStore.getState().programs;
      expect(programs).toHaveLength(1);
      expect(programs[0].name).toBe("Local Name");
    });

    it("remote programs not in local are appended", () => {
      const local = makeProgram("p1", 100);
      const remote1 = makeProgram("p2", 100);
      const remote2 = makeProgram("p3", 100);

      useProgramStore.setState({ programs: [local] });
      useProgramStore.getState().applySyncMerge([remote1, remote2], 300);

      const programs = useProgramStore.getState().programs;
      expect(programs).toHaveLength(3);
      expect(programs.some((p: any) => p._id === "p2")).toBe(true);
      expect(programs.some((p: any) => p._id === "p3")).toBe(true);
    });

    it("remote tombstones (deletedAt set) are filtered out (not added to programs)", () => {
      const tombstone = makeProgram("dead-1", 200, { deletedAt: 200 });
      const normal = makeProgram("alive-1", 100);

      useProgramStore.getState().applySyncMerge([tombstone, normal], 300);

      const programs = useProgramStore.getState().programs;
      expect(programs.some((p: any) => p._id === "dead-1")).toBe(false);
      expect(programs.some((p: any) => p._id === "alive-1")).toBe(true);
    });

    it("existing local program replaced by remote tombstone is removed from programs", () => {
      const local = makeProgram("p1", 100, { name: "Will be deleted" });
      const tombstone = makeProgram("p1", 200, { deletedAt: 200 });

      useProgramStore.setState({ programs: [local] });
      useProgramStore.getState().applySyncMerge([tombstone], 300);

      const programs = useProgramStore.getState().programs;
      expect(programs.some((p: any) => p._id === "p1")).toBe(false);
    });

    it("isDirty computed correctly from remaining dirtyProgramIds + deletedProgramIds", () => {
      useProgramStore.setState({
        programs: [makeProgram("p1", 100)],
        dirtyProgramIds: ["p1"],
        deletedProgramIds: [],
      });

      // Merge empty remote to trigger lastSyncedAt bump and isDirty recompute
      useProgramStore.getState().applySyncMerge([], 300);

      const state = useProgramStore.getState();
      expect(state.isDirty).toBe(true); // dirtyProgramIds still has "p1"
      expect(state.lastSyncedAt).toBe(300);
    });

    it("isDirty is false when no dirtyProgramIds and no deletedProgramIds", () => {
      useProgramStore.setState({
        programs: [makeProgram("p1", 100)],
        dirtyProgramIds: [],
        deletedProgramIds: [],
      });

      useProgramStore.getState().applySyncMerge([], 300);

      const state = useProgramStore.getState();
      expect(state.isDirty).toBe(false);
      expect(state.lastSyncedAt).toBe(300);
    });

    it("programs with deletedAt are filtered only when historyChanged flag is set", () => {
      // When a program already has deletedAt locally and remote is the same,
      // the merge should still filter it out
      const local = makeProgram("p1", 100, { deletedAt: 100 });
      const remote = makeProgram("p1", 100);

      useProgramStore.setState({ programs: [local] });
      useProgramStore.getState().applySyncMerge([remote], 300);

      // p1 has local.updatedAt === remote.updatedAt (100 === 100),
      // so local wins (lp.updatedAt >= rp.updatedAt).
      // But local has deletedAt so historyChanged is true and filter runs.
      const programs = useProgramStore.getState().programs;
      expect(programs.some((p: any) => p._id === "p1")).toBe(false);
    });

    it("merges multiple programs with mixed wins", () => {
      const local1 = makeProgram("p1", 300, { name: "Local wins" });
      const local2 = makeProgram("p2", 50, { name: "Remote wins" });
      const remote1 = makeProgram("p1", 200, { name: "Remote loses" });
      const remote2 = makeProgram("p2", 100, { name: "Remote wins here" });

      useProgramStore.setState({ programs: [local1, local2] });
      useProgramStore.getState().applySyncMerge([remote1, remote2], 300);

      const programs = useProgramStore.getState().programs;
      expect(programs).toHaveLength(2);
      expect(programs.find((p: any) => p._id === "p1")!.name).toBe("Local wins");
      expect(programs.find((p: any) => p._id === "p2")!.name).toBe("Remote wins here");
    });
  });
});
