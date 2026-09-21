export function nextLocalUpdatedAt(lastSyncedAt: number | null): number {
  const now = Date.now();
  return typeof lastSyncedAt === "number" ? Math.max(now, lastSyncedAt + 1) : now;
}

/** Newest-first by completion date; undated sessions sort last. */
export function byCompletedAtDesc(
  a: { completedAt?: string },
  b: { completedAt?: string },
): number {
  const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
  const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
  return bTime - aTime;
}

/** Swaps the calendar date of an ISO timestamp, keeping its time-of-day. */
export const withDatePart = (iso: string, yyyyMmDd: string): string =>
  `${yyyyMmDd}T${iso.split("T")[1] || "12:00:00.000Z"}`;
