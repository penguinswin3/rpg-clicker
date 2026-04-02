/**
 * ════════════════════════════════════════════════════════════
 *   PER-SECOND RATE CALCULATOR
 *   Pure function that computes display rates for all
 *   currencies, factoring in jacks, starvation, and stun.
 * ════════════════════════════════════════════════════════════
 */

import { YIELDS } from '../game-config';
import { UpgradeService } from '../upgrade/upgrade.service';
import { roundTo } from '../utils/mathUtils';
import {
  calcGoldPerClick, calcAutoGoldPerSecond, calcXpPerBounty,
  calcBeastFindChance, calcHerbSaveChance,
  calcPotionMarketingGoldPerBrew, calcSpicePerClick,
  calcCulinarianGoldCost, calcThiefSuccessChance,
  calcExpectedDossierYield, expectedHerbPerRangerClick,
} from './yield-helpers';

// ── Context ─────────────────────────────────────────────────

export interface PerSecondContext {
  upgrades:               UpgradeService;
  jacksAllocations:       Record<string, number>;
  jackStarved:            Record<string, boolean>;
  isThiefStunned:         boolean;
  wholesaleSpicesEnabled: boolean;
}

// ── Result ──────────────────────────────────────────────────

export interface PerSecondRates {
  gold:    number;
  xp:      number;
  herb:    number;
  beast:   number;
  potion:  number;
  spice:   number;
  dossier: number;
}

// ── Public API ──────────────────────────────────────────────

/** Calculate display per-second rates for all currencies. */
export function calculatePerSecondRates(ctx: PerSecondContext): PerSecondRates {
  const u = ctx.upgrades;

  // ── Jack counts (starved / stunned jacks produce nothing) ──
  const fighterJacks    = ctx.jacksAllocations['fighter']    ?? 0;
  const rangerJacks     = ctx.jacksAllocations['ranger']     ?? 0;
  const apothecaryJacks = ctx.jackStarved['apothecary'] ? 0 : (ctx.jacksAllocations['apothecary'] ?? 0);
  const culinarianJacks = ctx.jackStarved['culinarian'] ? 0 : (ctx.jacksAllocations['culinarian'] ?? 0);
  const thiefJacks      = ctx.jacksAllocations['thief'] ?? 0;

  // ── Derived values ────────────────────────────────────────
  const goldPerClick    = calcGoldPerClick(u.level('BETTER_BOUNTIES'));
  const autoGoldPerSec  = calcAutoGoldPerSecond(u.level('CONTRACTED_HIRELINGS'), u.level('HIRELINGS_HIRELINGS'));
  const xpPerBounty     = calcXpPerBounty(u.level('INSIGHTFUL_CONTRACTS'));
  const goldPerBrew     = calcPotionMarketingGoldPerBrew(u.level('POTION_MARKETING'));
  const herbSaveChance  = calcHerbSaveChance(u.level('POTION_TITRATION'));
  const beastChance     = calcBeastFindChance(u.level('BETTER_TRACKING'));
  const spicePerClick   = calcSpicePerClick(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'));
  const culGoldCost     = calcCulinarianGoldCost(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'), u.level('POTION_GLIBNESS'));

  // ── Thief rates ───────────────────────────────────────────
  const thiefSuccessRate  = calcThiefSuccessChance(u.level('METICULOUS_PLANNING')) / 100;
  const effectiveThiefRate = ctx.isThiefStunned ? 0 : thiefJacks * thiefSuccessRate;
  const avgDossierYield    = calcExpectedDossierYield(u.level('POTION_OF_STICKY_FINGERS'));
  const ppGoldPerSecond    = effectiveThiefRate * avgDossierYield * u.level('PLENTIFUL_PLUNDERING');

  // ── Herb rates ────────────────────────────────────────────
  const herbProduced = rangerJacks * 0.5 * expectedHerbPerRangerClick(u.level('MORE_HERBS'));
  const herbConsumed = apothecaryJacks * (YIELDS.APOTHECARY_BREW_HERB_COST - herbSaveChance / 100);

  // ── Beast rates ───────────────────────────────────────────
  const expectedMeatYield = (u.level('BIGGER_GAME') + 2) / 2;

  return {
    gold:    roundTo(autoGoldPerSec + apothecaryJacks * goldPerBrew + fighterJacks * goldPerClick - culinarianJacks * culGoldCost + ppGoldPerSecond, 2),
    xp:      roundTo(fighterJacks * xpPerBounty + rangerJacks + apothecaryJacks + culinarianJacks + effectiveThiefRate, 2),
    herb:    roundTo(herbProduced - herbConsumed, 2),
    beast:   roundTo(rangerJacks * 0.5 * (beastChance / 100) * expectedMeatYield, 2),
    potion:  roundTo(apothecaryJacks, 2),
    spice:   roundTo(culinarianJacks * spicePerClick, 2),
    dossier: roundTo(effectiveThiefRate * avgDossierYield, 2),
  };
}

