/** Pure combat/progression helpers shared by the game and automated tests. */
export function damage(base: number, defense = 0, critical = false): number {
  const safeBase = Number.isFinite(base) ? base : 1;
  const safeDefense = Number.isFinite(defense) ? Math.max(0, defense) : 0;
  return Math.max(1, Math.floor(Math.max(1, safeBase - safeDefense) * (critical ? 1.6 : 1)));
}

export function need(level: number): number {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  return 40 + safeLevel * 25;
}
