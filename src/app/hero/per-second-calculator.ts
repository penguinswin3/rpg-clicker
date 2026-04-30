/**
 * ════════════════════════════════════════════════════════════
 *   PER-SECOND RATE CALCULATOR
 *   Single-pass calculation of display rates AND the breakdown for
 *   all currencies.  `calculatePerSecond` is the canonical entry
 *   point; the two legacy exports are thin wrappers kept for any
 *   remaining external call-sites.
 * ════════════════════════════════════════════════════════════
 */

import { YIELDS, FAMILIAR, JACKD_UP_SPEED_MULT, MERCHANT_MG, CHIMERAMANCER_YIELDS, SLAYER } from '../game-config';
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
  expectedGemstonePerAppraisalJack, expectedMetalPerAppraisalJack,
  calcNecromancerBoneYield, calcNecromancerWardXpCost,
  calcNecromancerBrimstoneYield, calcGraveLootingChance,
  calcMerchantOpensPerClick,
  calcChimeramancerThreadPerClick, calcSharperNeedlesThreadPerSec,
  calcExpectedIllicitLootPerRoll,
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
  /** Whether the Jack'd Up global upgrade has been purchased (makes jacks 50% faster). */
  jackdUpUnlocked: boolean;
  /** Whether all familiars are currently paused by the player. */
  familiarsPaused: boolean;
  /** Per-key individual familiar pause state. A familiar is paused if familiarsPaused OR this key is true. */
  familiarPausedKeys?: Record<string, boolean>;
  /** Per-character bead yield multipliers (2^N where N = socketed blue beads). */
  beadMultipliers?: Record<string, number>;
  /** Active merchant auto-buyers — each entry represents a stock market auto-purchase. */
  merchantAutoBuyers?: { currencyId: string; goldCostPerTick: number; qtyPerTick: number }[];
  /** Which artificer button is currently active ('study' or 'reflect'). */
  artificerActiveButton: 'study' | 'reflect';
  /** Current insight level of the Artificer (used for mana output estimate). */
  artificerInsight: number;
  /** Currently-selected kobold level in the fighter minigame (for secondary drop rates). */
  selectedKoboldLevel: number;
  /** Whether the Chimeramancer relic (Thread of Infinite Weaving) is enabled. */
  chimeramancerRelicEnabled: boolean;
  /** Whether the Slayer character has been unlocked (auto-attack is running). */
  slayerUnlocked: boolean;
  /** Whether the chimera is already dead (hp <= 0) — no ichor earned when dead. */
  slayerChimeraDead: boolean;
  /** Whether the Bead of Carnage (SLAYER_GOLD_BEAD_1) is socketed. */
  slayerBead1Socketed?: boolean;
  /** Whether the Bead of Annihilation (SLAYER_GOLD_BEAD_2) is socketed. */
  slayerBead2Socketed?: boolean;
  /** Number of currently-active Condemn stacks (for accurate Slayer DPS estimate). */
  activeCondemnStacks?: number;
}

// ── Result types ─────────────────────────────────────────────

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
  'illicit-goods':   number;
  mana:              number;
  construct:         number;
  'concentrated-potion': number;
  'pixie-dust':      number;
  'hearty-meal':     number;
  'soul-stone':      number;
  'synaptical-potion': number;
  'kobold-ear':      number;
  'kobold-tongue':   number;
  'kobold-hair':     number;
  'kobold-fang':     number;
  'kobold-brain':    number;
  'kobold-feather':  number;
  'kobold-pebble':   number;
  'kobold-heart':    number;
  'monster-trophy':  number;
  'forbidden-tome':  number;
  'magical-implement': number;
  'life-thread':     number;
  ichor:             number;
}

export type PerSecondBreakdown = Record<string, Record<string, number>>;

export interface PerSecondResult {
  rates:     PerSecondRates;
  breakdown: PerSecondBreakdown;
}

// ── Slayer helper ────────────────────────────────────────────

function calcSlayerIchorPerSecond(ctx: PerSecondContext): number {
  if (!ctx.slayerUnlocked || ctx.slayerChimeraDead) return 0;
  const u = ctx.upgrades;
  let dmg = SLAYER.DAMAGE_PER_CLICK + u.level('KNOW_NO_FEAR') * SLAYER.KNOW_NO_FEAR_DAMAGE;
  const condemnLevel = u.level('CONDEMN');
  const activeStacks = ctx.activeCondemnStacks ?? 0;
  if (condemnLevel > 0 && activeStacks > 0) dmg += condemnLevel * SLAYER.CONDEMN_DAMAGE_PER_LEVEL * activeStacks;
  if (u.level('BANISHMENT') > 0 && activeStacks >= SLAYER.CONDEMN_MAX_STACKS) dmg *= SLAYER.BANISHMENT_DAMAGE_MULTIPLIER;
  if (ctx.slayerBead1Socketed) dmg *= 2;
  if (ctx.slayerBead2Socketed) dmg *= 2;
  const ichorMult = ctx.beadMultipliers?.['slayer'] ?? 1;
  const windfuryLevel = u.level('WINDFURY');
  let windfuryMult = 1;
  if (windfuryLevel > 0) {
    const p = Math.min(1, windfuryLevel * SLAYER.WINDFURY_CHANCE_PER_LEVEL);
    if (u.level('THUNDERFURY') > 0) {
      if (u.level('SUNFURY') > 0) {
        let extra = 0, p2 = 2 * p;
        for (let i = 0; i < SLAYER.THUNDERFURY_MAX_CHAIN; i++) { extra += p2; p2 *= 2 * p; }
        windfuryMult = 1 + extra;
      } else {
        let extra = 0, pp = p;
        for (let i = 0; i < SLAYER.THUNDERFURY_MAX_CHAIN; i++) { extra += pp; pp *= p; }
        windfuryMult = 1 + extra;
      }
    } else {
      windfuryMult = 1 + p;
    }
  }
  const intervalMs = Math.max(SLAYER.AUTO_ATTACK_MIN_MS, SLAYER.AUTO_ATTACK_BASE_MS - u.level('BLOODLUST') * SLAYER.BLOODLUST_REDUCTION_MS);
  return (dmg * ichorMult * windfuryMult) / (intervalMs / 1000);
}

// ── Single-pass combined calculation ────────────────────────

/**
 * Computes per-second rates AND the source breakdown in a single pass,
 * sharing all intermediate values.  ~2× faster than calling the old
 * calculatePerSecondRates + calculatePerSecondBreakdown separately.
 */
export function calculatePerSecond(ctx: PerSecondContext): PerSecondResult {
  const u = ctx.upgrades;
  const bm = (charId: string) => ctx.beadMultipliers?.[charId] ?? 1;

  // ── Relic levels ──────────────────────────────────────────────
  const rl = ctx.relicLevels;
  const hasFighterRelic       = (rl['fighter']       ?? 0) >= 1;
  const hasRangerRelic        = (rl['ranger']        ?? 0) >= 1;
  const hasApothecaryRelic    = (rl['apothecary']    ?? 0) >= 1;
  const hasCulinarianRelic    = (rl['culinarian']    ?? 0) >= 1;
  const hasThiefRelic         = (rl['thief']         ?? 0) >= 1;
  const hasArtisanRelic       = (rl['artisan']       ?? 0) >= 1;
  const hasNecromancerRelic   = (rl['necromancer']   ?? 0) >= 1;
  const hasMerchantRelic      = (rl['merchant']      ?? 0) >= 1;
  const hasArtificerRelic     = (rl['artificer']     ?? 0) >= 1;
  const hasChimeramancerRelic = (rl['chimeramancer'] ?? 0) >= 1;
  const relicMul = (h: boolean) => h ? 2 : 1;

  // ── Jack infrastructure ───────────────────────────────────────
  const jackdUp = ctx.jackdUpUnlocked ? JACKD_UP_SPEED_MULT : 1;
  const now     = Date.now();
  const effFam  = FAMILIAR.JACKS_PER_FAMILIAR + u.level('MIND_AND_SOUL') * FAMILIAR.MIND_AND_SOUL_PER_LEVEL;
  const famRaw  = (key: string) =>
    (ctx.familiarsPaused || !!ctx.familiarPausedKeys?.[key]) ? 0
    : (ctx.familiarTimers[key] ?? 0) > now ? effFam : 0;

  const chimeraRelicExtraJack = (hasChimeramancerRelic && ctx.chimeramancerRelicEnabled)
    ? (ctx.jacksAllocations['chimeramancer'] ?? 0) * relicMul(hasChimeramancerRelic) * jackdUp : 0;
  const chimeraRelicExtraFam = (hasChimeramancerRelic && ctx.chimeramancerRelicEnabled)
    ? famRaw('chimeramancer') * relicMul(hasChimeramancerRelic) * jackdUp : 0;

  const fJacks   = (ctx.jacksAllocations['fighter']    ?? 0) * relicMul(hasFighterRelic)    * jackdUp + chimeraRelicExtraJack;
  const rJacks   = (ctx.jacksAllocations['ranger']     ?? 0) * relicMul(hasRangerRelic)     * jackdUp + chimeraRelicExtraJack;
  const aJacks   = ctx.jackStarved['apothecary'] ? 0 : ((ctx.jacksAllocations['apothecary'] ?? 0) * relicMul(hasApothecaryRelic) * jackdUp + chimeraRelicExtraJack);
  const cJacks   = ctx.jackStarved['culinarian'] ? 0 : ((ctx.jacksAllocations['culinarian'] ?? 0) * relicMul(hasCulinarianRelic) * jackdUp + chimeraRelicExtraJack);
  const tJacks   = (ctx.jacksAllocations['thief']      ?? 0) * relicMul(hasThiefRelic)      * jackdUp + chimeraRelicExtraJack;
  const artJacks = ctx.jackStarved['artisan'] ? 0 : ((ctx.jacksAllocations['artisan'] ?? 0) * relicMul(hasArtisanRelic) * jackdUp + chimeraRelicExtraJack);
  const mJacks   = ctx.jackStarved['merchant'] ? 0 : ((ctx.jacksAllocations['merchant']  ?? 0) * jackdUp + chimeraRelicExtraJack);
  const chJacks  = (ctx.jacksAllocations['chimeramancer'] ?? 0) * relicMul(hasChimeramancerRelic) * jackdUp;

  const fFam   = famRaw('fighter')    * relicMul(hasFighterRelic)    * jackdUp + chimeraRelicExtraFam;
  const rFam   = famRaw('ranger')     * relicMul(hasRangerRelic)     * jackdUp + chimeraRelicExtraFam;
  const aFam   = ctx.jackStarved['apothecary'] ? 0 : (famRaw('apothecary') * relicMul(hasApothecaryRelic) * jackdUp + chimeraRelicExtraFam);
  const cFam   = ctx.jackStarved['culinarian'] ? 0 : (famRaw('culinarian') * relicMul(hasCulinarianRelic) * jackdUp + chimeraRelicExtraFam);
  const tFam   = famRaw('thief')      * relicMul(hasThiefRelic)      * jackdUp + chimeraRelicExtraFam;
  const artFam = ctx.jackStarved['artisan'] ? 0 : (famRaw('artisan') * relicMul(hasArtisanRelic) * jackdUp + chimeraRelicExtraFam);
  const mFam   = ctx.jackStarved['merchant'] ? 0 : (famRaw('merchant') * jackdUp + chimeraRelicExtraFam);
  const chFam  = famRaw('chimeramancer') * relicMul(hasChimeramancerRelic) * jackdUp;

  // Necromancer jack split
  const rawDefJacks = (ctx.jacksAllocations['necromancer-defile'] ?? 0) * jackdUp + chimeraRelicExtraJack;
  const rawDefFam   = famRaw('necromancer-defile') * jackdUp + chimeraRelicExtraFam;
  const rawWrdJacks = ctx.jackStarved['necromancer-ward'] ? 0 : ((ctx.jacksAllocations['necromancer-ward'] ?? 0) * jackdUp + chimeraRelicExtraJack);
  const rawWrdFam   = ctx.jackStarved['necromancer-ward'] ? 0 : (famRaw('necromancer-ward') * jackdUp + chimeraRelicExtraFam);
  const isNecDefile = ctx.necromancerActiveButton === 'defile';
  const defJacks = hasNecromancerRelic ? rawDefJacks : (isNecDefile ? rawDefJacks : 0);
  const defFam   = hasNecromancerRelic ? rawDefFam   : (isNecDefile ? rawDefFam   : 0);
  const wrdJacks = hasNecromancerRelic ? rawWrdJacks : (isNecDefile ? 0 : rawWrdJacks);
  const wrdFam   = hasNecromancerRelic ? rawWrdFam   : (isNecDefile ? 0 : rawWrdFam);

  // Artificer jack split
  const artRefJacks = (ctx.jacksAllocations['artificer-reflect'] ?? 0) * jackdUp + chimeraRelicExtraJack;
  const artRefFam   = famRaw('artificer-reflect') * jackdUp + chimeraRelicExtraFam;

  // ── Derived scalars ───────────────────────────────────────────
  const goldPerClick   = calcGoldPerClick(u.level('BETTER_BOUNTIES'));
  const autoGoldPerSec = calcAutoGoldPerSecond(u.level('CONTRACTED_HIRELINGS'), u.level('HIRELINGS_HIRELINGS'));
  const xpPerBounty    = calcXpPerBounty(u.level('INSIGHTFUL_CONTRACTS'));
  const goldPerBrew    = calcPotionMarketingGoldPerBrew(u.level('POTION_MARKETING'));
  const herbSaveChance = calcHerbSaveChance(u.level('POTION_TITRATION'));
  const beastChance    = calcBeastFindChance(u.level('BETTER_TRACKING'));
  const spicePerClick  = calcSpicePerClick(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'));
  const culGoldCost    = calcCulinarianGoldCost(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'), u.level('POTION_GLIBNESS'));
  const catsEyeFactor  = 0.5 * (1 + u.level('POTION_CATS_EYE') * 5 / 100);
  const culSpiceMult   = hasCulinarianRelic ? 2 : 1;

  // Thief uptime
  const thiefTotal       = tJacks + tFam;
  const thiefSuccessRate = calcThiefSuccessChance(u.level('METICULOUS_PLANNING')) / 100;
  const stunSec          = YIELDS.THIEF_STUN_DURATION_MS / 1000;
  const allSuccessPerSec = thiefTotal > 0 ? Math.pow(thiefSuccessRate, thiefTotal) : 1;
  const uptimeFraction   = thiefTotal > 0 ? 1 / (1 + (1 - allSuccessPerSec) * stunSec) : 1;
  const effThiefJacks    = tJacks * thiefSuccessRate * uptimeFraction;
  const effThiefFam      = tFam   * thiefSuccessRate * uptimeFraction;
  const avgDossierYield  = hasThiefRelic
    ? (2 + 2 * (1 + u.level('POTION_OF_STICKY_FINGERS'))) / 2
    : calcExpectedDossierYield(u.level('POTION_OF_STICKY_FINGERS'));
  const ppLevel          = u.level('PLENTIFUL_PLUNDERING');
  const thiefTreasurePerJack = hasThiefRelic ? 2 : 0;

  // Artisan
  const artTimerSec    = calcArtisanTimerMs(u.level('FASTER_APPRAISING')) / 1000;
  const artTreasureCost = calcArtisanTreasureCost();
  const artJackCycles  = artJacks > 0 ? 1 / artTimerSec : 0;
  const artFamCycles   = artFam  > 0 ? 1 / artTimerSec : 0;
  const catsPawLevel   = u.level('POTION_CATS_PAW');

  // Necromancer
  const necRelicYieldMul  = hasNecromancerRelic ? 2 : 1;
  const avgBoneYield      = (1 + calcNecromancerBoneYield(u.level('SPEAK_WITH_DEAD'))) / 2;
  const avgBrimstoneYield = (1 + calcNecromancerBrimstoneYield(u.level('FORTIFIED_CHALK'))) / 2;
  const wardXpCost        = calcNecromancerWardXpCost(u.level('DARK_PACT'));
  const graveLootChance   = calcGraveLootingChance(u.level('GRAVE_LOOTING')) / 100;

  // Apothecary / herb
  const vatLevel       = ctx.fermentationVatsEnabled ? u.level('FERMENTATION_VATS') : 0;
  const vatHerbDrain   = vatLevel * 0.1;
  const vatPotionGain  = vatLevel * 0.1;
  const vatGoldGain    = vatPotionGain * goldPerBrew;
  const hovelGardenRate = calcHovelGardenHerbPerTick(u.level('HOVEL_GARDEN'), u.level('ORNATE_HERB_POTS')) * 0.2;
  const herbCostPerJack = Math.max(0, YIELDS.APOTHECARY_BREW_HERB_COST - (hasApothecaryRelic ? 1 : 0)) - herbSaveChance / 100;
  const potionPerBrew  = hasApothecaryRelic ? 2 : 1;

  // Ranger
  const expectedMeatYield = (u.level('BIGGER_GAME') + 2) / 2;
  const baitedTrapsRate   = calcBaitedTrapsBeastPerTick(u.level('BAITED_TRAPS'), u.level('SPICED_BAIT')) * 0.2;
  const herbPerRanger     = catsEyeFactor * expectedHerbPerRangerClick(u.level('MORE_HERBS'));
  const beastPerRanger    = catsEyeFactor * (beastChance / 100) * (expectedMeatYield + (hasRangerRelic ? 1 : 0));

  // Merchant
  const merchantOpens      = calcMerchantOpensPerClick(u.level('BOXING_DAY'));
  const illicitLootPerRoll = calcExpectedIllicitLootPerRoll(u.level('BLACK_MARKET_CONNECTIONS'));
  const mLootScale         = merchantOpens * MERCHANT_MG.BASE_ROLLS * bm('merchant');

  // Artificer
  const maxInsight        = YIELDS.ARTIFICER_MAX_INSIGHT + u.level('POTION_ARCANE_INTELLECT') * YIELDS.ARTIFICER_ARCANE_INTELLECT_PER_LEVEL;
  const effInsight        = Math.min(32, maxInsight + u.level('AMPLIFIED_INSIGHT') * YIELDS.ARTIFICER_AMPLIFIED_INSIGHT_PER_LEVEL);
  const avgManaPerReflect = effInsight > 0 ? effInsight * effInsight * (hasArtificerRelic ? 2 : 1) : 0;

  // Chimeramancer
  const chThreadPerJack = calcChimeramancerThreadPerClick(CHIMERAMANCER_YIELDS.THREAD_PER_CLICK, u.level('BIGGER_THREADS')) * bm('chimeramancer');
  const needlesRate     = calcSharperNeedlesThreadPerSec(u.level('SHARPER_NEEDLES'), u.level('LOOM_OF_LIFE')) * bm('chimeramancer');

  // Slayer
  const ichorPerSec = calcSlayerIchorPerSecond(ctx);

  // ── Output accumulators ───────────────────────────────────────
  const bd: PerSecondBreakdown = {};
  const acc: Record<string, number> = {};

  /**
   * Accumulates a contribution:
   *  - Exact value into `acc` for accurate final-rounded rates.
   *  - Rounded value into `bd` for display (skips contributions < 0.005).
   */
  function add(currency: string, source: string, value: number): void {
    if (value === 0) return;
    acc[currency] = (acc[currency] ?? 0) + value;
    const v = roundTo(value, 2);
    if (v === 0) return;
    if (!bd[currency]) bd[currency] = {};
    bd[currency][source] = (bd[currency][source] ?? 0) + v;
  }

  // ══ Fighter ═══════════════════════════════════════════════════
  if (autoGoldPerSec > 0) add('gold', 'Passive', autoGoldPerSec * bm('fighter'));
  if (fJacks > 0) add('gold', 'Fighter',           (fJacks * goldPerClick + (hasFighterRelic ? fJacks * autoGoldPerSec : 0)) * bm('fighter'));
  if (fFam   > 0) add('gold', 'Familiar (Fighter)', (fFam   * goldPerClick + (hasFighterRelic ? fFam   * autoGoldPerSec : 0)) * bm('fighter'));
  if (fJacks > 0) add('xp', 'Fighter',           fJacks * xpPerBounty * bm('fighter'));
  if (fFam   > 0) add('xp', 'Familiar (Fighter)', fFam   * xpPerBounty * bm('fighter'));

  // ══ Ranger ════════════════════════════════════════════════════
  const rJackHerb = (rJacks * herbPerRanger + (hasRangerRelic ? rJacks : 0) * catsEyeFactor) * bm('ranger');
  const rFamHerb  = (rFam   * herbPerRanger + (hasRangerRelic ? rFam   : 0) * catsEyeFactor) * bm('ranger');
  if (rJackHerb !== 0) add('herb', 'Ranger',           rJackHerb);
  if (rFamHerb  !== 0) add('herb', 'Familiar (Ranger)', rFamHerb);
  if (hovelGardenRate !== 0) add('herb', 'Passive', hovelGardenRate * bm('ranger'));
  if (rJacks > 0) add('beast', 'Ranger',           rJacks * beastPerRanger * bm('ranger'));
  if (rFam   > 0) add('beast', 'Familiar (Ranger)', rFam   * beastPerRanger * bm('ranger'));
  if (baitedTrapsRate !== 0) add('beast', 'Passive', baitedTrapsRate * bm('ranger'));
  if (rJacks > 0) add('xp', 'Ranger',           rJacks * bm('ranger'));
  if (rFam   > 0) add('xp', 'Familiar (Ranger)', rFam   * bm('ranger'));

  // ══ Apothecary ════════════════════════════════════════════════
  if (aJacks > 0) {
    if (goldPerBrew > 0) add('gold',   'Apothecary',           aJacks * goldPerBrew   * bm('apothecary'));
    add('herb',   'Apothecary',           -aJacks * herbCostPerJack);
    add('potion', 'Apothecary',            aJacks * potionPerBrew * bm('apothecary'));
    add('xp',     'Apothecary',            aJacks * bm('apothecary'));
  }
  if (aFam > 0) {
    if (goldPerBrew > 0) add('gold',   'Familiar (Apothecary)', aFam * goldPerBrew   * bm('apothecary'));
    add('herb',   'Familiar (Apothecary)', -aFam * herbCostPerJack);
    add('potion', 'Familiar (Apothecary)',  aFam * potionPerBrew * bm('apothecary'));
    add('xp',     'Familiar (Apothecary)',  aFam * bm('apothecary'));
  }
  if (vatGoldGain   > 0) add('gold',   'Fermentation Vats', vatGoldGain   * bm('apothecary'));
  if (vatPotionGain > 0) add('potion', 'Passive',           vatPotionGain * bm('apothecary'));
  if (vatHerbDrain  > 0) add('herb',   'Passive',           -vatHerbDrain);

  // ══ Culinarian ════════════════════════════════════════════════
  if (cJacks > 0) {
    add('gold',  'Culinarian',           -cJacks * culGoldCost);
    add('spice', 'Culinarian',            cJacks * spicePerClick * culSpiceMult * bm('culinarian'));
    add('xp',    'Culinarian',            cJacks * bm('culinarian'));
  }
  if (cFam > 0) {
    add('gold',  'Familiar (Culinarian)', -cFam * culGoldCost);
    add('spice', 'Familiar (Culinarian)',  cFam * spicePerClick * culSpiceMult * bm('culinarian'));
    add('xp',    'Familiar (Culinarian)',  cFam * bm('culinarian'));
  }

  // ══ Thief ═════════════════════════════════════════════════════
  if (effThiefJacks > 0) {
    add('dossier', 'Thief', effThiefJacks * avgDossierYield * bm('thief'));
    add('xp',      'Thief', effThiefJacks * bm('thief'));
    if (ppLevel > 0)              add('gold',    'Thief', effThiefJacks * avgDossierYield * ppLevel * bm('thief'));
    if (thiefTreasurePerJack > 0) add('treasure','Thief', effThiefJacks * thiefTreasurePerJack * bm('thief'));
  }
  if (effThiefFam > 0) {
    add('dossier', 'Familiar (Thief)', effThiefFam * avgDossierYield * bm('thief'));
    add('xp',      'Familiar (Thief)', effThiefFam * bm('thief'));
    if (ppLevel > 0)              add('gold',    'Familiar (Thief)', effThiefFam * avgDossierYield * ppLevel * bm('thief'));
    if (thiefTreasurePerJack > 0) add('treasure','Familiar (Thief)', effThiefFam * thiefTreasurePerJack * bm('thief'));
  }

  // ══ Artisan ═══════════════════════════════════════════════════
  if (artJacks > 0) {
    add('treasure',       'Artisan', -artJacks * artTreasureCost * artJackCycles);
    add('gemstone',       'Artisan',  artJacks * expectedGemstonePerAppraisalJack(catsPawLevel, hasArtisanRelic) * artJackCycles * bm('artisan'));
    add('precious-metal', 'Artisan',  artJacks * expectedMetalPerAppraisalJack(catsPawLevel, hasArtisanRelic)    * artJackCycles * bm('artisan'));
    add('xp',             'Artisan',  artJacks * artJackCycles * bm('artisan'));
  }
  if (artFam > 0) {
    add('treasure',       'Familiar (Artisan)', -artFam * artTreasureCost * artFamCycles);
    add('gemstone',       'Familiar (Artisan)',  artFam * expectedGemstonePerAppraisalJack(catsPawLevel, hasArtisanRelic) * artFamCycles * bm('artisan'));
    add('precious-metal', 'Familiar (Artisan)',  artFam * expectedMetalPerAppraisalJack(catsPawLevel, hasArtisanRelic)    * artFamCycles * bm('artisan'));
    add('xp',             'Familiar (Artisan)',  artFam * artFamCycles * bm('artisan'));
  }

  // ══ Necromancer ═══════════════════════════════════════════════
  if (defJacks > 0) {
    add('bone', 'Necromancer',          defJacks * avgBoneYield * necRelicYieldMul * bm('necromancer'));
    add('xp',   'Necromancer (Defile)', defJacks * bm('necromancer'));
  }
  if (defFam > 0) {
    add('bone', 'Familiar (Necromancer)', defFam * avgBoneYield * necRelicYieldMul * bm('necromancer'));
    add('xp',   'Familiar (Defile)',       defFam * bm('necromancer'));
  }
  if (wrdJacks > 0) {
    add('brimstone', 'Necromancer',       wrdJacks * avgBrimstoneYield * necRelicYieldMul * bm('necromancer'));
    add('xp',        'Necromancer (Ward)', -wrdJacks * wardXpCost);
  }
  if (wrdFam > 0) {
    add('brimstone', 'Familiar (Necromancer)', wrdFam * avgBrimstoneYield * necRelicYieldMul * bm('necromancer'));
    add('xp',        'Familiar (Ward)',         -wrdFam * wardXpCost);
  }
  if (graveLootChance > 0) {
    const glGold    = YIELDS.GRAVE_LOOTING_GOLD_WEIGHT    * YIELDS.GRAVE_LOOTING_GOLD_AMOUNT    * necRelicYieldMul;
    const glGem     = YIELDS.GRAVE_LOOTING_GEM_WEIGHT     * YIELDS.GRAVE_LOOTING_GEM_AMOUNT     * necRelicYieldMul;
    const glJewelry = YIELDS.GRAVE_LOOTING_JEWELRY_WEIGHT * YIELDS.GRAVE_LOOTING_JEWELRY_AMOUNT * necRelicYieldMul;
    const necBm = bm('necromancer');
    if (defJacks > 0) {
      add('gold',     'Necromancer (Exhume)', defJacks * graveLootChance * glGold    * necBm);
      add('gemstone', 'Necromancer (Exhume)', defJacks * graveLootChance * glGem     * necBm);
      add('jewelry',  'Necromancer (Exhume)', defJacks * graveLootChance * glJewelry * necBm);
    }
    if (defFam > 0) {
      add('gold',     'Familiar (Exhume)', defFam * graveLootChance * glGold    * necBm);
      add('gemstone', 'Familiar (Exhume)', defFam * graveLootChance * glGem     * necBm);
      add('jewelry',  'Familiar (Exhume)', defFam * graveLootChance * glJewelry * necBm);
    }
  }

  // ══ Merchant ══════════════════════════════════════════════════
  if (mJacks > 0) {
    add('illicit-goods', 'Merchant', -mJacks * merchantOpens * bm('merchant'));
    add('xp',            'Merchant',  mJacks * MERCHANT_MG.XP_REWARD * bm('merchant'));
    for (const [id, expected] of Object.entries(illicitLootPerRoll)) {
      add(id, 'Merchant (Crate)', mJacks * expected * mLootScale);
    }
  }
  if (mFam > 0) {
    add('illicit-goods', 'Familiar (Merchant)', -mFam * merchantOpens * bm('merchant'));
    add('xp',            'Familiar (Merchant)',  mFam * MERCHANT_MG.XP_REWARD * bm('merchant'));
    for (const [id, expected] of Object.entries(illicitLootPerRoll)) {
      add(id, 'Familiar (Crate)', mFam * expected * mLootScale);
    }
  }
  if (hasMerchantRelic) {
    const pool = MERCHANT_MG.RELIC_PURCHASE_POOL;
    if (pool.length > 0) {
      const perItemJack = mJacks * MERCHANT_MG.RELIC_FREE_PURCHASE_QTY / pool.length * bm('merchant');
      const perItemFam  = mFam   * MERCHANT_MG.RELIC_FREE_PURCHASE_QTY / pool.length * bm('merchant');
      for (const id of pool) {
        if (perItemJack > 0) add(id, 'Relic (Merchant)', perItemJack);
        if (perItemFam  > 0) add(id, 'Relic (Familiar)', perItemFam);
      }
    }
  }
  for (const ab of ctx.merchantAutoBuyers ?? []) {
    add('gold',        'Auto-Buy (Merchant)', -ab.goldCostPerTick);
    add(ab.currencyId, 'Auto-Buy (Merchant)',  ab.qtyPerTick);
  }

  // ══ Artificer ═════════════════════════════════════════════════
  if (artRefJacks > 0) add('mana', 'Artificer',           artRefJacks * avgManaPerReflect * bm('artificer'));
  if (artRefFam   > 0) add('mana', 'Familiar (Artificer)', artRefFam   * avgManaPerReflect * bm('artificer'));

  // ══ Chimeramancer ═════════════════════════════════════════════
  if (chJacks > 0) {
    add('life-thread', 'Chimeramancer',           chJacks * chThreadPerJack);
    add('xp',          'Chimeramancer',            chJacks * bm('chimeramancer'));
  }
  if (chFam > 0) {
    add('life-thread', 'Familiar (Chimeramancer)', chFam * chThreadPerJack);
    add('xp',          'Familiar (Chimeramancer)', chFam * bm('chimeramancer'));
  }
  if (needlesRate > 0) add('life-thread', 'Passive (Needles)', needlesRate);

  // ══ Slayer ════════════════════════════════════════════════════
  if (ichorPerSec > 0) add('ichor', 'Slayer', ichorPerSec);

  // ── Build rates from exact accumulators ──────────────────────
  const rates: PerSecondRates = {
    gold:                  roundTo(acc['gold']                  ?? 0, 2),
    xp:                    roundTo(acc['xp']                    ?? 0, 2),
    herb:                  roundTo(acc['herb']                  ?? 0, 2),
    beast:                 roundTo(acc['beast']                 ?? 0, 2),
    potion:                roundTo(acc['potion']                ?? 0, 2),
    spice:                 roundTo(acc['spice']                 ?? 0, 2),
    dossier:               roundTo(acc['dossier']               ?? 0, 2),
    treasure:              roundTo(acc['treasure']              ?? 0, 2),
    'precious-metal':      roundTo(acc['precious-metal']        ?? 0, 2),
    gemstone:              roundTo(acc['gemstone']              ?? 0, 2),
    jewelry:               roundTo(acc['jewelry']               ?? 0, 2),
    bone:                  roundTo(acc['bone']                  ?? 0, 2),
    brimstone:             roundTo(acc['brimstone']             ?? 0, 2),
    'illicit-goods':       roundTo(acc['illicit-goods']         ?? 0, 2),
    mana:                  roundTo(acc['mana']                  ?? 0, 2),
    construct:             roundTo(acc['construct']             ?? 0, 2),
    'concentrated-potion': roundTo(acc['concentrated-potion']   ?? 0, 2),
    'pixie-dust':          roundTo(acc['pixie-dust']            ?? 0, 2),
    'hearty-meal':         roundTo(acc['hearty-meal']           ?? 0, 2),
    'soul-stone':          roundTo(acc['soul-stone']            ?? 0, 2),
    'synaptical-potion':   roundTo(acc['synaptical-potion']     ?? 0, 2),
    'kobold-ear':          roundTo(acc['kobold-ear']            ?? 0, 2),
    'kobold-tongue':       roundTo(acc['kobold-tongue']         ?? 0, 2),
    'kobold-hair':         roundTo(acc['kobold-hair']           ?? 0, 2),
    'kobold-fang':         roundTo(acc['kobold-fang']           ?? 0, 2),
    'kobold-brain':        roundTo(acc['kobold-brain']          ?? 0, 2),
    'kobold-feather':      roundTo(acc['kobold-feather']        ?? 0, 2),
    'kobold-pebble':       roundTo(acc['kobold-pebble']         ?? 0, 2),
    'kobold-heart':        roundTo(acc['kobold-heart']          ?? 0, 2),
    'monster-trophy':      roundTo(acc['monster-trophy']        ?? 0, 2),
    'forbidden-tome':      roundTo(acc['forbidden-tome']        ?? 0, 2),
    'magical-implement':   roundTo(acc['magical-implement']     ?? 0, 2),
    'life-thread':         roundTo(acc['life-thread']           ?? 0, 2),
    ichor:                 roundTo(acc['ichor']                 ?? 0, 2),
  };

  return { rates, breakdown: bd };
}

// ── Legacy compatibility wrappers ────────────────────────────

/** @deprecated Call calculatePerSecond(ctx).rates instead. */
export function calculatePerSecondRates(ctx: PerSecondContext): PerSecondRates {
  return calculatePerSecond(ctx).rates;
}

/** @deprecated Call calculatePerSecond(ctx).breakdown instead. */
export function calculatePerSecondBreakdown(ctx: PerSecondContext): PerSecondBreakdown {
  return calculatePerSecond(ctx).breakdown;
}
