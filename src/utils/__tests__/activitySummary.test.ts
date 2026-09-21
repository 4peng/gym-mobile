import { buildActivitySummary, formatDurationMinutes } from "@/utils/activitySummary";
import type { WorkoutSession } from "@/types";

// Timezone-independent test helpers:
// The key values emitted by buildActivitySummary are `startOfDay(date).getTime()`
// which depends on the local timezone. Instead of hardcoding timestamps that
// only work in one timezone (like GMT+0800), we compute expected keys using the
// same `startOfDay` logic. This makes every assertion timezone-agnostic.

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function session(id: string, startedAt: string, completedAt: string): WorkoutSession {
  return {
    _id: id,
    userId: "u1",
    startedAt,
    completedAt,
    updatedAt: Date.parse(completedAt),
    notes: "",
    exercises: [],
  };
}

describe("formatDurationMinutes", () => {
  it("renders whole minutes when under an hour", () => {
    expect(formatDurationMinutes(0)).toBe("0m");
    expect(formatDurationMinutes(45)).toBe("45m");
  });

  it("renders bare hours when there is no remainder", () => {
    expect(formatDurationMinutes(60)).toBe("1h");
  });

  it("renders hours and minutes together", () => {
    expect(formatDurationMinutes(90)).toBe("1h 30m");
  });

  it("clamps negative input to 0m", () => {
    expect(formatDurationMinutes(-5)).toBe("0m");
  });

  it("rounds fractional minutes before converting to hours", () => {
    // 59.6 rounds to 60 -> 1h, not 59m
    expect(formatDurationMinutes(59.6)).toBe("1h");
  });
});

describe("buildActivitySummary - week mode", () => {
  const now = new Date(2026, 0, 15, 12, 0, 0, 0); // Thu Jan 15 2026, local noon

  it("buckets sessions into 7 daily points from 6-days-ago through today", () => {
    const rangeStart = startOfDay(shiftDays(now, -6));
    const day6 = startOfDay(shiftDays(rangeStart, 6));

    const history: WorkoutSession[] = [
      session("a", "2026-01-15T09:00:00.000", "2026-01-15T10:00:00.000"), // today, 60 min
      session("b", "2026-01-09T09:00:00.000", "2026-01-09T09:30:00.000"), // 6 days ago (range start), 30 min
      session("c", "2026-01-01T09:00:00.000", "2026-01-01T09:10:00.000"), // outside range, ignored
    ];

    const summary = buildActivitySummary(history, "week", now);

    expect(summary.points).toHaveLength(7);
    expect(summary.points[0]).toEqual({
      key: `${rangeStart.getTime()}`,
      label: "Fri",
      minutes: 30,
    });
    expect(summary.points.slice(1, 6).every((p) => p.minutes === 0)).toBe(true);
    expect(summary.points[6]).toEqual({ key: `${day6.getTime()}`, label: "Thu", minutes: 60 });

    expect(summary.totalMinutes).toBe(90);
    expect(summary.sessions).toBe(2); // session "c" excluded as out of range
    expect(summary.averageMinutes).toBe(45);
    expect(summary.bestMinutes).toBe(60);
    expect(summary.rangeLabel).toBe("JAN 9 - JAN 15");
  });

  it("returns all-zero points and rangeLabel for empty history", () => {
    const summary = buildActivitySummary([], "week", now);
    expect(summary.points).toHaveLength(7);
    expect(summary.points.every((p) => p.minutes === 0)).toBe(true);
    expect(summary.totalMinutes).toBe(0);
    expect(summary.sessions).toBe(0);
    expect(summary.averageMinutes).toBe(0);
    expect(summary.bestMinutes).toBe(0);
    expect(summary.rangeLabel).toBe("JAN 9 - JAN 15");
  });
});

describe("buildActivitySummary - month mode", () => {
  const now = new Date(2026, 0, 15, 12, 0, 0, 0);

  it("buckets sessions into 4 weekly points over the trailing 28 days", () => {
    const rangeStart = startOfDay(shiftDays(now, -27));

    const history: WorkoutSession[] = [
      session("a", "2026-01-15T09:00:00.000", "2026-01-15T10:00:00.000"), // last bucket, 60 min
      session("b", "2025-12-20T09:00:00.000", "2025-12-20T09:45:00.000"), // first bucket, 45 min
    ];

    const summary = buildActivitySummary(history, "month", now);

    const expectedKeys = [0, 1, 2, 3].map(
      (i) => `${startOfDay(shiftDays(rangeStart, i * 7)).getTime()}`,
    );

    expect(summary.points).toHaveLength(4);
    expect(summary.points[0]).toEqual({ key: expectedKeys[0], label: "Dec 19", minutes: 45 });
    expect(summary.points[1]).toEqual({ key: expectedKeys[1], label: "Dec 26", minutes: 0 });
    expect(summary.points[2]).toEqual({ key: expectedKeys[2], label: "Jan 2", minutes: 0 });
    expect(summary.points[3]).toEqual({ key: expectedKeys[3], label: "Jan 9", minutes: 60 });

    expect(summary.totalMinutes).toBe(105);
    expect(summary.sessions).toBe(2);
    expect(summary.averageMinutes).toBe(53); // Math.round(105/2)
    expect(summary.bestMinutes).toBe(60);
    expect(summary.rangeLabel).toBe("DEC 19 - JAN 15");
  });
});

describe("buildActivitySummary - year mode", () => {
  const now = new Date(2026, 0, 15, 12, 0, 0, 0);

  it("buckets sessions into 12 monthly points over the trailing 12 months", () => {
    const history: WorkoutSession[] = [
      session("a", "2026-01-15T09:00:00.000", "2026-01-15T10:00:00.000"), // current month, 60 min
      session("b", "2025-02-10T09:00:00.000", "2025-02-10T09:45:00.000"), // first bucket month, 45 min
    ];

    const summary = buildActivitySummary(history, "year", now);

    // Compute expected month-start keys using the same logic as the source
    const expectedFirstKey = `${new Date(2025, 1, 1).getTime()}`;
    const expectedLastKey = `${new Date(now.getFullYear(), now.getMonth(), 1).getTime()}`;

    expect(summary.points).toHaveLength(12);
    expect(summary.points[0]).toEqual({ key: expectedFirstKey, label: "Feb", minutes: 45 });
    expect(summary.points[summary.points.length - 1]).toEqual({
      key: expectedLastKey,
      label: "Jan",
      minutes: 60,
    });
    expect(summary.points.slice(1, 11).every((p) => p.minutes === 0)).toBe(true);

    expect(summary.totalMinutes).toBe(105);
    expect(summary.sessions).toBe(2);
    expect(summary.averageMinutes).toBe(53);
    expect(summary.bestMinutes).toBe(60);
    expect(summary.rangeLabel).toBe("FEB 2025 - JAN 2026");
  });
});
