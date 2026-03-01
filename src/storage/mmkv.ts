import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from "zustand/middleware";

/**
 * Zustand-compatible StateStorage adapter using AsyncStorage.
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
