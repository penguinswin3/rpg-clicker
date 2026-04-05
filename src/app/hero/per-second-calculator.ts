/**
 * ════════════════════════════════════════════════════════════
 *   PER-SECOND RATE CALCULATOR
 *   Pure function that computes display rates for all
 *   currencies, factoring in jacks, starvation, and stun.
 * ════════════════════════════════════════════════════════════
 */

import { YIELDS, FAMILIAR } from '../game-config';
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
  calcNecromancerBrimstoneYield, calcGraveLootingChance,
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
  /** Familiar absolute-expiry timestamps per jack allocation key (ms). Active if > Date.now(). */
  familiarTimers: Record<string, number>;
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
  jewelry:           number;
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
  // Familiar: each active familiar adds JACKS_PER_FAMILIAR to the pre-relic count.
  const now = Date.now();
  const fam = (key: string) => (ctx.familiarTimers[key] ?? 0) > now ? FAMILIAR.JACKS_PER_FAMILIAR : 0;
  const fighterJacks    = ((ctx.jacksAllocations['fighter']    ?? 0) + fam('fighter'))    * (hasFighterRelic ? 2 : 1);
  const rangerJacks     = ((ctx.jacksAllocations['ranger']     ?? 0) + fam('ranger'))     * (hasRangerRelic ? 2 : 1);
  const apothecaryJacks = (ctx.jackStarved['apothecary'] ? 0 : ((ctx.jacksAllocations['apothecary'] ?? 0) + fam('apothecary'))) * (hasApothecaryRelic ? 2 : 1);
  const culinarianJacks = (ctx.jackStarved['culinarian'] ? 0 : ((ctx.jacksAllocations['culinarian'] ?? 0) + fam('culinarian'))) * (hasCulinarianRelic ? 2 : 1);
  const thiefJacks      = ((ctx.jacksAllocations['thief'] ?? 0) + fam('thief'))           * (hasThiefRelic ? 2 : 1);
  const artisanJacks    = (ctx.jackStarved['artisan'] ? 0 : ((ctx.jacksAllocations['artisan'] ?? 0) + fam('artisan'))) * (hasArtisanRelic ? 2 : 1);

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
  const rawDefileJacks = (ctx.jacksAllocations['necromancer-defile'] ?? 0) + fam('necromancer-defile');
  const rawWardJacks   = ctx.jackStarved['necromancer-ward'] ? 0 : ((ctx.jacksAllocations['necromancer-ward'] ?? 0) + fam('necromancer-ward'));
  const defileJacks = hasNecromancerRelic ? rawDefileJacks
    : (ctx.necromancerActiveButton === 'defile' ? rawDefileJacks : 0);
  const wardJacks   = hasNecromancerRelic ? rawWardJacks
    : (ctx.necromancerActiveButton === 'ward'   ? rawWardJacks   : 0);
  // Average bone yield = (1 + max) / 2
  const boneMax          = calcNecromancerBoneYield(u.level('SPEAK_WITH_DEAD'));
  const avgBoneYield     = (1 + boneMax) / 2;
  // Average brimstone yield = (1 + max) / 2
  const brimstoneMax     = calcNecromancerBrimstoneYield(u.level('FORTIFIED_CHALK'));
  const avgBrimstoneYield = (1 + brimstoneMax) / 2;
  // Relic: double effectiveness (×2 yield)
  const bonePerSec      = defileJacks * avgBoneYield * (hasNecromancerRelic ? 2 : 1);
  const brimstonePerSec = wardJacks   * avgBrimstoneYield * (hasNecromancerRelic ? 2 : 1);
  const wardXpDrain     = wardJacks * calcNecromancerWardXpCost(u.level('DARK_PACT'));
  const necroXpGain     = defileJacks; // defile gives 1 xp per click

  // Grave Looting per-second gold/gem/jewelry contributions from defile jacks
  const graveLootChance = calcGraveLootingChance(u.level('GRAVE_LOOTING')) / 100;
  const graveLootGoldPerSec    = defileJacks * graveLootChance * YIELDS.GRAVE_LOOTING_GOLD_WEIGHT    * YIELDS.GRAVE_LOOTING_GOLD_AMOUNT    * (hasNecromancerRelic ? 2 : 1);
  const graveLootGemPerSec     = defileJacks * graveLootChance * YIELDS.GRAVE_LOOTING_GEM_WEIGHT     * YIELDS.GRAVE_LOOTING_GEM_AMOUNT     * (hasNecromancerRelic ? 2 : 1);
  const graveLootJewelryPerSec = defileJacks * graveLootChance * YIELDS.GRAVE_LOOTING_JEWELRY_WEIGHT * YIELDS.GRAVE_LOOTING_JEWELRY_AMOUNT * (hasNecromancerRelic ? 2 : 1);

  return {
    gold:    roundTo(autoGoldPerSec + fighterRelicGold + apothecaryJacks * goldPerBrew + fighterJacks * goldPerClick - culinarianJacks * culGoldCost + ppGoldPerSecond + graveLootGoldPerSec, 2),
    xp:      roundTo(fighterJacks * xpPerBounty + rangerJacks + apothecaryJacks + culinarianJacks + effectiveThiefRate + artisanXpPerSec + necroXpGain - wardXpDrain, 2),
    herb:    roundTo(herbProduced - herbConsumed, 2),
    beast:   roundTo(rangerJacks * catsEyeFactor * (beastChance / 100) * (expectedMeatYield + rangerBeastBonus) + baitedTrapsRate, 2),
    potion:  roundTo(apothecaryJacks * potionPerBrew + vatPotionGain, 2),
    spice:   roundTo(culinarianJacks * spicePerClick * culSpiceMultiplier, 2),
    dossier: roundTo(effectiveThiefRate * avgDossierYield, 2),
    treasure:         roundTo(thiefTreasurePerSec - artisanTreasurePerSec, 2),
    'precious-metal': roundTo(artisanMetalPerSec, 2),
    gemstone:         roundTo(artisanGemstonePerSec + graveLootGemPerSec, 2),
    jewelry:          roundTo(graveLootJewelryPerSec, 2),
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

  // ── Jack counts: split into regular jacks vs familiar jacks ──
  // Both are subject to starvation / stun checks and relic doubling.
  const now2 = Date.now();
  const famRaw = (key: string) => (ctx.familiarTimers[key] ?? 0) > now2 ? FAMILIAR.JACKS_PER_FAMILIAR : 0;

  const relicMul = (hasRelic: boolean) => hasRelic ? 2 : 1;

  // Regular jacks (allocated from pool)
  const fJacks   = (ctx.jacksAllocations['fighter']    ?? 0) * relicMul(hasFighterRelic);
  const rJacks   = (ctx.jacksAllocations['ranger']     ?? 0) * relicMul(hasRangerRelic);
  const aJacks   = (ctx.jackStarved['apothecary'] ? 0 : (ctx.jacksAllocations['apothecary'] ?? 0)) * relicMul(hasApothecaryRelic);
  const cJacks   = (ctx.jackStarved['culinarian'] ? 0 : (ctx.jacksAllocations['culinarian'] ?? 0)) * relicMul(hasCulinarianRelic);
  const tJacks   = (ctx.jacksAllocations['thief']      ?? 0) * relicMul(hasThiefRelic);
  const artJacks = (ctx.jackStarved['artisan'] ? 0 : (ctx.jacksAllocations['artisan'] ?? 0)) * relicMul(hasArtisanRelic);

  // Familiar jacks (separate line in breakdown)
  const fFam   = famRaw('fighter')    * relicMul(hasFighterRelic);
  const rFam   = famRaw('ranger')     * relicMul(hasRangerRelic);
  const aFam   = (ctx.jackStarved['apothecary'] ? 0 : famRaw('apothecary')) * relicMul(hasApothecaryRelic);
  const cFam   = (ctx.jackStarved['culinarian'] ? 0 : famRaw('culinarian')) * relicMul(hasCulinarianRelic);
  const tFam   = famRaw('thief')      * relicMul(hasThiefRelic);
  const artFam = (ctx.jackStarved['artisan'] ? 0 : famRaw('artisan')) * relicMul(hasArtisanRelic);

  // Combined totals (same as calculatePerSecondRates uses)
  const fighterJacks    = fJacks   + fFam;
  const rangerJacks     = rJacks   + rFam;
  const apothecaryJacks = aJacks   + aFam;
  const culinarianJacks = cJacks   + cFam;
  const thiefJacks      = tJacks   + tFam;
  const artisanJacks    = artJacks + artFam;

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
  const effectiveThiefRate = ctx.isThiefStunned ? 0 : tJacks * thiefSuccessRate;
  const effectiveThiefFam  = ctx.isThiefStunned ? 0 : tFam   * thiefSuccessRate;
  const sfLevel2           = u.level('POTION_OF_STICKY_FINGERS');
  const avgDossierYield    = hasThiefRelic
    ? (2 + 2 * (1 + sfLevel2)) / 2
    : calcExpectedDossierYield(sfLevel2);
  const ppLevel            = u.level('PLENTIFUL_PLUNDERING');
  const thiefTreasurePerJack = hasThiefRelic ? 2 : 0;

  // ── Cat's Eye factor ──────────────────────────────────────
  const catsEyeLevel2  = u.level('POTION_CATS_EYE');
  const catsEyeFactor2 = 0.5 * (1 + catsEyeLevel2 / 100);

  // ── Ranger relic ──────────────────────────────────────────
  const rangerHerbBonusPerJack = hasRangerRelic ? 1 : 0;
  const rangerBeastBonus       = hasRangerRelic ? 1 : 0;

  // ── Herb rates ────────────────────────────────────────────
  const vatLevel2     = ctx.fermentationVatsEnabled ? u.level('FERMENTATION_VATS') : 0;
  const vatHerbDrain  = vatLevel2 * 0.1;
  const vatPotionGain = vatLevel2 * 0.1;
  const hovelGardenRate2 = calcHovelGardenHerbPerTick(u.level('HOVEL_GARDEN'), u.level('ORNATE_HERB_POTS')) * 0.2;
  const apothHerbCost = Math.max(0, YIELDS.APOTHECARY_BREW_HERB_COST - (hasApothecaryRelic ? 1 : 0));
  const herbCostPerJack = apothHerbCost - herbSaveChance / 100;

  // ── Beast rates ───────────────────────────────────────────
  const expectedMeatYield = (u.level('BIGGER_GAME') + 2) / 2;
  const baitedTrapsRate   = calcBaitedTrapsBeastPerTick(u.level('BAITED_TRAPS'), u.level('SPICED_BAIT')) * 0.2;
  const herbPerRanger     = catsEyeFactor2 * expectedHerbPerRangerClick(u.level('MORE_HERBS'));
  const beastPerRanger    = catsEyeFactor2 * (beastChance / 100) * (expectedMeatYield + rangerBeastBonus);

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

  // ── Gold ──────────────────────────────────────────────────
  if (autoGoldPerSec > 0) add('gold', 'Passive', autoGoldPerSec);
  if (fJacks > 0) add('gold', 'Fighter', roundTo(fJacks * goldPerClick + (hasFighterRelic ? fJacks * autoGoldPerSec : 0), 2));
  if (fFam   > 0) add('gold', 'Familiar (Fighter)', roundTo(fFam * goldPerClick + (hasFighterRelic ? fFam * autoGoldPerSec : 0), 2));
  if (aJacks > 0 && goldPerBrew > 0) add('gold', 'Apothecary', roundTo(aJacks * goldPerBrew, 2));
  if (aFam   > 0 && goldPerBrew > 0) add('gold', 'Familiar (Apothecary)', roundTo(aFam * goldPerBrew, 2));
  if (cJacks > 0) add('gold', 'Culinarian', roundTo(-cJacks * culGoldCost, 2));
  if (cFam   > 0) add('gold', 'Familiar (Culinarian)', roundTo(-cFam * culGoldCost, 2));
  if (effectiveThiefRate > 0 && ppLevel > 0) add('gold', 'Thief', roundTo(effectiveThiefRate * avgDossierYield * ppLevel, 2));
  if (effectiveThiefFam  > 0 && ppLevel > 0) add('gold', 'Familiar (Thief)', roundTo(effectiveThiefFam * avgDossierYield * ppLevel, 2));

  // ── XP ────────────────────────────────────────────────────
  if (fJacks > 0) add('xp', 'Fighter', roundTo(fJacks * xpPerBounty, 2));
  if (fFam   > 0) add('xp', 'Familiar (Fighter)', roundTo(fFam * xpPerBounty, 2));
  if (rJacks > 0) add('xp', 'Ranger', roundTo(rJacks, 2));
  if (rFam   > 0) add('xp', 'Familiar (Ranger)', roundTo(rFam, 2));
  if (aJacks > 0) add('xp', 'Apothecary', roundTo(aJacks, 2));
  if (aFam   > 0) add('xp', 'Familiar (Apothecary)', roundTo(aFam, 2));
  if (cJacks > 0) add('xp', 'Culinarian', roundTo(cJacks, 2));
  if (cFam   > 0) add('xp', 'Familiar (Culinarian)', roundTo(cFam, 2));
  if (effectiveThiefRate > 0) add('xp', 'Thief', roundTo(effectiveThiefRate, 2));
  if (effectiveThiefFam  > 0) add('xp', 'Familiar (Thief)', roundTo(effectiveThiefFam, 2));

  // ── Herb ──────────────────────────────────────────────────
  const rJackHerb = roundTo(rJacks * herbPerRanger + (hasRangerRelic ? rJacks : 0) * catsEyeFactor2, 2);
  const rFamHerb  = roundTo(rFam   * herbPerRanger + (hasRangerRelic ? rFam   : 0) * catsEyeFactor2, 2);
  if (rJackHerb !== 0) add('herb', 'Ranger', rJackHerb);
  if (rFamHerb  !== 0) add('herb', 'Familiar (Ranger)', rFamHerb);
  if (hovelGardenRate2 !== 0) add('herb', 'Passive', roundTo(hovelGardenRate2, 2));
  if (aJacks > 0) add('herb', 'Apothecary', roundTo(-aJacks * herbCostPerJack, 2));
  if (aFam   > 0) add('herb', 'Familiar (Apothecary)', roundTo(-aFam * herbCostPerJack, 2));
  if (vatHerbDrain > 0) add('herb', 'Passive', roundTo(-vatHerbDrain, 2));

  // ── Beast ─────────────────────────────────────────────────
  const rJackBeast = roundTo(rJacks * beastPerRanger, 2);
  const rFamBeast  = roundTo(rFam   * beastPerRanger, 2);
  if (rJackBeast !== 0) add('beast', 'Ranger', rJackBeast);
  if (rFamBeast  !== 0) add('beast', 'Familiar (Ranger)', rFamBeast);
  if (baitedTrapsRate !== 0) add('beast', 'Passive', roundTo(baitedTrapsRate, 2));

  // ── Potion ────────────────────────────────────────────────
  if (aJacks > 0) add('potion', 'Apothecary', roundTo(aJacks * potionPerBrew, 2));
  if (aFam   > 0) add('potion', 'Familiar (Apothecary)', roundTo(aFam * potionPerBrew, 2));
  if (vatPotionGain > 0) add('potion', 'Passive', roundTo(vatPotionGain, 2));

  // ── Spice ─────────────────────────────────────────────────
  if (cJacks > 0) add('spice', 'Culinarian', roundTo(cJacks * spicePerClick * culSpiceMultiplier, 2));
  if (cFam   > 0) add('spice', 'Familiar (Culinarian)', roundTo(cFam * spicePerClick * culSpiceMultiplier, 2));

  // ── Dossier ───────────────────────────────────────────────
  if (effectiveThiefRate > 0) add('dossier', 'Thief', roundTo(effectiveThiefRate * avgDossierYield, 2));
  if (effectiveThiefFam  > 0) add('dossier', 'Familiar (Thief)', roundTo(effectiveThiefFam * avgDossierYield, 2));

  // ── Treasure ──────────────────────────────────────────────
  if (effectiveThiefRate > 0 && thiefTreasurePerJack > 0) add('treasure', 'Thief', roundTo(effectiveThiefRate * thiefTreasurePerJack, 2));
  if (effectiveThiefFam  > 0 && thiefTreasurePerJack > 0) add('treasure', 'Familiar (Thief)', roundTo(effectiveThiefFam * thiefTreasurePerJack, 2));

  // ── Artisan ───────────────────────────────────────────────
  const artTimerSec      = calcArtisanTimerMs(u.level('FASTER_APPRAISING')) / 1000;
  const artTreasureCost  = calcArtisanTreasureCost();
  const artJackCycles    = artJacks > 0 ? 1 / artTimerSec : 0;
  const artFamCycles     = artFam   > 0 ? 1 / artTimerSec : 0;

  if (artJacks > 0) {
    add('treasure',       'Artisan', roundTo(-artJacks * artTreasureCost * artJackCycles, 2));
    add('gemstone',       'Artisan', roundTo(artJacks * expectedGemstonePerAppraisalJack(u.level('POTION_CATS_PAW'), hasArtisanRelic) * artJackCycles, 2));
    add('precious-metal', 'Artisan', roundTo(artJacks * expectedMetalPerAppraisalJack(u.level('POTION_CATS_PAW'), hasArtisanRelic) * artJackCycles, 2));
    add('xp',             'Artisan', roundTo(artJacks * artJackCycles, 2));
  }
  if (artFam > 0) {
    add('treasure',       'Familiar (Artisan)', roundTo(-artFam * artTreasureCost * artFamCycles, 2));
    add('gemstone',       'Familiar (Artisan)', roundTo(artFam * expectedGemstonePerAppraisalJack(u.level('POTION_CATS_PAW'), hasArtisanRelic) * artFamCycles, 2));
    add('precious-metal', 'Familiar (Artisan)', roundTo(artFam * expectedMetalPerAppraisalJack(u.level('POTION_CATS_PAW'), hasArtisanRelic) * artFamCycles, 2));
    add('xp',             'Familiar (Artisan)', roundTo(artFam * artFamCycles, 2));
  }

  // ── Necromancer ───────────────────────────────────────────
  const hasNecromancerRelic2 = (rl['necromancer'] ?? 0) >= 1;
  const necRelicYieldMul = hasNecromancerRelic2 ? 2 : 1;

  // Raw jack counts (before active-button gating)
  const rawDefJacks = (ctx.jacksAllocations['necromancer-defile'] ?? 0);
  const rawDefFam   = famRaw('necromancer-defile');
  const rawWrdJacks = ctx.jackStarved['necromancer-ward'] ? 0 : (ctx.jacksAllocations['necromancer-ward'] ?? 0);
  const rawWrdFam   = ctx.jackStarved['necromancer-ward'] ? 0 : famRaw('necromancer-ward');

  // Active-button gating (relic: always active)
  const defJacks = hasNecromancerRelic2 ? rawDefJacks : (ctx.necromancerActiveButton === 'defile' ? rawDefJacks : 0);
  const defFam   = hasNecromancerRelic2 ? rawDefFam   : (ctx.necromancerActiveButton === 'defile' ? rawDefFam   : 0);
  const wrdJacks = hasNecromancerRelic2 ? rawWrdJacks : (ctx.necromancerActiveButton === 'ward'   ? rawWrdJacks : 0);
  const wrdFam   = hasNecromancerRelic2 ? rawWrdFam   : (ctx.necromancerActiveButton === 'ward'   ? rawWrdFam   : 0);

  const boneMax2          = calcNecromancerBoneYield(u.level('SPEAK_WITH_DEAD'));
  const avgBoneYield2     = (1 + boneMax2) / 2;
  const brimstoneMax2     = calcNecromancerBrimstoneYield(u.level('FORTIFIED_CHALK'));
  const avgBrimstoneYield2 = (1 + brimstoneMax2) / 2;

  if (defJacks > 0) add('bone', 'Necromancer', roundTo(defJacks * avgBoneYield2 * necRelicYieldMul, 2));
  if (defFam   > 0) add('bone', 'Familiar (Necromancer)', roundTo(defFam * avgBoneYield2 * necRelicYieldMul, 2));
  if (wrdJacks > 0) add('brimstone', 'Necromancer', roundTo(wrdJacks * avgBrimstoneYield2 * necRelicYieldMul, 2));
  if (wrdFam   > 0) add('brimstone', 'Familiar (Necromancer)', roundTo(wrdFam * avgBrimstoneYield2 * necRelicYieldMul, 2));

  // XP from Defile / Ward
  if (defJacks > 0) add('xp', 'Necromancer (Defile)', roundTo(defJacks, 2));
  if (defFam   > 0) add('xp', 'Familiar (Defile)',    roundTo(defFam, 2));
  const wardXpCost = calcNecromancerWardXpCost(u.level('DARK_PACT'));
  if (wrdJacks > 0) add('xp', 'Necromancer (Ward)', roundTo(-wrdJacks * wardXpCost, 2));
  if (wrdFam   > 0) add('xp', 'Familiar (Ward)',    roundTo(-wrdFam   * wardXpCost, 2));

  // Grave Looting bonus loot
  const graveLootChance2 = calcGraveLootingChance(u.level('GRAVE_LOOTING')) / 100;
  if (graveLootChance2 > 0) {
    const glGold    = YIELDS.GRAVE_LOOTING_GOLD_WEIGHT    * YIELDS.GRAVE_LOOTING_GOLD_AMOUNT    * necRelicYieldMul;
    const glGem     = YIELDS.GRAVE_LOOTING_GEM_WEIGHT     * YIELDS.GRAVE_LOOTING_GEM_AMOUNT     * necRelicYieldMul;
    const glJewelry = YIELDS.GRAVE_LOOTING_JEWELRY_WEIGHT * YIELDS.GRAVE_LOOTING_JEWELRY_AMOUNT * necRelicYieldMul;
    if (defJacks > 0) {
      add('gold',    'Necromancer (Exhume)', roundTo(defJacks * graveLootChance2 * glGold, 2));
      add('gemstone','Necromancer (Exhume)', roundTo(defJacks * graveLootChance2 * glGem, 2));
      add('jewelry', 'Necromancer (Exhume)', roundTo(defJacks * graveLootChance2 * glJewelry, 2));
    }
    if (defFam > 0) {
      add('gold',    'Familiar (Exhume)', roundTo(defFam * graveLootChance2 * glGold, 2));
      add('gemstone','Familiar (Exhume)', roundTo(defFam * graveLootChance2 * glGem, 2));
      add('jewelry', 'Familiar (Exhume)', roundTo(defFam * graveLootChance2 * glJewelry, 2));
    }
  }

  return bd;
}
