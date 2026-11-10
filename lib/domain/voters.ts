/** Deterministic unique voter list that never includes the author. */
export function pickVoters(usernames: string[], author: string, count: number, salt: number): string[] {
  const pool = usernames.filter((username) => username !== author);
  if (pool.length === 0 || count <= 0) return [];
  const offset = Math.abs(salt) % pool.length;
  const rotated = pool.slice(offset).concat(pool.slice(0, offset));
  return rotated.slice(0, Math.min(count, rotated.length));
}
