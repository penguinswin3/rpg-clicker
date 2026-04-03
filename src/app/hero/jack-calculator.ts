/**
 * ════════════════════════════════════════════════════════════
 *   JACK OF ALL TRADES CALCULATOR
 *   Pure functions for jack costs, visibility, pool math,
 *   and starvation messaging.
 * ════════════════════════════════════════════════════════════
 */

import { JACK_GOLD_COST, JACK_RESOURCE_PROGRESSION, XP_THRESHOLDS, YIELDS } from '../game-config';
import { scaledCost } from '../utils/mathUtils';

// ── Types ───────────────────────────────────────────────────

export interface JackCostEntry {
  currency: string;
  amount:   number;
}

// ── Visibility & limits ─────────────────────────────────────

/** Maximum jacks that can ever be hired: 1 gold-only + one per progression entry. */
export function getJacksMax(): number {
  return 1 + JACK_RESOURCE_PROGRESSION.length;
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
  const costs: JackCostEntry[] = [
    { currency: 'gold', amount: scaledCost(JACK_GOLD_COST.base, JACK_GOLD_COST.scale, jacksOwned) },
  ];
  const resourceIdx = jacksOwned - 1;   // Jack 1 = gold only, Jack 2 = index 0, etc.
  if (resourceIdx >= 0 && resourceIdx < JACK_RESOURCE_PROGRESSION.length) {
    const res = JACK_RESOURCE_PROGRESSION[resourceIdx];
    costs.push({ currency: res.currency, amount: res.base });
  }
  return costs;
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
  allocations: Record<string, number>,
  jackStarved: Record<string, boolean>,
): boolean {
  if (charId === 'thief') {
    return isThiefStunned && (allocations['thief'] ?? 0) > 0;
  }
  return (allocations[charId] ?? 0) > 0 && !!jackStarved[charId];
}

/** Build the "⚠ Jack idle" message for the active character. */
export function getJackStarvedMessage(
  charId: string,
  culinarianGoldCost: number,
  walletGet: (currencyId: string) => number,
): string {
  if (charId === 'thief') {
    return `⚠ Jack idle — Stunned!`;
  }
  if (charId === 'apothecary') {
    const need = YIELDS.APOTHECARY_BREW_HERB_COST;
    const have = Math.floor(walletGet('herb'));
    return `⚠ Jack idle — need ${need} herbs (have ${have})`;
  }
  if (charId === 'culinarian') {
    const have = Math.floor(walletGet('gold'));
    return `⚠ Jack idle — need ${culinarianGoldCost} gold (have ${have})`;
  }
  return '⚠ Jack idle — insufficient resources';
}

