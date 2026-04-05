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
  calcBaitedTrapsBeastPerTick, calcHovelGardenHerbPerTick,
  calcArtisanTreasureCost, calcArtisanTimerMs,
  expectedGemstonePerAppraisal, expectedMetalPerAppraisal,
  expectedGemstonePerAppraisalJack, expectedMetalPerAppraisalJack,
  calcNecromancerBoneYield, calcNecromancerWardXpCost,
  calcNecromancerBrimstoneYield,
} from './yield-helpers';

// ── Context ─────────────────────────────────────────────────

export interface PerSecondContext {
  upgrades:                UpgradeService;
  jacksAllocations:        Record<string, number>;
  jackStarved:             Record<string, boolean>;
  isThiefStunned:          boolean;
  isArtisanTimerActive:    boolean;
  wholesaleSpicesEnabled:  boolean;
  fermentationVatsEnabled: boolean;
  /** Relic levels per character (0 = not owned). Keys are character IDs. */
  relicLevels:             Record<string, number>;
  /** Which necromancer button is currently active ('defile' or 'ward'). */
  necromancerActiveButton: 'defile' | 'ward';
}

// ── Result ──────────────────────────────────────────────────

export interface PerSecondRates {
  gold:              number;
  xp:                number;
  herb:              number;
  beast:             number;
  potion:            number;
  spice:             number;
  dossier:           number;
  treasure:          number;
  'precious-metal':  number;
  gemstone:          number;
  bone:              number;
  brimstone:         number;
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

  // ── Relic levels ──────────────────────────────────────────
  const rl = ctx.relicLevels;
  const hasFighterRelic    = (rl['fighter']    ?? 0) >= 1;
  const hasRangerRelic     = (rl['ranger']     ?? 0) >= 1;
  const hasApothecaryRelic = (rl['apothecary'] ?? 0) >= 1;
  const hasCulinarianRelic = (rl['culinarian'] ?? 0) >= 1;
  const hasThiefRelic      = (rl['thief']      ?? 0) >= 1;
  const hasArtisanRelic    = (rl['artisan']    ?? 0) >= 1;

  // ── Jack counts (starved / stunned jacks produce nothing) ──
  // Relic doubling: when a character's relic is active, each jack counts as two.
  const fighterJacks    = (ctx.jacksAllocations['fighter']    ?? 0) * (hasFighterRelic ? 2 : 1);
  const rangerJacks     = (ctx.jacksAllocations['ranger']     ?? 0) * (hasRangerRelic ? 2 : 1);
  const apothecaryJacks = (ctx.jackStarved['apothecary'] ? 0 : (ctx.jacksAllocations['apothecary'] ?? 0)) * (hasApothecaryRelic ? 2 : 1);
  const culinarianJacks = (ctx.jackStarved['culinarian'] ? 0 : (ctx.jacksAllocations['culinarian'] ?? 0)) * (hasCulinarianRelic ? 2 : 1);
  const thiefJacks      = (ctx.jacksAllocations['thief'] ?? 0) * (hasThiefRelic ? 2 : 1);
  const artisanJacks    = (ctx.jackStarved['artisan'] ? 0 : (ctx.jacksAllocations['artisan'] ?? 0)) * (hasArtisanRelic ? 2 : 1);

  // ── Derived values ────────────────────────────────────────
  const goldPerClick    = calcGoldPerClick(u.level('BETTER_BOUNTIES'));
  const autoGoldPerSec  = calcAutoGoldPerSecond(u.level('CONTRACTED_HIRELINGS'), u.level('HIRELINGS_HIRELINGS'));
  const xpPerBounty     = calcXpPerBounty(u.level('INSIGHTFUL_CONTRACTS'));
  const goldPerBrew     = calcPotionMarketingGoldPerBrew(u.level('POTION_MARKETING'));
  const herbSaveChance  = calcHerbSaveChance(u.level('POTION_TITRATION'));
  const beastChance     = calcBeastFindChance(u.level('BETTER_TRACKING'));
  const spicePerClick   = calcSpicePerClick(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'));
  const culGoldCost     = calcCulinarianGoldCost(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'), u.level('POTION_GLIBNESS'));

  // ── Fighter relic: each jack also earns hireling gold ─────
  const fighterRelicGold = (hasFighterRelic && fighterJacks > 0) ? fighterJacks * autoGoldPerSec : 0;

  // ── Thief rates ───────────────────────────────────────────
  const thiefSuccessRate  = calcThiefSuccessChance(u.level('METICULOUS_PLANNING')) / 100;
  const effectiveThiefRate = ctx.isThiefStunned ? 0 : thiefJacks * thiefSuccessRate;
  // Relic: Ring of Shadows — double dossier range
  const sfLevel            = u.level('POTION_OF_STICKY_FINGERS');
  const avgDossierYield    = hasThiefRelic
    ? (2 + 2 * (1 + sfLevel)) / 2  // doubled min/max
    : calcExpectedDossierYield(sfLevel);
  const ppGoldPerSecond    = effectiveThiefRate * avgDossierYield * u.level('PLENTIFUL_PLUNDERING');
  // Relic: Ring of Shadows — +2 treasure per successful action
  const thiefTreasurePerSec = hasThiefRelic ? effectiveThiefRate * 2 : 0;

  // ── Artisan rates ─────────────────────────────────────────
  const artisanTimerSec       = calcArtisanTimerMs(u.level('FASTER_APPRAISING')) / 1000;
  const artisanTreasureCost   = calcArtisanTreasureCost();
  const artisanCyclesPerSec   = artisanJacks > 0 ? 1 / artisanTimerSec : 0;
  const artisanTreasurePerSec = artisanJacks * artisanTreasureCost * artisanCyclesPerSec;
  // Relic: Masterwork Monocle — max metal, doubled gem minimum
  const artisanGemstonePerSec = artisanJacks * expectedGemstonePerAppraisalJack(u.level('POTION_CATS_PAW'), hasArtisanRelic) * artisanCyclesPerSec;
  const artisanMetalPerSec    = artisanJacks * expectedMetalPerAppraisalJack(u.level('POTION_CATS_PAW'), hasArtisanRelic) * artisanCyclesPerSec;
  const artisanXpPerSec       = artisanJacks * artisanCyclesPerSec;

  // ── Cat's Eye factor ──────────────────────────────────────
  const catsEyeLevel   = u.level('POTION_CATS_EYE');
  const catsEyeFactor  = 0.5 * (1 + catsEyeLevel / 100);

  // ── Ranger relic: +1 herb base (before doubling), +1 beast per hunt ──
  const rangerHerbBonus  = hasRangerRelic ? rangerJacks : 0;
  const rangerBeastBonus = hasRangerRelic ? 1 : 0;

  // ── Herb rates ────────────────────────────────────────────
  const vatLevel       = ctx.fermentationVatsEnabled ? u.level('FERMENTATION_VATS') : 0;
  const vatHerbDrain   = vatLevel * 0.1;
  const vatPotionGain  = vatLevel * 0.1;
  const hovelGardenRate = calcHovelGardenHerbPerTick(u.level('HOVEL_GARDEN'), u.level('ORNATE_HERB_POTS')) * 0.2;
  const herbProduced = rangerJacks * catsEyeFactor * expectedHerbPerRangerClick(u.level('MORE_HERBS'))
    + rangerHerbBonus * catsEyeFactor
    + hovelGardenRate;
  // Apothecary relic: -1 herb cost per brew (min 0)
  const apothHerbCost = Math.max(0, YIELDS.APOTHECARY_BREW_HERB_COST - (hasApothecaryRelic ? 1 : 0));
  const herbConsumed = apothecaryJacks * (apothHerbCost - herbSaveChance / 100)
    + vatHerbDrain;

  // ── Beast rates ───────────────────────────────────────────
  const expectedMeatYield = (u.level('BIGGER_GAME') + 2) / 2;
  const baitedTrapsRate   = calcBaitedTrapsBeastPerTick(u.level('BAITED_TRAPS'), u.level('SPICED_BAIT')) * 0.2;

  // ── Potion rates ──────────────────────────────────────────
  // Apothecary relic: auto-dilute → 2 potions per brew
  const potionPerBrew = hasApothecaryRelic ? 2 : 1;

  // ── Culinarian relic: double spice yield ──────────────────
  const culSpiceMultiplier = hasCulinarianRelic ? 2 : 1;

  // ── Necromancer rates ──────────────────────────────────────
  const hasNecromancerRelic = (rl['necromancer'] ?? 0) >= 1;
  // With relic: both jack types always produce regardless of active button.
  // Without relic: only the active button's jacks produce.
  const rawDefileJacks = ctx.jacksAllocations['necromancer-defile'] ?? 0;
  const rawWardJacks   = ctx.jackStarved['necromancer-ward'] ? 0 : (ctx.jacksAllocations['necromancer-ward'] ?? 0);
  const defileJacks = hasNecromancerRelic ? rawDefileJacks
    : (ctx.necromancerActiveButton === 'defile' ? rawDefileJacks : 0);
  const wardJacks   = hasNecromancerRelic ? rawWardJacks
    : (ctx.necromancerActiveButton === 'ward'   ? rawWardJacks   : 0);
  // Relic: double effectiveness (×2 yield) instead of +1.
  const bonePerSec      = defileJacks * calcNecromancerBoneYield() * (hasNecromancerRelic ? 2 : 1);
  const brimstonePerSec = wardJacks   * calcNecromancerBrimstoneYield() * (hasNecromancerRelic ? 2 : 1);
  const wardXpDrain     = wardJacks * calcNecromancerWardXpCost(u.level('DARK_PACT'));
  const necroXpGain     = defileJacks; // defile gives 1 xp per click

  return {
    gold:    roundTo(autoGoldPerSec + fighterRelicGold + apothecaryJacks * goldPerBrew + fighterJacks * goldPerClick - culinarianJacks * culGoldCost + ppGoldPerSecond, 2),
    xp:      roundTo(fighterJacks * xpPerBounty + rangerJacks + apothecaryJacks + culinarianJacks + effectiveThiefRate + artisanXpPerSec + necroXpGain - wardXpDrain, 2),
    herb:    roundTo(herbProduced - herbConsumed, 2),
    beast:   roundTo(rangerJacks * catsEyeFactor * (beastChance / 100) * (expectedMeatYield + rangerBeastBonus) + baitedTrapsRate, 2),
    potion:  roundTo(apothecaryJacks * potionPerBrew + vatPotionGain, 2),
    spice:   roundTo(culinarianJacks * spicePerClick * culSpiceMultiplier, 2),
    dossier: roundTo(effectiveThiefRate * avgDossierYield, 2),
    treasure:         roundTo(thiefTreasurePerSec - artisanTreasurePerSec, 2),
    'precious-metal': roundTo(artisanMetalPerSec, 2),
    gemstone:         roundTo(artisanGemstonePerSec, 2),
    bone:             roundTo(bonePerSec, 2),
    brimstone:        roundTo(brimstonePerSec, 2),
  };
}

/**
 * Calculate a per-currency, per-source breakdown of all per-second contributions.
 * Sources are character names or "Passive" for upgrade-only income.
 * Only non-zero entries are included.
 */
export function calculatePerSecondBreakdown(ctx: PerSecondContext): PerSecondBreakdown {
  const u = ctx.upgrades;

  // ── Relic levels ──────────────────────────────────────────
  const rl = ctx.relicLevels;
  const hasFighterRelic    = (rl['fighter']    ?? 0) >= 1;
  const hasRangerRelic     = (rl['ranger']     ?? 0) >= 1;
  const hasApothecaryRelic = (rl['apothecary'] ?? 0) >= 1;
  const hasCulinarianRelic = (rl['culinarian'] ?? 0) >= 1;
  const hasThiefRelic      = (rl['thief']      ?? 0) >= 1;
  const hasArtisanRelic    = (rl['artisan']    ?? 0) >= 1;

  // ── Jack counts (starved / stunned jacks produce nothing) ──
  // Relic doubling: when a character's relic is active, each jack counts as two.
  const fighterJacks    = (ctx.jacksAllocations['fighter']    ?? 0) * (hasFighterRelic ? 2 : 1);
  const rangerJacks     = (ctx.jacksAllocations['ranger']     ?? 0) * (hasRangerRelic ? 2 : 1);
  const apothecaryJacks = (ctx.jackStarved['apothecary'] ? 0 : (ctx.jacksAllocations['apothecary'] ?? 0)) * (hasApothecaryRelic ? 2 : 1);
  const culinarianJacks = (ctx.jackStarved['culinarian'] ? 0 : (ctx.jacksAllocations['culinarian'] ?? 0)) * (hasCulinarianRelic ? 2 : 1);
  const thiefJacks      = (ctx.jacksAllocations['thief'] ?? 0) * (hasThiefRelic ? 2 : 1);
  const artisanJacks    = (ctx.jackStarved['artisan'] ? 0 : (ctx.jacksAllocations['artisan'] ?? 0)) * (hasArtisanRelic ? 2 : 1);

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
  const sfLevel2           = u.level('POTION_OF_STICKY_FINGERS');
  const avgDossierYield    = hasThiefRelic
    ? (2 + 2 * (1 + sfLevel2)) / 2
    : calcExpectedDossierYield(sfLevel2);
  const ppGoldPerSecond    = effectiveThiefRate * avgDossierYield * u.level('PLENTIFUL_PLUNDERING');
  const thiefTreasurePerSec = hasThiefRelic ? effectiveThiefRate * 2 : 0;

  // ── Cat's Eye factor ──────────────────────────────────────
  const catsEyeLevel2  = u.level('POTION_CATS_EYE');
  const catsEyeFactor2 = 0.5 * (1 + catsEyeLevel2 / 100);

  // ── Ranger relic ──────────────────────────────────────────
  const rangerHerbBonus  = hasRangerRelic ? rangerJacks : 0;
  const rangerBeastBonus = hasRangerRelic ? 1 : 0;

  // ── Herb rates ────────────────────────────────────────────
  const vatLevel2     = ctx.fermentationVatsEnabled ? u.level('FERMENTATION_VATS') : 0;
  const vatHerbDrain  = vatLevel2 * 0.1;
  const vatPotionGain = vatLevel2 * 0.1;
  const hovelGardenRate2 = calcHovelGardenHerbPerTick(u.level('HOVEL_GARDEN'), u.level('ORNATE_HERB_POTS')) * 0.2;
  const apothHerbCost = Math.max(0, YIELDS.APOTHECARY_BREW_HERB_COST - (hasApothecaryRelic ? 1 : 0));
  const herbConsumed = apothecaryJacks * (apothHerbCost - herbSaveChance / 100)
    + vatHerbDrain;

  // ── Beast rates ───────────────────────────────────────────
  const expectedMeatYield = (u.level('BIGGER_GAME') + 2) / 2;
  const baitedTrapsRate   = calcBaitedTrapsBeastPerTick(u.level('BAITED_TRAPS'), u.level('SPICED_BAIT')) * 0.2;

  // ── Potion / Spice relic multipliers ──────────────────────
  const potionPerBrew      = hasApothecaryRelic ? 2 : 1;
  const culSpiceMultiplier = hasCulinarianRelic ? 2 : 1;

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
  if (fighterJacks > 0)                add('gold', 'Fighter', roundTo(fighterJacks * goldPerClick + (hasFighterRelic ? fighterJacks * autoGoldPerSec : 0), 2));
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
  const herbJackRate   = roundTo(rangerJacks * catsEyeFactor2 * expectedHerbPerRangerClick(u.level('MORE_HERBS')) + rangerHerbBonus * catsEyeFactor2, 2);
  const herbGardenRate = roundTo(hovelGardenRate2, 2);
  if (herbJackRate   !== 0) add('herb', 'Ranger',  herbJackRate);
  if (herbGardenRate !== 0) add('herb', 'Passive', herbGardenRate);
  if (herbConsumed    > 0)  add('herb', 'Apothecary', roundTo(-herbConsumed, 2));

  // Beast
  const beastJackRate = roundTo(rangerJacks * catsEyeFactor2 * (beastChance / 100) * (expectedMeatYield + rangerBeastBonus), 2);
  const beastTrapRate = roundTo(baitedTrapsRate, 2);
  if (beastJackRate !== 0)  add('beast', 'Ranger',  beastJackRate);
  if (beastTrapRate !== 0)  add('beast', 'Passive', beastTrapRate);

  // Potion
  if (apothecaryJacks > 0)            add('potion', 'Apothecary', roundTo(apothecaryJacks * potionPerBrew, 2));
  if (vatPotionGain > 0)              add('potion', 'Fermentation Vats', roundTo(vatPotionGain, 2));

  // Spice
  if (culinarianJacks > 0)             add('spice', 'Culinarian', roundTo(culinarianJacks * spicePerClick * culSpiceMultiplier, 2));

  // Dossier
  const dossierRate = roundTo(effectiveThiefRate * avgDossierYield, 2);
  if (dossierRate !== 0)               add('dossier', 'Thief', dossierRate);

  // Treasure (thief relic contribution)
  if (thiefTreasurePerSec > 0)         add('treasure', 'Thief', roundTo(thiefTreasurePerSec, 2));

  // Artisan rates
  const artTimerSec      = calcArtisanTimerMs(u.level('FASTER_APPRAISING')) / 1000;
  const artTreasureCost  = calcArtisanTreasureCost();
  const artCyclesPerSec  = artisanJacks > 0 ? 1 / artTimerSec : 0;
  const artTreasureRate  = roundTo(-artisanJacks * artTreasureCost * artCyclesPerSec, 2);
  const artGemstoneRate  = roundTo(artisanJacks * expectedGemstonePerAppraisalJack(u.level('POTION_CATS_PAW'), hasArtisanRelic) * artCyclesPerSec, 2);
  const artMetalRate     = roundTo(artisanJacks * expectedMetalPerAppraisalJack(u.level('POTION_CATS_PAW'), hasArtisanRelic) * artCyclesPerSec, 2);
  const artXpRate        = roundTo(artisanJacks * artCyclesPerSec, 2);

  if (artTreasureRate !== 0)  add('treasure',        'Artisan', artTreasureRate);
  if (artGemstoneRate !== 0)  add('gemstone',        'Artisan', artGemstoneRate);
  if (artMetalRate !== 0)     add('precious-metal',  'Artisan', artMetalRate);
  if (artXpRate !== 0)        add('xp',              'Artisan', artXpRate);

  // Necromancer
  const hasNecromancerRelic2 = (rl['necromancer'] ?? 0) >= 1;
  // With relic: both jack types always produce regardless of active button.
  const rawDefileJacks2 = ctx.jacksAllocations['necromancer-defile'] ?? 0;
  const rawWardJacks2   = ctx.jackStarved['necromancer-ward'] ? 0 : (ctx.jacksAllocations['necromancer-ward'] ?? 0);
  const defileJacks2 = hasNecromancerRelic2 ? rawDefileJacks2
    : (ctx.necromancerActiveButton === 'defile' ? rawDefileJacks2 : 0);
  const wardJacks2   = hasNecromancerRelic2 ? rawWardJacks2
    : (ctx.necromancerActiveButton === 'ward'   ? rawWardJacks2   : 0);

  const boneRate2    = roundTo(defileJacks2 * calcNecromancerBoneYield() * (hasNecromancerRelic2 ? 2 : 1), 2);
  const brimRate2    = roundTo(wardJacks2   * calcNecromancerBrimstoneYield() * (hasNecromancerRelic2 ? 2 : 1), 2);
  const wardXpDrain2 = roundTo(wardJacks2   * calcNecromancerWardXpCost(u.level('DARK_PACT')), 2);
  const necroXpGain2 = roundTo(defileJacks2, 2);

  if (boneRate2 !== 0)    add('bone',      'Necromancer', boneRate2);
  if (brimRate2 !== 0)    add('brimstone', 'Necromancer', brimRate2);
  if (necroXpGain2 !== 0) add('xp',        'Necromancer (Defile)', necroXpGain2);
  if (wardXpDrain2 !== 0) add('xp',        'Necromancer (Ward)',  -wardXpDrain2);

  return bd;
}
