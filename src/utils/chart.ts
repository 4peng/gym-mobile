const MS_PER_DAY = 86_400_000;

/**
 * Calendar-day index of a Date's local Y/M/D. UTC-anchored so DST shifts never
 * move a session across a day boundary; use it to place sessions into day buckets.
 */
export const calendarDayIndex = (d: Date): number =>
  Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY);

/** Smooth SVG path through `points`: quadratic curves to each segment midpoint. */
export function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    path += i === 0 ? ` L ${midX} ${midY}` : ` Q ${p0.x} ${p0.y}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  return `${path} L ${last.x} ${last.y}`;
}
