/**
 * Converts a string to Title Case (e.g., "bench press" -> "Bench Press")
 */
export function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Normalizes exercise names to prevent duplicates like "Push Up" vs "push ups".
 * 1. Trims and standardizes whitespace.
 * 2. Standardizes casing (Title Case).
 * 3. Smart-matches plural/singular versions if an existing match is found.
 */
export function normalizeExerciseName(name: string, existingNames: string[] = []): string {
  if (!name) return "";
  
  // Basic cleanup & casing
  const clean = toTitleCase(name);
  if (existingNames.length === 0) return clean;

  const lowerClean = clean.toLowerCase();
  const lowerExisting = existingNames.map(n => n.toLowerCase());

  // 1. Exact match (case-insensitive) -> use existing's casing
  const exactIdx = lowerExisting.indexOf(lowerClean);
  if (exactIdx !== -1) return existingNames[exactIdx];

  // 2. Smart Match: Singular vs Plural (e.g., "Push Up" vs "Push Ups")
  // We only match if the ONLY difference is a trailing 's'
  for (let i = 0; i < lowerExisting.length; i++) {
    const existing = lowerExisting[i];
    
    // Check if one is just the other with an 's'
    const isPluralMatch = 
      (lowerClean + "s" === existing) || 
      (existing + "s" === lowerClean);

    if (isPluralMatch) {
      // Use the existing name to maintain consistency
      return existingNames[i];
    }
  }

  return clean;
}
