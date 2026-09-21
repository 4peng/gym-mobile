export function isIncomingWriteStale(
  existingUpdatedAt: unknown,
  incomingUpdatedAt: unknown
): boolean {
  return (
    typeof existingUpdatedAt === 'number' &&
    Number.isFinite(existingUpdatedAt) &&
    typeof incomingUpdatedAt === 'number' &&
    Number.isFinite(incomingUpdatedAt) &&
    existingUpdatedAt > incomingUpdatedAt
  );
}
