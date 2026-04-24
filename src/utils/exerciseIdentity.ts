import { EXERCISE_CATALOG } from "@/data/exerciseCatalog";

export interface ExerciseIdentityLike {
  exerciseDefinitionId?: string | null;
  name: string;
}

const NORMALIZATION_RULES: Array<[RegExp, string]> = [
  [/\bdumbells?\b/g, "dumbbell"],
  [/\bdumbel\b/g, "dumbbell"],
  [/\bpull[\s-]*ups?\b/g, "pull up"],
  [/\bchin[\s-]*ups?\b/g, "chin up"],
  [/\bpush[\s-]*ups?\b/g, "push up"],
  [/\bscapular[\s-]*pull[\s-]*ups?\b/g, "scapular pull up"],
  [/\bdips\b/g, "dip"],
  [/&/g, " and "],
  [/[^a-z0-9]+/g, " "],
];

function normalizeExerciseText(value?: string | null): string {
  if (typeof value !== "string") return "";

  let normalized = value.trim().toLowerCase();
  for (const [pattern, replacement] of NORMALIZATION_RULES) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function toSignature(value?: string | null): string {
  const normalized = normalizeExerciseText(value);
  if (!normalized) return "";
  return normalized
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ");
}

const exactCatalogIdentityMap = new Map<string, string>();
const signatureCatalogIdentityMap = new Map<string, string>();
const conflictingSignatures = new Set<string>();

for (const exercise of EXERCISE_CATALOG) {
  const candidates = [exercise.id, exercise.name, ...(exercise.aliases || [])];

  for (const candidate of candidates) {
    const normalized = normalizeExerciseText(candidate);
    if (normalized) {
      exactCatalogIdentityMap.set(normalized, exercise.id);
    }

    const signature = toSignature(candidate);
    if (!signature || conflictingSignatures.has(signature)) continue;

    const existing = signatureCatalogIdentityMap.get(signature);
    if (!existing) {
      signatureCatalogIdentityMap.set(signature, exercise.id);
      continue;
    }

    if (existing !== exercise.id) {
      signatureCatalogIdentityMap.delete(signature);
      conflictingSignatures.add(signature);
    }
  }
}

export function normalizeExerciseIdentityKey(value?: string | null): string {
  const normalized = normalizeExerciseText(value);
  if (!normalized) return "";

  const exactCatalogMatch = exactCatalogIdentityMap.get(normalized);
  if (exactCatalogMatch) return exactCatalogMatch;

  const signatureCatalogMatch = signatureCatalogIdentityMap.get(toSignature(normalized));
  if (signatureCatalogMatch) return signatureCatalogMatch;

  return normalized;
}

export function getExerciseIdentityKey(exercise: ExerciseIdentityLike): string {
  return (
    normalizeExerciseIdentityKey(exercise.exerciseDefinitionId) ||
    normalizeExerciseIdentityKey(exercise.name)
  );
}

export function matchesExerciseIdentity(
  exercise: ExerciseIdentityLike,
  identityKey: string
): boolean {
  return getExerciseIdentityKey(exercise) === normalizeExerciseIdentityKey(identityKey);
}

export function matchesExerciseSearchQuery(
  exercise: Pick<ExerciseIdentityLike, "name"> & { aliases?: string[] },
  query: string
): boolean {
  const normalizedQuery = normalizeExerciseText(query);
  if (!normalizedQuery) return true;

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const candidates = [exercise.name, ...(exercise.aliases || [])];

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeExerciseText(candidate);
    if (!normalizedCandidate) return false;
    if (normalizedCandidate.includes(normalizedQuery)) return true;

    const candidateTokens = new Set(normalizedCandidate.split(" ").filter(Boolean));
    return queryTokens.every((token) => candidateTokens.has(token));
  });
}

export function normalizeExerciseDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
