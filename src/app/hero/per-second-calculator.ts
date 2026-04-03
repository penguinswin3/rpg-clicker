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
  upgrades:                UpgradeService;
  jacksAllocations:        Record<string, number>;
  jackStarved:             Record<string, boolean>;
  isThiefStunned:          boolean;
  wholesaleSpicesEnabled:  boolean;
  fermentationVatsEnabled: boolean;
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

/**
 * Per-currency breakdown by contributing source (character or passive upgrade).
 * Keys are currency IDs, values are maps of source label → rate.
 * Only non-zero contributions are included.
 */
export type PerSecondBreakdown = Record<string, Record<string, number>>;

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

  // ── Cat's Eye factor ──────────────────────────────────────
  // Cat's Eye procs at catsEyeLevel% chance, granting herbs AND a beast roll
  // instead of the normal 50/50 split.  Expected herb/beast per click scales by
  // 0.5 × (1 + catsEyeLevel/100).
  const catsEyeLevel   = u.level('POTION_CATS_EYE');
  const catsEyeFactor  = 0.5 * (1 + catsEyeLevel / 100);

  // ── Herb rates ────────────────────────────────────────────
  const vatLevel       = ctx.fermentationVatsEnabled ? u.level('FERMENTATION_VATS') : 0;
  const vatHerbDrain   = vatLevel * 0.1;   // 1 herb per level per 10s
  const vatPotionGain  = vatLevel * 0.1;   // 1 potion per level per 10s
  const herbProduced = rangerJacks * catsEyeFactor * expectedHerbPerRangerClick(u.level('MORE_HERBS'))
    + u.level('HOVEL_GARDEN') * 0.2;
  const herbConsumed = apothecaryJacks * (YIELDS.APOTHECARY_BREW_HERB_COST - herbSaveChance / 100)
    + vatHerbDrain;

  // ── Beast rates ───────────────────────────────────────────
  const expectedMeatYield = (u.level('BIGGER_GAME') + 2) / 2;
  const baitedTrapsRate   = u.level('BAITED_TRAPS') * 0.2;

  return {
    gold:    roundTo(autoGoldPerSec + apothecaryJacks * goldPerBrew + fighterJacks * goldPerClick - culinarianJacks * culGoldCost + ppGoldPerSecond, 2),
    xp:      roundTo(fighterJacks * xpPerBounty + rangerJacks + apothecaryJacks + culinarianJacks + effectiveThiefRate, 2),
    herb:    roundTo(herbProduced - herbConsumed, 2),
    beast:   roundTo(rangerJacks * catsEyeFactor * (beastChance / 100) * expectedMeatYield + baitedTrapsRate, 2),
    potion:  roundTo(apothecaryJacks + vatPotionGain, 2),
    spice:   roundTo(culinarianJacks * spicePerClick, 2),
    dossier: roundTo(effectiveThiefRate * avgDossierYield, 2),
  };
}

/**
 * Calculate a per-currency, per-source breakdown of all per-second contributions.
 * Sources are character names or "Passive" for upgrade-only income.
 * Only non-zero entries are included.
 */
export function calculatePerSecondBreakdown(ctx: PerSecondContext): PerSecondBreakdown {
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
  const thiefSuccessRate   = calcThiefSuccessChance(u.level('METICULOUS_PLANNING')) / 100;
  const effectiveThiefRate = ctx.isThiefStunned ? 0 : thiefJacks * thiefSuccessRate;
  const avgDossierYield    = calcExpectedDossierYield(u.level('POTION_OF_STICKY_FINGERS'));
  const ppGoldPerSecond    = effectiveThiefRate * avgDossierYield * u.level('PLENTIFUL_PLUNDERING');

  // ── Cat's Eye factor ──────────────────────────────────────
  const catsEyeLevel2  = u.level('POTION_CATS_EYE');
  const catsEyeFactor2 = 0.5 * (1 + catsEyeLevel2 / 100);

  // ── Herb rates ────────────────────────────────────────────
  const vatLevel2     = ctx.fermentationVatsEnabled ? u.level('FERMENTATION_VATS') : 0;
  const vatHerbDrain  = vatLevel2 * 0.1;
  const vatPotionGain = vatLevel2 * 0.1;
  const herbProduced = rangerJacks * catsEyeFactor2 * expectedHerbPerRangerClick(u.level('MORE_HERBS'))
    + u.level('HOVEL_GARDEN') * 0.2;
  const herbConsumed = apothecaryJacks * (YIELDS.APOTHECARY_BREW_HERB_COST - herbSaveChance / 100)
    + vatHerbDrain;

  // ── Beast rates ───────────────────────────────────────────
  const expectedMeatYield = (u.level('BIGGER_GAME') + 2) / 2;
  const baitedTrapsRate   = u.level('BAITED_TRAPS') * 0.2;

  // ── Build breakdown ───────────────────────────────────────
  const bd: PerSecondBreakdown = {};

  function add(currency: string, source: string, value: number): void {
    const v = roundTo(value, 2);
    if (v === 0) return;
    if (!bd[currency]) bd[currency] = {};
    bd[currency][source] = (bd[currency][source] ?? 0) + v;
  }

  // Gold
  if (autoGoldPerSec > 0)              add('gold', 'Passive', autoGoldPerSec);
  if (fighterJacks > 0)                add('gold', 'Fighter', roundTo(fighterJacks * goldPerClick, 2));
  if (apothecaryJacks > 0 && goldPerBrew > 0) add('gold', 'Apothecary', roundTo(apothecaryJacks * goldPerBrew, 2));
  if (culinarianJacks > 0)             add('gold', 'Culinarian', roundTo(-culinarianJacks * culGoldCost, 2));
  if (ppGoldPerSecond !== 0)           add('gold', 'Thief', roundTo(ppGoldPerSecond, 2));

  // XP
  if (fighterJacks > 0)                add('xp', 'Fighter', roundTo(fighterJacks * xpPerBounty, 2));
  if (rangerJacks > 0)                 add('xp', 'Ranger', roundTo(rangerJacks, 2));
  if (apothecaryJacks > 0)             add('xp', 'Apothecary', roundTo(apothecaryJacks, 2));
  if (culinarianJacks > 0)             add('xp', 'Culinarian', roundTo(culinarianJacks, 2));
  if (effectiveThiefRate > 0)          add('xp', 'Thief', roundTo(effectiveThiefRate, 2));

  // Herb
  if (herbProduced !== 0)              add('herb', 'Ranger', roundTo(herbProduced, 2));
  if (herbConsumed > 0)                add('herb', 'Apothecary', roundTo(-herbConsumed, 2));

  // Beast
  const beastRate = roundTo(rangerJacks * catsEyeFactor2 * (beastChance / 100) * expectedMeatYield + baitedTrapsRate, 2);
  if (beastRate !== 0)                 add('beast', 'Ranger', beastRate);

  // Potion
  if (apothecaryJacks > 0)            add('potion', 'Apothecary', roundTo(apothecaryJacks, 2));
  if (vatPotionGain > 0)              add('potion', 'Fermentation Vats', roundTo(vatPotionGain, 2));

  // Spice
  if (culinarianJacks > 0)             add('spice', 'Culinarian', roundTo(culinarianJacks * spicePerClick, 2));

  // Dossier
  const dossierRate = roundTo(effectiveThiefRate * avgDossierYield, 2);
  if (dossierRate !== 0)               add('dossier', 'Thief', dossierRate);

  return bd;
}
