/**
 * ════════════════════════════════════════════════════════════
 *   SHARED MATH / FORMATTING UTILITIES
 * ════════════════════════════════════════════════════════════
 */

/**
 * Format a number into compact shorthand.
 * Always floors to an integer before formatting.
 *   999         → "999"
 *   1018        → "1.0k"
 *   11822       → "11.8k"
 *   1,200,312   → "1.2M"
 *   1,501,651,954 → "1.5B"
 *   7.43216541321e+88     → "7.4e+79B"  (values too large for the B tier use toExponential)
 */
export function fmtNumber(num: number): string {
  const n = Math.floor(num);
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return (v < 1000 ? v.toFixed(1) : v.toExponential(1)) + 'B';
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return (v < 1000 ? v.toFixed(1) : v.toExponential(1)) + 'M';
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return (v < 1000 ? v.toFixed(1) : v.toExponential(1)) + 'k';
  }
  return n.toString();
}

/**
 * Clamp a value between min and max (both inclusive).
 *   clamp(150, 0, 100) → 100
 *   clamp(-5, 0, 100)  → 0
 *   clamp(42, 0, 100)  → 42
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Geometric (exponential) cost at a given purchase level.
 * Always floors to an integer.
 *   scaledCost(100, 1.5, 0) → 100
 *   scaledCost(100, 1.5, 1) → 150
 *   scaledCost(100, 1.5, 3) → 337
 *
 * Useful for any upgrade, hire, or resource cost that grows geometrically.
 */
export function scaledCost(base: number, scale: number, level: number): number {
  return Math.floor(base * Math.pow(scale, level));
}

/**
 * Return a uniformly-distributed random integer in [min, max] (both inclusive).
 *   randInt(1, 6)  → simulates a d6
 *   randInt(5, 10) → random number between 5 and 10
 */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Return true with the given percent probability (0 – 100).
 *   rollChance(25)  → true ~25 % of the time
 *   rollChance(0)   → always false
 *   rollChance(100) → always true
 */
export function rollChance(percent: number): boolean {
  return Math.random() * 100 < percent;
}

/**
 * Convert a value/max pair to a percentage in [0, 100], clamped.
 * Returns 0 when max ≤ 0 to avoid division by zero.
 * Useful for progress bars, HP bars, quality meters, etc.
 *   toPct(75, 100) → 75
 *   toPct(3, 10)   → 30
 */
export function toPct(value: number, max: number): number {
  if (max <= 0) return 0;
  return clamp((value / max) * 100, 0, 100);
}

/**
 * Fisher-Yates in-place shuffle.
 * Mutates and returns the same array reference.
 *   shuffleInPlace([1, 2, 3, 4]) → e.g. [3, 1, 4, 2]
 */
export function shuffleInPlace<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Round a number to a fixed number of decimal places.
 *   roundTo(3.14159, 2) → 3.14
 *   roundTo(1.005,   2) → 1.01
 *   roundTo(42,      0) → 42
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
