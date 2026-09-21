import { useMemo } from "react";
import { create } from "zustand";

/**
 * Bumped after every repository write so query hooks re-run.
 * Deliberately coarse: one counter, no per-table invalidation.
 */
const useDbVersion = create<{ version: number; bump: () => void }>()((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export const bumpDbVersion = () => useDbVersion.getState().bump();

/** Runs a synchronous repository query and re-runs it after any write. */
export function useDbQuery<T>(query: () => T, deps: readonly unknown[] = []): T {
  const version = useDbVersion((s) => s.version);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(query, [version, ...deps]);
}
