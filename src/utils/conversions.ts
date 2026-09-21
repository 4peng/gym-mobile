/**
 * Weight and Time conversion utilities.
 */

export const KG_TO_LBS = 2.20462;

/**
 * Convert weight between kg and lbs.
 */
export function convertWeight(
  value: number | null,
  from: "kg" | "lbs",
  to: "kg" | "lbs",
): number | null {
  if (value === null) return null;
  if (from === to) return value;

  const result = to === "lbs" ? value * KG_TO_LBS : value / KG_TO_LBS;

  // Round to 1 decimal place for kgs, or 0.5 for lbs (common gym standards)
  return to === "kg" ? Math.round(result * 10) / 10 : Math.round(result * 2) / 2;
}

/** Formats seconds as HH:MM:SS, or MM:SS under an hour. */
export function formatClock(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const rest = formatSecondsToMMSS(totalSeconds % 3600);
  return hrs > 0 ? `${String(hrs).padStart(2, "0")}:${rest}` : rest;
}

/**
 * Formats seconds into MM:SS.
 */
export function formatSecondsToMMSS(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
