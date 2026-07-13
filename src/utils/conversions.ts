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
  to: "kg" | "lbs"
): number | null {
  if (value === null) return null;
  if (from === to) return value;

  const result = to === "lbs" ? value * KG_TO_LBS : value / KG_TO_LBS;
  
  // Round to 1 decimal place for kgs, or 0.5 for lbs (common gym standards)
  return to === "kg" 
    ? Math.round(result * 10) / 10 
    : Math.round(result * 2) / 2;
}

/**
 * Formats seconds into MM:SS.
 */
export function formatSecondsToMMSS(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

