import { buildActivitySummary, formatDurationMinutes } from "@/utils/activitySummary";
import type { WorkoutSession } from "@/types";

// Pins down current bucketing/aggregation behavior of buildActivitySummary for
// week/month/year, plus formatDurationMinutes's rounding rules. Dates are all
// passed explicitly (never Date.now()) so this is deterministic regardless of
// when it runs. Verified against the actual runner's local timezone
// (GMT+0800) at the time these were written - fixed local `now` values are
// used throughout, matching how the app always calls this with `new Date()`.

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
    const history: WorkoutSession[] = [
      session("a", "2026-01-15T09:00:00.000", "2026-01-15T10:00:00.000"), // today, 60 min
      session("b", "2026-01-09T09:00:00.000", "2026-01-09T09:30:00.000"), // 6 days ago (range start), 30 min
      session("c", "2026-01-01T09:00:00.000", "2026-01-01T09:10:00.000"), // outside range, ignored
    ];

    const summary = buildActivitySummary(history, "week", now);

    expect(summary.points).toHaveLength(7);
    expect(summary.points[0]).toEqual({ key: "1767888000000", label: "Fri", minutes: 30 });
    expect(summary.points.slice(1, 6).every((p) => p.minutes === 0)).toBe(true);
    expect(summary.points[6]).toEqual({ key: "1768406400000", label: "Thu", minutes: 60 });

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
    const history: WorkoutSession[] = [
      session("a", "2026-01-15T09:00:00.000", "2026-01-15T10:00:00.000"), // last bucket, 60 min
      session("b", "2025-12-20T09:00:00.000", "2025-12-20T09:45:00.000"), // first bucket, 45 min
    ];

    const summary = buildActivitySummary(history, "month", now);

    expect(summary.points).toHaveLength(4);
    expect(summary.points[0]).toEqual({ key: "1766073600000", label: "Dec 19", minutes: 45 });
    expect(summary.points[1]).toEqual({ key: "1766678400000", label: "Dec 26", minutes: 0 });
    expect(summary.points[2]).toEqual({ key: "1767283200000", label: "Jan 2", minutes: 0 });
    expect(summary.points[3]).toEqual({ key: "1767888000000", label: "Jan 9", minutes: 60 });

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

    expect(summary.points).toHaveLength(12);
    expect(summary.points[0]).toEqual({ key: "1738339200000", label: "Feb", minutes: 45 });
    expect(summary.points[summary.points.length - 1]).toEqual({
      key: "1767196800000",
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
