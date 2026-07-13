import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from "zustand/middleware";

/**
 * Zustand-compatible StateStorage adapter.
 *
 * NOTE: This module is named `mmkv` for historical reasons only. Persistence is
 * backed by the async `@react-native-async-storage/async-storage`, NOT by MMKV.
 * There is no synchronous storage layer in this app; all persisted stores use
 * this async adapter. (Kept the filename to avoid churning every import site.)
 */
export const zustandAsyncStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return await AsyncStorage.getItem(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await AsyncStorage.removeItem(name);
  },
};
