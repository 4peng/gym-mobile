import * as backup from "@/lib/api/backup";
import { useSyncStore } from "@/stores/syncStore";

jest.mock("@/lib/api/backup", () => ({
  pushPending: jest.fn(),
  backupEverything: jest.fn(),
  restoreFromCloud: jest.fn(),
}));
const mockBackup = backup as jest.Mocked<typeof backup>;

beforeEach(() => {
  jest.clearAllMocks();
  useSyncStore.setState({ isSyncing: false, lastSyncAttempt: null, lastSyncSuccess: null });
});

describe("syncStore", () => {
  it("pushPending delegates and records success", async () => {
    mockBackup.pushPending.mockResolvedValue(true);
    expect(await useSyncStore.getState().pushPending()).toBe(true);
    expect(mockBackup.pushPending).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState()).toMatchObject({ isSyncing: false, lastSyncSuccess: true });
    expect(useSyncStore.getState().lastSyncAttempt).not.toBeNull();
  });

  it("records failure when the operation reports false or throws", async () => {
    mockBackup.backupEverything.mockResolvedValue(false);
    expect(await useSyncStore.getState().backupEverything()).toBe(false);
    expect(useSyncStore.getState().lastSyncSuccess).toBe(false);

    mockBackup.restoreFromCloud.mockRejectedValue(new Error("boom"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(await useSyncStore.getState().restoreFromCloud()).toBe(false);
    expect(useSyncStore.getState().isSyncing).toBe(false);
    spy.mockRestore();
  });

  it("refuses to start while another operation is running", async () => {
    let resolve!: (v: boolean) => void;
    mockBackup.pushPending.mockReturnValue(new Promise<boolean>((r) => (resolve = r)));
    const first = useSyncStore.getState().pushPending();
    expect(useSyncStore.getState().isSyncing).toBe(true);
    expect(await useSyncStore.getState().restoreFromCloud()).toBe(false);
    expect(mockBackup.restoreFromCloud).not.toHaveBeenCalled();
    resolve(true);
    expect(await first).toBe(true);
    expect(useSyncStore.getState().isSyncing).toBe(false);
  });
});
