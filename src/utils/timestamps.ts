export function nextLocalUpdatedAt(lastSyncedAt: number | null): number {
  const now = Date.now();
  return typeof lastSyncedAt === "number" ? Math.max(now, lastSyncedAt + 1) : now;
}
