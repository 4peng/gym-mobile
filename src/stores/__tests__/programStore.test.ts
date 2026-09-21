import type { ProgramExercise } from "@/types";

import { useProgramStore } from "@/stores/programStore";

jest.mock("@/storage/asyncStorage", () => ({
  zustandAsyncStorage: jest.requireActual("./testStorage").createMemoryStorage(),
}));

const store = () => useProgramStore.getState();
const exercise = (id: string, defId: string, name: string): ProgramExercise => ({
  id,
  exerciseDefinitionId: defId,
  trackingMode: "strength",
  name,
  defaultSets: [{ type: "working" }],
  restSeconds: 90,
  notes: "",
  muscles: [],
});

beforeEach(() =>
  useProgramStore.setState({ programs: [], dirtyProgramIds: [], deletedProgramIds: [] }),
);

describe("programStore", () => {
  it("addProgram stores the program and queues it for backup", () => {
    store().addProgram("Push", [exercise("e1", "barbell-bench-press", "Bench")]);
    const [p] = store().programs;
    expect(p.name).toBe("Push");
    expect(store().dirtyProgramIds).toEqual([p._id]);
  });

  it("updateProgram and togglePin bump updatedAt and mark dirty once", () => {
    store().addProgram("Push", []);
    const id = store().programs[0]._id;
    useProgramStore.setState({ dirtyProgramIds: [] });
    const before = store().programs[0].updatedAt;
    store().updateProgram(id, { name: "Push A" });
    store().togglePin(id);
    const p = store().programs[0];
    expect(p.name).toBe("Push A");
    expect(p.pinned).toBe(true);
    expect(p.updatedAt).toBeGreaterThanOrEqual(before);
    expect(store().dirtyProgramIds).toEqual([id]);
  });

  it("deleteProgram removes it, drops its dirty flag and queues the cloud delete", () => {
    store().addProgram("Push", []);
    const id = store().programs[0]._id;
    store().deleteProgram(id);
    expect(store().programs).toEqual([]);
    expect(store().dirtyProgramIds).toEqual([]);
    expect(store().deletedProgramIds).toEqual([id]);
  });

  it("rename/remove exercise-definition references dirty only the programs that changed", () => {
    store().addProgram("A", [exercise("e1", "custom-x", "Old")]);
    store().addProgram("B", [exercise("e2", "barbell-bench-press", "Bench")]);
    const [a, b] = store().programs;
    useProgramStore.setState({ dirtyProgramIds: [] });

    store().renameExerciseDefinitionReferences("custom-x", "New");
    expect(store().programs[0].exercises[0].name).toBe("New");
    expect(store().dirtyProgramIds).toEqual([a._id]);

    useProgramStore.setState({ dirtyProgramIds: [] });
    store().removeExerciseDefinitionReferences("custom-x");
    expect(store().programs[0].exercises[0].exerciseDefinitionId).toBe("");
    expect(store().programs[1].exercises[0].exerciseDefinitionId).toBe("barbell-bench-press");
    expect(store().dirtyProgramIds).toEqual([a._id]);
    expect(b._id).not.toBe(a._id);
  });

  it("importPrograms replaces everything and leaves nothing pending", () => {
    store().addProgram("Local", []);
    store().deleteProgram(store().programs[0]._id);
    store().importPrograms([
      {
        _id: "c1",
        userId: "u",
        name: "Cloud",
        exercises: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: 5,
      },
    ]);
    expect(store().programs.map((p) => p.name)).toEqual(["Cloud"]);
    expect(store().dirtyProgramIds).toEqual([]);
    expect(store().deletedProgramIds).toEqual([]);
  });

  it("clearDirtyPrograms keeps ids edited after the push started", () => {
    store().addProgram("A", []);
    store().addProgram("B", []);
    const [a, b] = store().programs;
    useProgramStore.setState((s) => ({
      programs: s.programs.map((p) =>
        p._id === b._id ? { ...p, updatedAt: 999_999_999_999_999 } : p,
      ),
    }));
    store().clearDirtyPrograms([a._id, b._id], Date.now());
    expect(store().dirtyProgramIds).toEqual([b._id]);
  });

  it("migrate drops tombstoned programs and legacy sync fields", () => {
    const migrate = useProgramStore.persist.getOptions().migrate!;
    const migrated = migrate(
      {
        programs: [
          { _id: "keep", name: "Keep", exercises: [], updatedAt: 1 },
          { _id: "gone", name: "Gone", exercises: [], updatedAt: 1, deletedAt: 123 },
        ],
        dirtyProgramIds: ["keep"],
        deletedProgramIds: ["gone"],
        isDirty: true,
        lastSyncedAt: 42,
      },
      6,
    ) as any;
    expect(migrated.programs.map((p: { _id: string }) => p._id)).toEqual(["keep"]);
    expect(migrated.programs[0].exercises).toEqual([]);
    expect(migrated).toEqual({
      programs: migrated.programs,
      dirtyProgramIds: ["keep"],
      deletedProgramIds: ["gone"],
    });
  });
});
