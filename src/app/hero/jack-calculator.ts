/**
 * ════════════════════════════════════════════════════════════
 *   JACK OF ALL TRADES CALCULATOR
 *   Pure functions for jack costs, visibility, pool math,
 *   and starvation messaging.
 * ════════════════════════════════════════════════════════════
 */

import { GLOBAL_PURCHASE_DEFS, getActiveCosts, XP_THRESHOLDS, YIELDS } from '../game-config';
import { calcArtisanTreasureCost, calcNecromancerWardXpCost } from './yield-helpers';

// ── Types ───────────────────────────────────────────────────

export interface JackCostEntry {
  currency: string;
  amount:   number;
}

// ── Jack def lookup ─────────────────────────────────────────

const jackDef = GLOBAL_PURCHASE_DEFS.find(d => d.kind === 'jack')!;

// ── Visibility & limits ─────────────────────────────────────

/**
 * Maximum jacks that can ever be hired.
 * Jack 1 requires only gold; each subsequent jack adds a secondary resource
 * (one per fromCount-gated cost entry in the jack def).
 */
export function getJacksMax(): number {
  const secondaryCount = jackDef.costs.filter(c => c.fromCount !== undefined).length;
  return 1 + secondaryCount;
}

/** Whether the jack panel should be visible. */
export function isJacksVisible(xp: number, jacksOwned: number): boolean {
  return xp >= XP_THRESHOLDS.JACKS_UNLOCK || jacksOwned > 0;
}

/** Number of jacks available to purchase right now (0 or 1). */
export function getJacksToPurchase(xp: number, jacksOwned: number): number {
  return isJacksVisible(xp, jacksOwned) && jacksOwned < getJacksMax() ? 1 : 0;
}

// ── Cost calculations ───────────────────────────────────────

/** Active costs for the next jack hire — scaled gold + one unscaled secondary resource. */
export function calculateJackCosts(jacksOwned: number): JackCostEntry[] {
  return getActiveCosts(jackDef, jacksOwned);
}

/** Check if the player can afford a set of jack costs. */
export function canAffordJackCosts(
  costs: JackCostEntry[],
  canAfford: (currency: string, amount: number) => boolean,
): boolean {
  return costs.every(c => canAfford(c.currency, c.amount));
}

// ── Pool math ───────────────────────────────────────────────

/** Count of unallocated (free) jacks. */
export function getJacksPoolFree(jacksOwned: number, allocations: Record<string, number>): number {
  const allocated = Object.values(allocations).reduce((a, b) => a + b, 0);
  return jacksOwned - allocated;
}

// ── Starvation messages ─────────────────────────────────────

/**
 * Whether the active character's jacks are starved.
 * Thief: treated as starved while stunned with allocated jacks.
 * Others: starved when the jackStarved flag is set.
 */
export function isActiveCharJackStarved(
  charId: string,
  isThiefStunned: boolean,
  isArtisanTimerActive: boolean,
  allocations: Record<string, number>,
  jackStarved: Record<string, boolean>,
): boolean {
  if (charId === 'thief') {
    return isThiefStunned && (allocations['thief'] ?? 0) > 0;
  }
  if (charId === 'artisan') {
    // Artisan is "starved" when the timer is idle and the starved flag is set (not enough treasure)
    return !isArtisanTimerActive && (allocations['artisan'] ?? 0) > 0 && !!jackStarved['artisan'];
  }
  if (charId === 'necromancer') {
    // Necromancer ward jacks starve when they can't afford XP
    return (allocations['necromancer-ward'] ?? 0) > 0 && !!jackStarved['necromancer-ward'];
  }
  return (allocations[charId] ?? 0) > 0 && !!jackStarved[charId];
}

/** Build the "⚠ Jack idle" message for the active character. */
export function getJackStarvedMessage(
  charId: string,
  culinarianGoldCost: number,
  walletGet: (currencyId: string) => number,
  apothecaryRelicLevel: number = 0,
  artisanJacks: number = 1,
  darkPactLevel: number = 0,
): string {
  if (charId === 'thief') {
    return `⚠ Jack idle — Stunned!`;
  }
  if (charId === 'apothecary') {
    const need = Math.max(0, YIELDS.APOTHECARY_BREW_HERB_COST - (apothecaryRelicLevel >= 1 ? 1 : 0));
    const have = Math.floor(walletGet('herb'));
    return `⚠ Jack idle — need ${need} herbs (have ${have})`;
  }
  if (charId === 'culinarian') {
    const have = Math.floor(walletGet('gold'));
    return `⚠ Jack idle — need ${culinarianGoldCost} gold (have ${have})`;
  }
  if (charId === 'artisan') {
    const needPerAction = calcArtisanTreasureCost();
    const need = needPerAction * Math.max(1, artisanJacks);
    const have = Math.floor(walletGet('treasure'));
    return `⚠ Jack idle — need ${need} treasure (have ${have})`;
  }
  if (charId === 'necromancer') {
    const need = calcNecromancerWardXpCost(darkPactLevel);
    const have = Math.floor(walletGet('xp'));
    return `⚠ Ward Jack idle — need ${need} XP (have ${have})`;
  }
  return '⚠ Jack idle — insufficient resources';
}

