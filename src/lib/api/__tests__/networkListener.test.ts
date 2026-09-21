/* eslint-disable @typescript-eslint/no-require-imports -- jest.resetModules() needs a synchronous re-require */
let mockPushPending = jest.fn(() => Promise.resolve(true));
const mockRestore = jest.fn(() => Promise.resolve(true));
let mockLocalEmpty = false;

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: false, isInternetReachable: false })),
}));
jest.mock("@/stores/syncStore", () => ({
  useSyncStore: {
    getState: () => ({ pushPending: mockPushPending, restoreFromCloud: mockRestore }),
  },
}));
jest.mock("@/lib/api/backup", () => ({ isLocalEmpty: () => mockLocalEmpty }));
jest.mock("react-native", () => ({
  InteractionManager: { runAfterInteractions: (cb: () => void) => cb() },
}));

const netState = (online: boolean) => ({ isConnected: online, isInternetReachable: online });
const netinfo = () =>
  jest.requireMock("@react-native-community/netinfo") as {
    addEventListener: jest.Mock;
    fetch: jest.Mock;
  };
const handler = () => netinfo().addEventListener.mock.calls[0][0];

/** Fresh module so the module-level throttle / offline flags reset. */
async function start(startupOnline = false) {
  jest.resetModules();
  netinfo().fetch.mockResolvedValue(netState(startupOnline));
  const { startNetworkSyncListener } = require("@/lib/api/networkListener");
  const unsub = startNetworkSyncListener();
  await Promise.resolve();
  await Promise.resolve();
  return unsub;
}

beforeEach(() => {
  mockPushPending = jest.fn(() => Promise.resolve(true));
  mockRestore.mockClear();
  mockLocalEmpty = false;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe("startNetworkSyncListener", () => {
  it("does not push while offline; pushes once connectivity returns", async () => {
    const unsub = await start(false);
    expect(mockPushPending).not.toHaveBeenCalled();
    handler()(netState(true));
    expect(mockPushPending).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("restores instead of pushing when a reconnect finds an empty install", async () => {
    mockLocalEmpty = true;
    await start(false);
    handler()(netState(true));
    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(mockPushPending).not.toHaveBeenCalled();
  });

  it("throttles a second reconnect inside 60s", async () => {
    await start(false);
    handler()(netState(true));
    handler()(netState(false));
    handler()(netState(true));
    expect(mockPushPending).toHaveBeenCalledTimes(1);
  });

  it("clears the throttle when a push fails so the next reconnect retries", async () => {
    mockPushPending = jest.fn(() => Promise.resolve(false));
    await start(false);
    handler()(netState(true));
    await Promise.resolve();
    handler()(netState(false));
    handler()(netState(true));
    expect(mockPushPending).toHaveBeenCalledTimes(2);
  });

  it("on an online startup pushes pending changes, or restores when local is empty", async () => {
    await start(true);
    expect(mockPushPending).toHaveBeenCalledTimes(1);
    expect(mockRestore).not.toHaveBeenCalled();

    mockLocalEmpty = true;
    await start(true);
    expect(mockRestore).toHaveBeenCalledTimes(1);
  });
});
