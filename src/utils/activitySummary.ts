import type { WorkoutSession } from "@/types";

export type ActivityPeriodMode = "week" | "month" | "year";

export type ActivityChartPoint = {
  key: string;
  label: string;
  minutes: number;
};

export type ActivitySummary = {
  points: ActivityChartPoint[];
  totalMinutes: number;
  sessions: number;
  averageMinutes: number;
  bestMinutes: number;
  rangeLabel: string;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function shiftDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function formatDurationMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m`;
  }

  if (minutes <= 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function formatActivityRangeLabel(mode: ActivityPeriodMode, now: Date) {
  if (mode === "week") {
    const end = endOfDay(now);
    const start = startOfDay(shiftDays(end, -6));
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}`;
  }

  if (mode === "month") {
    const end = endOfDay(now);
    const start = startOfDay(shiftDays(end, -27));
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}`;
  }

  const endMonth = endOfMonth(now);
  const startMonth = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 11, 1));
  return `${startMonth.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()} - ${endMonth.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()}`;
}

export function toDurationMinutes(startedAt?: string, completedAt?: string) {
  if (!startedAt || !completedAt) return 0;

  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;

  return Math.max(0, Math.round((end - start) / 60000));
}

export function buildActivitySummary(
  history: WorkoutSession[],
  periodMode: ActivityPeriodMode,
  now: Date
): ActivitySummary {
  const rangeStart = periodMode === "week"
    ? startOfDay(shiftDays(now, -6))
    : periodMode === "month"
      ? startOfDay(shiftDays(now, -27))
      : startOfMonth(new Date(now.getFullYear(), now.getMonth() - 11, 1));
  const rangeEnd = periodMode === "year"
    ? endOfMonth(now)
    : endOfDay(now);

  const sessionsInRange = history.filter((session) => {
    const anchor = session.completedAt || session.startedAt;
    if (!anchor) return false;
    const timestamp = new Date(anchor).getTime();
    return timestamp >= rangeStart.getTime() && timestamp <= rangeEnd.getTime();
  });

  let points: ActivityChartPoint[] = [];

  if (periodMode === "week") {
    points = Array.from({ length: 7 }, (_, index) => {
      const day = shiftDays(rangeStart, index);
      const dayStart = startOfDay(day).getTime();
      const dayEnd = endOfDay(day).getTime();
      const minutes = sessionsInRange.reduce((total, session) => {
        const anchor = new Date(session.completedAt || session.startedAt).getTime();
        if (anchor < dayStart || anchor > dayEnd) return total;
        return total + toDurationMinutes(session.startedAt, session.completedAt);
      }, 0);

      return {
        key: `${dayStart}`,
        label: day.toLocaleDateString("en-US", { weekday: "short" }),
        minutes,
      };
    });
  } else if (periodMode === "month") {
    points = Array.from({ length: 4 }, (_, index) => {
      const bucketStart = startOfDay(shiftDays(rangeStart, index * 7));
      const bucketEnd = index === 3
        ? endOfDay(now)
        : endOfDay(shiftDays(bucketStart, 6));

      const minutes = sessionsInRange.reduce((total, session) => {
        const anchor = new Date(session.completedAt || session.startedAt).getTime();
        if (anchor < bucketStart.getTime() || anchor > bucketEnd.getTime()) return total;
        return total + toDurationMinutes(session.startedAt, session.completedAt);
      }, 0);

      return {
        key: `${bucketStart.getTime()}`,
        label: bucketStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        minutes,
      };
    });
  } else {
    points = Array.from({ length: 12 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      const monthStart = startOfMonth(monthDate).getTime();
      const monthEnd = endOfMonth(monthDate).getTime();
      const minutes = sessionsInRange.reduce((total, session) => {
        const anchor = new Date(session.completedAt || session.startedAt).getTime();
        if (anchor < monthStart || anchor > monthEnd) return total;
        return total + toDurationMinutes(session.startedAt, session.completedAt);
      }, 0);

      return {
        key: `${monthStart}`,
        label: monthDate.toLocaleDateString("en-US", { month: "short" }),
        minutes,
      };
    });
  }

  const totalMinutes = points.reduce((sum, point) => sum + point.minutes, 0);
  const sessions = sessionsInRange.length;
  const averageMinutes = sessions > 0 ? Math.round(totalMinutes / sessions) : 0;
  const bestMinutes = points.reduce((best, point) => Math.max(best, point.minutes), 0);

  return {
    points,
    totalMinutes,
    sessions,
    averageMinutes,
    bestMinutes,
    rangeLabel: formatActivityRangeLabel(periodMode, now),
  };
}
