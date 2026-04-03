/**
 * ════════════════════════════════════════════════════════════
 *   YIELD HELPERS
 *   Pure functions for all upgrade-derived game values.
 *   No side effects — takes numbers in, returns numbers out.
 * ════════════════════════════════════════════════════════════
 */

import { YIELDS } from '../game-config';
import { clamp, rollChance, randInt } from '../utils/mathUtils';

// ── Fighter ─────────────────────────────────────────────────

/** Gold earned per fighter hero-button click. */
export function calcGoldPerClick(betterBountiesLevel: number): number {
  return YIELDS.FIGHTER_GOLD_PER_CLICK + betterBountiesLevel;
}

/** Passive gold/sec from Contracted Hirelings × Hireling's Hirelings multiplier. */
export function calcAutoGoldPerSecond(
  contractedHirelingsLevel: number,
  hirelingsHirelingsLevel: number,
): number {
  const base = contractedHirelingsLevel;
  const multiplier = hirelingsHirelingsLevel;
  return base + (base * multiplier);
}

/** XP awarded per fighter bounty click. */
export function calcXpPerBounty(insightfulContractsLevel: number): number {
  return 1 + insightfulContractsLevel;
}

/** Fighter minigame attack power (alias for Sharper Swords level). */
export function calcFighterAttackPower(sharperSwordsLevel: number): number {
  return sharperSwordsLevel;
}

// ── Ranger ──────────────────────────────────────────────────

/** Current beast-find percentage (capped at RANGER_BEAST_CHANCE_CAP). */
export function calcBeastFindChance(betterTrackingLevel: number): number {
  return clamp(
    YIELDS.RANGER_BASE_BEAST_CHANCE + betterTrackingLevel * 3,
    0,
    YIELDS.RANGER_BEAST_CHANCE_CAP,
  );
}

/**
 * Compute actual herb yield for a single forage action.
 * Each More Herbs level adds 3% doubling chance.
 * Rolls the doubling chance and returns the final herb count.
 */
export function computeHerbYield(moreHerbsLevel: number): number {
  const totalPct   = moreHerbsLevel * 3;
  const guaranteed = Math.floor(totalPct / 100);
  const remainder  = totalPct % 100;
  const extra      = rollChance(remainder) ? 1 : 0;
  return YIELDS.RANGER_BASE_HERBS * Math.pow(2, guaranteed + extra);
}

/**
 * Expected (average) herb yield per single Ranger click,
 * before the 50/50 herb-vs-beast split.
 * Used for per-second rate display, not for actual rolls.
 */
export function expectedHerbPerRangerClick(moreHerbsLevel: number): number {
  const totalPct   = moreHerbsLevel * 3;
  const guaranteed = Math.floor(totalPct / 100);
  const remainder  = totalPct % 100;
  return YIELDS.RANGER_BASE_HERBS * Math.pow(2, guaranteed) * (1 + remainder / 100);
}

/** Compute meat yield for a single beast hunt. */
export function computeMeatYield(biggerGameLevel: number): number {
  return randInt(1, biggerGameLevel + 1);
}

/** Display string for herb doubling — e.g. "3× + 25%". */
export function herbDoublingDisplay(moreHerbsLevel: number): string {
  const totalPct   = moreHerbsLevel * 3;
  const guaranteed = Math.floor(totalPct / 100);
  const remainder  = totalPct % 100;
  if (guaranteed === 0) return `${remainder}%`;
  if (remainder  === 0) return `${guaranteed}×`;
  return `${guaranteed}× + ${remainder}%`;
}

// ── Apothecary ──────────────────────────────────────────────

/** Gold earned per potion base brew from Potion Marketing. */
export function calcPotionMarketingGoldPerBrew(potionMarketingLevel: number): number {
  return potionMarketingLevel;
}

/** Herb save chance in % — equals Potion Titration level. */
export function calcHerbSaveChance(potionTitrationLevel: number): number {
  return potionTitrationLevel;
}

// ── Culinarian ──────────────────────────────────────────────

/** Spice gained per Culinarian hero-button click (base 1 + Wholesale Spices level, if enabled). */
export function calcSpicePerClick(
  wholesaleSpicesEnabled: boolean,
  wholesaleSpicesLevel: number,
): number {
  return wholesaleSpicesEnabled ? 1 + wholesaleSpicesLevel : 1;
}

/** Gold cost per Culinarian hero-button click — rises with Wholesale Spices, falls with Glibness. */
export function calcCulinarianGoldCost(
  wholesaleSpicesEnabled: boolean,
  wholesaleSpicesLevel: number,
  potionGlibnessLevel: number,
): number {
  const wsLevel  = wholesaleSpicesEnabled ? wholesaleSpicesLevel : 0;
  const baseCost = YIELDS.CULINARIAN_SPICE_COST
    + ((25 - wsLevel + 24) / 2) * wsLevel;
  const discount = 1 - potionGlibnessLevel / 100;
  return Math.max(1, Math.floor(baseCost * discount));
}

// ── Thief ───────────────────────────────────────────────────

/** Success chance for the Thief's Break & Enter action (base 50 % + Meticulous Planning). */
export function calcThiefSuccessChance(meticulousPlanningLevel: number): number {
  return YIELDS.THIEF_BASE_SUCCESS_CHANCE + meticulousPlanningLevel;
}

/** Average dossier yield per successful heist (1 at base, scales with Sticky Fingers). */
export function calcExpectedDossierYield(stickyFingersLevel: number): number {
  return stickyFingersLevel > 0 ? 1 + stickyFingersLevel / 2 : 1;
}

