// ──────────────────────────────────────────────
// TEST-007: Persistence adapter (mmkv) tests
// ──────────────────────────────────────────────
// Tests the debounced AsyncStorage adapter used by Zustand persist.
// Debounce coalesces rapid writes to the same key into a single
// trailing write ~400ms after the last change.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { zustandAsyncStorage } from "@/storage/mmkv";

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  multiSet: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
}));

jest.mock("react-native", () => {
  const handlers: ((state: string) => void)[] = [];
  return {
    AppState: {
      addEventListener: jest.fn((_event: string, handler: (state: string) => void) => {
        handlers.push(handler);
        return { remove: jest.fn() };
      }),
      currentState: "active",
    },

    _appStateHandlers: handlers,
  };
});

const mockedAsyncStorage = jest.mocked(AsyncStorage);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("zustandAsyncStorage (debounced adapter)", () => {
  // ── setItem debounce behavior ─────────────────

  it("setItem does NOT immediately call AsyncStorage.setItem (debounced)", () => {
    zustandAsyncStorage.setItem("key-1", "value-1");
    expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("setItem with rapid updates to same key coalesces into one AsyncStorage write", () => {
    zustandAsyncStorage.setItem("key-1", "v1");
    zustandAsyncStorage.setItem("key-1", "v2");
    zustandAsyncStorage.setItem("key-1", "v3");

    // Fast-forward past debounce timeout
    jest.advanceTimersByTime(400);

    expect(mockedAsyncStorage.setItem).toHaveBeenCalledTimes(1);
    // Only the last value should be written
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith("key-1", "v3");
  });

  it("setItem to different keys debounce independently", () => {
    zustandAsyncStorage.setItem("key-a", "a1");
    zustandAsyncStorage.setItem("key-b", "b1");
    zustandAsyncStorage.setItem("key-a", "a2");

    jest.advanceTimersByTime(400);

    // key-a: one write with a2, key-b: one write with b1
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledTimes(2);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith("key-a", "a2");
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith("key-b", "b1");
  });

  it("after debounce timeout (400ms), pending write is committed via AsyncStorage.setItem", () => {
    zustandAsyncStorage.setItem("key-1", "value-1");

    // Before timeout — not yet written
    jest.advanceTimersByTime(399);
    expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled();

    // Exactly at timeout — written
    jest.advanceTimersByTime(1);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith("key-1", "value-1");
  });

  // ── removeItem behavior ──────────────────────

  it("removeItem cancels pending write for same key without writing", () => {
    zustandAsyncStorage.setItem("key-1", "will-be-cancelled");

    // removeItem before debounce fires
    zustandAsyncStorage.removeItem("key-1");

    jest.advanceTimersByTime(400);

    // setItem should never have been called
    expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled();
    // removeItem should have been called
    expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith("key-1");
  });

  it("removeItem calls AsyncStorage.removeItem", async () => {
    await zustandAsyncStorage.removeItem("key-1");
    expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith("key-1");
  });

  // ── getItem behavior ─────────────────────────

  it("getItem delegates to AsyncStorage.getItem", async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce("stored-value");
    const result = await zustandAsyncStorage.getItem("key-1");
    expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith("key-1");
    expect(result).toBe("stored-value");
  });

  // ── Sequential setItem→setItem→removeItem ────

  it("sequential setItem→setItem→removeItem on same key never writes (remove cancels pending)", () => {
    zustandAsyncStorage.setItem("key-1", "v1");
    zustandAsyncStorage.setItem("key-1", "v2");
    zustandAsyncStorage.removeItem("key-1");

    jest.advanceTimersByTime(400);

    // setItem should never fire
    expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled();
    // removeItem should have been called exactly once
    expect(mockedAsyncStorage.removeItem).toHaveBeenCalledTimes(1);
    expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith("key-1");
  });
});
