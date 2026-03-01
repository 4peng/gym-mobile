/** Generate a locally-unique ID (24-character hex string compatible with MongoDB ObjectId). */
export function generateId(): string {
  const chars = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < 24; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}
