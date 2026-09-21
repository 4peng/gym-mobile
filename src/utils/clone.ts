/** Deep copy via JSON. Hermes has no structuredClone; all cloned state is JSON-safe. */
export const safeClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
