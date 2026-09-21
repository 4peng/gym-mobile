// ──────────────────────────────────────────────
// TEST-009: Network listener tests
// ──────────────────────────────────────────────

let mockRunFullSync = jest.fn(() => Promise.resolve(true));

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({ isConnected: false, isInternetReachable: false })
  ),
}));

jest.mock("@/stores/syncStore", () => ({
  useSyncStore: {
    getState: jest.fn(() => ({
      isSyncing: false,
      isManualSync: false,
      lastSyncAttempt: null,
      lastSyncSuccess: null,
      backgroundSync: jest.fn(() => Promise.resolve(true)),
      runFullSync: mockRunFullSync,
      runManualSync: jest.fn(),
      forceResync: jest.fn(),
    })),
  },
}));

jest.mock("react-native", () => ({
  InteractionManager: { runAfterInteractions: jest.fn((cb: () => void) => cb()) },
}));

import NetInfo from "@react-native-community/netinfo";

const mockedNetInfo = jest.mocked(NetInfo);
const addEventListenerMock = mockedNetInfo.addEventListener as jest.Mock;

/** Returns a minimal NetInfoState-like object. */
function netState(connected: boolean): any {
  return { isConnected: connected, isInternetReachable: connected };
}

beforeEach(() => {
  // Reset mock call history and set default fetch to offline
  addEventListenerMock.mockClear();
  (mockedNetInfo.fetch as jest.Mock).mockClear();
  (mockedNetInfo.fetch as jest.Mock).mockResolvedValue(netState(false));
  mockRunFullSync = jest.fn(() => Promise.resolve(true));
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("startNetworkSyncListener", () => {
  it("connectivity change from offline->online triggers sync", async () => {
    // Load fresh module to reset _wasOffline / _lastSyncTriggeredAt
    jest.resetModules();
    const { startNetworkSyncListener } = require("@/lib/api/networkListener");
    const unsub = startNetworkSyncListener();
    // Flush startup NetInfo.fetch().then() which sets _wasOffline = true
    await Promise.resolve();

    const handler = addEventListenerMock.mock.calls[0][0];

    // Switch to online
    handler(netState(true));

    expect(mockRunFullSync).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("second reconnect within 60s is throttled", async () => {
    jest.resetModules();
    const { startNetworkSyncListener } = require("@/lib/api/networkListener");
    const unsub = startNetworkSyncListener();
    await Promise.resolve();

    const handler = addEventListenerMock.mock.calls[0][0];

    handler(netState(true));
    expect(mockRunFullSync).toHaveBeenCalledTimes(1);

    // Quick offline->online again
    handler(netState(false));
    handler(netState(true));
    expect(mockRunFullSync).toHaveBeenCalledTimes(1); // throttled

    unsub();
  });

  it("failed sync resets throttle so next reconnect retries", async () => {
    mockRunFullSync = jest.fn(() => Promise.resolve(false));

    jest.resetModules();
    const { startNetworkSyncListener } = require("@/lib/api/networkListener");
    const unsub = startNetworkSyncListener();
    await Promise.resolve();

    const handler = addEventListenerMock.mock.calls[0][0];

    // First reconnect triggers sync (fails)
    handler(netState(true));
    expect(mockRunFullSync).toHaveBeenCalledTimes(1);

    // Flush microtask so .then(false => reset throttle) runs
    await Promise.resolve();

    // Reconnect again within 60s — should retry because throttle was reset
    handler(netState(false));
    handler(netState(true));
    expect(mockRunFullSync).toHaveBeenCalledTimes(2);

    unsub();
  });

  it("startup sets _wasOffline when offline (no sync on startup)", async () => {
    jest.resetModules();
    const { startNetworkSyncListener } = require("@/lib/api/networkListener");
    const unsub = startNetworkSyncListener();
    await Promise.resolve();

    const handler = addEventListenerMock.mock.calls[0][0];

    // No sync on startup because offline
    expect(mockRunFullSync).not.toHaveBeenCalled();

    // Go online
    handler(netState(true));
    expect(mockRunFullSync).toHaveBeenCalledTimes(1);

    unsub();
  });
});
