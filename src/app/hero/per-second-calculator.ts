/**
 * ════════════════════════════════════════════════════════════
 *   PER-SECOND RATE CALCULATOR
 *   Pure function that computes display rates for all
 *   currencies, factoring in jacks, starvation, and stun.
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

/**
 * Per-currency breakdown by contributing source (character or passive upgrade).
 * Keys are currency IDs, values are maps of source label → rate.
 * Only non-zero contributions are included.
 */
export type PerSecondBreakdown = Record<string, Record<string, number>>;

// ── Public API ──────────────────────────────────────────────

/**
 * Computes the Slayer's ichor-per-second from auto-attack.
 * Factors in Know No Fear, Bloodlust, Condemn stacks, Banishment, socketed beads, and blue bead ichor multiplier.
 * Returns 0 if the slayer is not unlocked or the chimera is dead.
 */
function calcSlayerIchorPerSecond(ctx: PerSecondContext): number {
  if (!ctx.slayerUnlocked || ctx.slayerChimeraDead) return 0;
  const u = ctx.upgrades;

  // Base + Know No Fear
  let dmg = SLAYER.DAMAGE_PER_CLICK + u.level('KNOW_NO_FEAR') * SLAYER.KNOW_NO_FEAR_DAMAGE;

  // Condemn: +level damage per active stack
  const condemnLevel = u.level('CONDEMN');
  const activeStacks = ctx.activeCondemnStacks ?? 0;
  if (condemnLevel > 0 && activeStacks > 0) {
    dmg += condemnLevel * SLAYER.CONDEMN_DAMAGE_PER_LEVEL * activeStacks;
  }

  // Banishment: ×2 when all Condemn stacks are active
  if (u.level('BANISHMENT') > 0 && activeStacks >= SLAYER.CONDEMN_MAX_STACKS) {
    dmg *= SLAYER.BANISHMENT_DAMAGE_MULTIPLIER;
  }

  // Gold bead doublings (double attack damage → double ichor)
  if (ctx.slayerBead1Socketed) dmg *= 2;
  if (ctx.slayerBead2Socketed) dmg *= 2;

  // Blue bead ichor multiplier (separate from attack damage)
  const ichorMult = ctx.beadMultipliers?.['slayer'] ?? 1;

  // Windfury: expected extra attacks per hit
  const windfuryLevel = u.level('WINDFURY');
  let windfuryMult = 1;
  if (windfuryLevel > 0) {
    const p = Math.min(1, windfuryLevel * SLAYER.WINDFURY_CHANCE_PER_LEVEL);
    if (u.level('THUNDERFURY') > 0) {
      if (u.level('SUNFURY') > 0) {
        // Sunfury: each chain attack doubles the previous.
        // 1st chain: 2× base, 2nd chain: 4× base, ..., Nth chain: 2^N × base.
        // Expected damage multiplier = 1 + sum_{i=1}^{MAX_CHAIN} p^i × 2^i
        //                            = 1 + sum_{i=1}^{MAX_CHAIN} (2p)^i
        let extraExpected = 0;
        let p2Pow = 2 * p;
        for (let i = 0; i < SLAYER.THUNDERFURY_MAX_CHAIN; i++) {
          extraExpected += p2Pow;
          p2Pow *= 2 * p;
        }
        windfuryMult = 1 + extraExpected;
      } else {
        // Sum of geometric series: p + p^2 + ... + p^THUNDERFURY_MAX_CHAIN
        let extraExpected = 0;
        let pPow = p;
        for (let i = 0; i < SLAYER.THUNDERFURY_MAX_CHAIN; i++) {
          extraExpected += pPow;
          pPow *= p;
        }
        windfuryMult = 1 + extraExpected;
      }
    } else {
      windfuryMult = 1 + p;
    }
  }

  const intervalMs = Math.max(
    SLAYER.AUTO_ATTACK_MIN_MS,
    SLAYER.AUTO_ATTACK_BASE_MS - u.level('BLOODLUST') * SLAYER.BLOODLUST_REDUCTION_MS,
  );
  return (dmg * ichorMult * windfuryMult) / (intervalMs / 1000);
}

/** Calculate display per-second rates for all currencies. */
export function calculatePerSecondRates(ctx: PerSecondContext): PerSecondRates {
  const u = ctx.upgrades;

  // ── Bead multipliers ─────────────────────────────────────────
  const bm = (charId: string) => ctx.beadMultipliers?.[charId] ?? 1;

  // ── Relic levels ──────────────────────────────────────────
  const rl = ctx.relicLevels;
  const hasFighterRelic    = (rl['fighter']    ?? 0) >= 1;
  const hasRangerRelic     = (rl['ranger']     ?? 0) >= 1;
  const hasApothecaryRelic = (rl['apothecary'] ?? 0) >= 1;
  const hasCulinarianRelic = (rl['culinarian'] ?? 0) >= 1;
  const hasThiefRelic      = (rl['thief']      ?? 0) >= 1;
  const hasArtisanRelic    = (rl['artisan']    ?? 0) >= 1;
  const hasMerchantRelic   = (rl['merchant']   ?? 0) >= 1;
  const hasChimeramancerRelic = (rl['chimeramancer'] ?? 0) >= 1;

  // ── Jack counts (starved / stunned jacks produce nothing) ──
  // Relic doubling: when a character's relic is active, each jack counts as two.
  // Familiar: each active familiar adds JACKS_PER_FAMILIAR to the pre-relic count.
  // Jack'd Up: all effective jack counts are multiplied by JACKD_UP_SPEED_MULT.
  const jackdUpSpeedMult = ctx.jackdUpUnlocked ? JACKD_UP_SPEED_MULT : 1;
  const now = Date.now();
  const mindAndSoul = ctx.upgrades.level('MIND_AND_SOUL');
  const effectiveFamiliars = FAMILIAR.JACKS_PER_FAMILIAR + mindAndSoul * FAMILIAR.MIND_AND_SOUL_PER_LEVEL;
  const fam = (key: string) => (ctx.familiarsPaused || !!ctx.familiarPausedKeys?.[key]) ? 0 : ((ctx.familiarTimers[key] ?? 0) > now ? effectiveFamiliars : 0);

  // ── Chimeramancer relic: each chimera jack also clicks every other hero button ──
  const chimeraJacks    = ((ctx.jacksAllocations['chimeramancer'] ?? 0) + fam('chimeramancer')) * (hasChimeramancerRelic ? 2 : 1) * jackdUpSpeedMult;
  const chimeraRelicExtra = (hasChimeramancerRelic && ctx.chimeramancerRelicEnabled) ? chimeraJacks : 0;

  const fighterJacks    = ((ctx.jacksAllocations['fighter']    ?? 0) + fam('fighter'))    * (hasFighterRelic ? 2 : 1) * jackdUpSpeedMult + chimeraRelicExtra;
  const rangerJacks     = ((ctx.jacksAllocations['ranger']     ?? 0) + fam('ranger'))     * (hasRangerRelic ? 2 : 1) * jackdUpSpeedMult + chimeraRelicExtra;
  const apothecaryJacks = ctx.jackStarved['apothecary'] ? 0 : (((ctx.jacksAllocations['apothecary'] ?? 0) + fam('apothecary')) * (hasApothecaryRelic ? 2 : 1) * jackdUpSpeedMult + chimeraRelicExtra);
  const culinarianJacks = ctx.jackStarved['culinarian'] ? 0 : (((ctx.jacksAllocations['culinarian'] ?? 0) + fam('culinarian')) * (hasCulinarianRelic ? 2 : 1) * jackdUpSpeedMult + chimeraRelicExtra);
  const thiefJacks      = ((ctx.jacksAllocations['thief'] ?? 0) + fam('thief'))           * (hasThiefRelic ? 2 : 1) * jackdUpSpeedMult + chimeraRelicExtra;
  const artisanJacks    = ctx.jackStarved['artisan'] ? 0 : (((ctx.jacksAllocations['artisan'] ?? 0) + fam('artisan')) * (hasArtisanRelic ? 2 : 1) * jackdUpSpeedMult + chimeraRelicExtra);
  const merchantJacks   = ctx.jackStarved['merchant'] ? 0 : (((ctx.jacksAllocations['merchant'] ?? 0) + fam('merchant')) * jackdUpSpeedMult + chimeraRelicExtra);

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
  // Instead of zeroing out while stunned (which causes flashing in the display),
  // compute the long-run average uptime fraction that factors in expected stun downtime.
  // Stun is global: any jack failure triggers a full stun for all thief jacks.
  const thiefSuccessRate  = calcThiefSuccessChance(u.level('METICULOUS_PLANNING')) / 100;
  const stunSec           = YIELDS.THIEF_STUN_DURATION_MS / 1000;
  // P(at least one fail per second among all thief jacks) = 1 - successRate^N
  const allSuccessPerSec  = thiefJacks > 0 ? Math.pow(thiefSuccessRate, thiefJacks) : 1;
  const stunTriggerRate   = 1 - allSuccessPerSec;
  const uptimeFraction    = thiefJacks > 0 ? 1 / (1 + stunTriggerRate * stunSec) : 1;
  const effectiveThiefRate = thiefJacks * thiefSuccessRate * uptimeFraction;
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
  const catsEyeFactor  = 0.5 * (1 + (catsEyeLevel * 5) / 100);

  // ── Ranger relic: +1 herb base (before doubling), +1 beast per hunt ──
  const rangerHerbBonus  = hasRangerRelic ? rangerJacks : 0;
  const rangerBeastBonus = hasRangerRelic ? 1 : 0;

  // ── Herb rates ────────────────────────────────────────────
  const vatLevel       = ctx.fermentationVatsEnabled ? u.level('FERMENTATION_VATS') : 0;
  const vatHerbDrain   = vatLevel * 0.1;
  const vatPotionGain  = vatLevel * 0.1;
  const vatGoldGain    = vatPotionGain * goldPerBrew;
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
  const rawDefileJacks = ((ctx.jacksAllocations['necromancer-defile'] ?? 0) + fam('necromancer-defile')) * jackdUpSpeedMult + chimeraRelicExtra;
  const rawWardJacks   = ctx.jackStarved['necromancer-ward'] ? 0 : (((ctx.jacksAllocations['necromancer-ward'] ?? 0) + fam('necromancer-ward')) * jackdUpSpeedMult + chimeraRelicExtra);
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

  // ── Merchant rates ─────────────────────────────────────────
  // Merchant jacks now consume illicit goods to open crates.
  // They consume opensPerClick goods per tick and produce loot-table rewards.
  const merchantOpensPerClick = calcMerchantOpensPerClick(u.level('BOXING_DAY'));
  const merchantGoodsDrain = merchantJacks * merchantOpensPerClick;

  // Expected loot per open (BASE_ROLLS rolls per open)
  const illicitLootPerRoll = calcExpectedIllicitLootPerRoll(u.level('BLACK_MARKET_CONNECTIONS'));
  // Total expected loot per jack per second = opensPerClick * BASE_ROLLS * expectedPerRoll
  const illicitLootScale = merchantJacks * merchantOpensPerClick * MERCHANT_MG.BASE_ROLLS * bm('merchant');
  const illicitLoot = (id: string) => (illicitLootPerRoll[id] ?? 0) * illicitLootScale;

  // ── Artificer rates ─────────────────────────────────────────
  const hasArtificerRelic = (rl['artificer'] ?? 0) >= 1;
  const rawStudyJacks   = ((ctx.jacksAllocations['artificer-study']   ?? 0) + fam('artificer-study'))   * jackdUpSpeedMult + chimeraRelicExtra;
  const rawReflectJacks = ((ctx.jacksAllocations['artificer-reflect'] ?? 0) + fam('artificer-reflect')) * jackdUpSpeedMult + chimeraRelicExtra;
  const studyJacks   = rawStudyJacks;
  const reflectJacks = rawReflectJacks;
  // Reflect mana estimate: uses current insight as proxy for average output
  const amplifiedLevel = ctx.upgrades.level('AMPLIFIED_INSIGHT');
  const arcaneIntellectLevel = ctx.upgrades.level('POTION_ARCANE_INTELLECT');
  const maxInsight = YIELDS.ARTIFICER_MAX_INSIGHT + arcaneIntellectLevel * YIELDS.ARTIFICER_ARCANE_INTELLECT_PER_LEVEL;
  const effInsight     = Math.min(32, maxInsight + amplifiedLevel * YIELDS.ARTIFICER_AMPLIFIED_INSIGHT_PER_LEVEL);
  const avgManaPerReflect = effInsight > 0 ? effInsight * effInsight * (hasArtificerRelic ? 2 : 1) : 0;
  const artificerManaPerSec = reflectJacks * avgManaPerReflect;

  // ── Merchant auto-buyers ───────────────────────────────────
  // Each active auto-buyer drains gold and produces its target resource every tick.
  const autoBuyers = ctx.merchantAutoBuyers ?? [];
  let autoBuyGoldDrain = 0;
  const autoBuyGains: Record<string, number> = {};
  for (const ab of autoBuyers) {
    autoBuyGoldDrain += ab.goldCostPerTick;
    autoBuyGains[ab.currencyId] = (autoBuyGains[ab.currencyId] ?? 0) + ab.qtyPerTick;
  }


  // Merchant relic: each jack also awards RELIC_FREE_PURCHASE_QTY of a random resource
  // from the relic purchase pool, with equal weight across all items.
  const merchantRelicGains: Record<string, number> = {};
  if (hasMerchantRelic && merchantJacks > 0) {
    const pool = MERCHANT_MG.RELIC_PURCHASE_POOL;
    if (pool.length > 0) {
      const perItem = merchantJacks * MERCHANT_MG.RELIC_FREE_PURCHASE_QTY / pool.length * bm('merchant');
      for (const currencyId of pool) {
        merchantRelicGains[currencyId] = (merchantRelicGains[currencyId] ?? 0) + perItem;
      }
    }
  }
  const mrg = (key: string) => merchantRelicGains[key] ?? 0;

  return {
    gold:    roundTo((autoGoldPerSec + fighterRelicGold + fighterJacks * goldPerClick) * bm('fighter') + (apothecaryJacks * goldPerBrew + vatGoldGain) * bm('apothecary') - culinarianJacks * culGoldCost + ppGoldPerSecond * bm('thief') + graveLootGoldPerSec * bm('necromancer') - autoBuyGoldDrain + illicitLoot('gold'), 2),
    xp:      roundTo(fighterJacks * xpPerBounty * bm('fighter') + rangerJacks * bm('ranger') + apothecaryJacks * bm('apothecary') + culinarianJacks * bm('culinarian') + effectiveThiefRate * bm('thief') + artisanXpPerSec * bm('artisan') + necroXpGain * bm('necromancer') - wardXpDrain + merchantJacks * MERCHANT_MG.XP_REWARD * bm('merchant') + illicitLoot('xp') + chimeraJacks * bm('chimeramancer'), 2),
    herb:    roundTo(herbProduced * bm('ranger') - herbConsumed + (autoBuyGains['herb'] ?? 0) + mrg('herb') + illicitLoot('herb'), 2),
    beast:   roundTo((rangerJacks * catsEyeFactor * (beastChance / 100) * (expectedMeatYield + rangerBeastBonus) + baitedTrapsRate) * bm('ranger') + (autoBuyGains['beast'] ?? 0) + mrg('beast') + illicitLoot('beast'), 2),
    potion:  roundTo((apothecaryJacks * potionPerBrew + vatPotionGain) * bm('apothecary') + (autoBuyGains['potion'] ?? 0) + mrg('potion') + illicitLoot('potion'), 2),
    spice:   roundTo(culinarianJacks * spicePerClick * culSpiceMultiplier * bm('culinarian') + (autoBuyGains['spice'] ?? 0) + mrg('spice') + illicitLoot('spice'), 2),
    dossier: roundTo(effectiveThiefRate * avgDossierYield * bm('thief') + (autoBuyGains['dossier'] ?? 0) + mrg('dossier') + illicitLoot('dossier'), 2),
    treasure:         roundTo(thiefTreasurePerSec * bm('thief') - artisanTreasurePerSec + (autoBuyGains['treasure'] ?? 0) + mrg('treasure') + illicitLoot('treasure'), 2),
    'precious-metal': roundTo(artisanMetalPerSec * bm('artisan') + (autoBuyGains['precious-metal'] ?? 0) + mrg('precious-metal') + illicitLoot('precious-metal'), 2),
    gemstone:         roundTo(artisanGemstonePerSec * bm('artisan') + graveLootGemPerSec * bm('necromancer') + (autoBuyGains['gemstone'] ?? 0) + mrg('gemstone') + illicitLoot('gemstone'), 2),
    jewelry:          roundTo(graveLootJewelryPerSec * bm('necromancer') + (autoBuyGains['jewelry'] ?? 0) + mrg('jewelry') + illicitLoot('jewelry'), 2),
    bone:             roundTo(bonePerSec * bm('necromancer') + (autoBuyGains['bone'] ?? 0) + mrg('bone') + illicitLoot('bone'), 2),
    brimstone:        roundTo(brimstonePerSec * bm('necromancer') + (autoBuyGains['brimstone'] ?? 0) + mrg('brimstone') + illicitLoot('brimstone'), 2),
    'illicit-goods':  roundTo(-merchantGoodsDrain * bm('merchant') + (autoBuyGains['illicit-goods'] ?? 0) + mrg('illicit-goods'), 2),
    mana:             roundTo(artificerManaPerSec * bm('artificer') + (autoBuyGains['mana'] ?? 0) + mrg('mana'), 2),
    construct:        roundTo((autoBuyGains['construct'] ?? 0) + mrg('construct'), 2),
    'concentrated-potion': roundTo((autoBuyGains['concentrated-potion'] ?? 0) + mrg('concentrated-potion') + illicitLoot('concentrated-potion'), 2),
    'pixie-dust':     roundTo((autoBuyGains['pixie-dust'] ?? 0) + mrg('pixie-dust') + illicitLoot('pixie-dust'), 2),
    'hearty-meal':    roundTo((autoBuyGains['hearty-meal'] ?? 0) + mrg('hearty-meal') + illicitLoot('hearty-meal'), 2),
    'soul-stone':     roundTo((autoBuyGains['soul-stone'] ?? 0) + mrg('soul-stone') + illicitLoot('soul-stone'), 2),
    'synaptical-potion': roundTo(mrg('synaptical-potion') + illicitLoot('synaptical-potion'), 2),
    // ── Kobold parts ─────────────────────────────────────────────
    'kobold-ear':     roundTo((autoBuyGains['kobold-ear'] ?? 0) + mrg('kobold-ear') + illicitLoot('kobold-ear'), 2),
    'kobold-tongue':  roundTo((autoBuyGains['kobold-tongue'] ?? 0) + mrg('kobold-tongue') + illicitLoot('kobold-tongue'), 2),
    'kobold-hair':    roundTo((autoBuyGains['kobold-hair'] ?? 0) + mrg('kobold-hair') + illicitLoot('kobold-hair'), 2),
    'kobold-fang':    roundTo((autoBuyGains['kobold-fang'] ?? 0) + mrg('kobold-fang') + illicitLoot('kobold-fang'), 2),
    'kobold-brain':   roundTo((autoBuyGains['kobold-brain'] ?? 0) + mrg('kobold-brain') + illicitLoot('kobold-brain'), 2),
    'kobold-feather': roundTo((autoBuyGains['kobold-feather'] ?? 0) + mrg('kobold-feather') + illicitLoot('kobold-feather'), 2),
    'kobold-pebble':  roundTo((autoBuyGains['kobold-pebble'] ?? 0) + mrg('kobold-pebble') + illicitLoot('kobold-pebble'), 2),
    'kobold-heart':   roundTo((autoBuyGains['kobold-heart'] ?? 0) + mrg('kobold-heart') + illicitLoot('kobold-heart'), 2),
    'monster-trophy': roundTo(illicitLoot('monster-trophy'), 2),
    'forbidden-tome': roundTo(illicitLoot('forbidden-tome'), 2),
    'magical-implement': roundTo(illicitLoot('magical-implement'), 2),
    'life-thread':    roundTo(chimeraJacks * calcChimeramancerThreadPerClick(CHIMERAMANCER_YIELDS.THREAD_PER_CLICK, u.level('BIGGER_THREADS')) * bm('chimeramancer') + calcSharperNeedlesThreadPerSec(u.level('SHARPER_NEEDLES'), u.level('LOOM_OF_LIFE')) * bm('chimeramancer'), 2),
    ichor:            roundTo(calcSlayerIchorPerSecond(ctx), 2),
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
  const hasMerchantRelic   = (rl['merchant']   ?? 0) >= 1;
  const hasChimeramancerRelic2 = (rl['chimeramancer'] ?? 0) >= 1;

  // ── Jack counts: split into regular jacks vs familiar jacks ──
  // Both are subject to starvation / stun checks and relic doubling.
  // Jack'd Up: all effective jack counts are multiplied by JACKD_UP_SPEED_MULT.
  const jackdUpSpeedMult2 = ctx.jackdUpUnlocked ? JACKD_UP_SPEED_MULT : 1;
  const now2 = Date.now();
  const mindAndSoul2 = ctx.upgrades.level('MIND_AND_SOUL');
  const effectiveFamiliars2 = FAMILIAR.JACKS_PER_FAMILIAR + mindAndSoul2 * FAMILIAR.MIND_AND_SOUL_PER_LEVEL;
  const famRaw = (key: string) => (ctx.familiarsPaused || !!ctx.familiarPausedKeys?.[key]) ? 0 : ((ctx.familiarTimers[key] ?? 0) > now2 ? effectiveFamiliars2 : 0);

  const relicMul = (hasRelic: boolean) => hasRelic ? 2 : 1;

  // Chimeramancer relic: extra clicks per second to every other character
  const chimeraRelicExtraJack = (hasChimeramancerRelic2 && ctx.chimeramancerRelicEnabled)
    ? (ctx.jacksAllocations['chimeramancer'] ?? 0) * relicMul(hasChimeramancerRelic2) * jackdUpSpeedMult2
    : 0;
  const chimeraRelicExtraFam = (hasChimeramancerRelic2 && ctx.chimeramancerRelicEnabled)
    ? famRaw('chimeramancer') * relicMul(hasChimeramancerRelic2) * jackdUpSpeedMult2
    : 0;

  // Regular jacks (allocated from pool)
  const fJacks   = (ctx.jacksAllocations['fighter']    ?? 0) * relicMul(hasFighterRelic)    * jackdUpSpeedMult2 + chimeraRelicExtraJack;
  const rJacks   = (ctx.jacksAllocations['ranger']     ?? 0) * relicMul(hasRangerRelic)     * jackdUpSpeedMult2 + chimeraRelicExtraJack;
  const aJacks   = ctx.jackStarved['apothecary'] ? 0 : ((ctx.jacksAllocations['apothecary'] ?? 0) * relicMul(hasApothecaryRelic) * jackdUpSpeedMult2 + chimeraRelicExtraJack);
  const cJacks   = ctx.jackStarved['culinarian'] ? 0 : ((ctx.jacksAllocations['culinarian'] ?? 0) * relicMul(hasCulinarianRelic) * jackdUpSpeedMult2 + chimeraRelicExtraJack);
  const tJacks   = (ctx.jacksAllocations['thief']      ?? 0) * relicMul(hasThiefRelic)      * jackdUpSpeedMult2 + chimeraRelicExtraJack;
  const artJacks = ctx.jackStarved['artisan'] ? 0 : ((ctx.jacksAllocations['artisan'] ?? 0) * relicMul(hasArtisanRelic) * jackdUpSpeedMult2 + chimeraRelicExtraJack);
  const mJacks   = ctx.jackStarved['merchant'] ? 0 : ((ctx.jacksAllocations['merchant']  ?? 0) * jackdUpSpeedMult2 + chimeraRelicExtraJack);
  const chJacks  = (ctx.jacksAllocations['chimeramancer'] ?? 0) * relicMul(hasChimeramancerRelic2) * jackdUpSpeedMult2;

  // Familiar jacks (separate line in breakdown)
  const fFam   = famRaw('fighter')    * relicMul(hasFighterRelic)    * jackdUpSpeedMult2 + chimeraRelicExtraFam;
  const rFam   = famRaw('ranger')     * relicMul(hasRangerRelic)     * jackdUpSpeedMult2 + chimeraRelicExtraFam;
  const aFam   = ctx.jackStarved['apothecary'] ? 0 : (famRaw('apothecary') * relicMul(hasApothecaryRelic) * jackdUpSpeedMult2 + chimeraRelicExtraFam);
  const cFam   = ctx.jackStarved['culinarian'] ? 0 : (famRaw('culinarian') * relicMul(hasCulinarianRelic) * jackdUpSpeedMult2 + chimeraRelicExtraFam);
  const tFam   = famRaw('thief')      * relicMul(hasThiefRelic)      * jackdUpSpeedMult2 + chimeraRelicExtraFam;
  const artFam = ctx.jackStarved['artisan'] ? 0 : (famRaw('artisan') * relicMul(hasArtisanRelic) * jackdUpSpeedMult2 + chimeraRelicExtraFam);
  const mFam   = ctx.jackStarved['merchant'] ? 0 : (famRaw('merchant') * jackdUpSpeedMult2 + chimeraRelicExtraFam);
  const chFam  = famRaw('chimeramancer') * relicMul(hasChimeramancerRelic2) * jackdUpSpeedMult2;

  // Combined totals (needed for thief uptime fraction)
  const thiefJacks      = tJacks   + tFam;

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
  // Use the same uptime-fraction approach as calculatePerSecondRates to avoid flashing.
  const thiefSuccessRate   = calcThiefSuccessChance(u.level('METICULOUS_PLANNING')) / 100;
  const stunSec2           = YIELDS.THIEF_STUN_DURATION_MS / 1000;
  const allSuccessPerSec2  = thiefJacks > 0 ? Math.pow(thiefSuccessRate, thiefJacks) : 1;
  const stunTriggerRate2   = 1 - allSuccessPerSec2;
  const uptimeFraction2    = thiefJacks > 0 ? 1 / (1 + stunTriggerRate2 * stunSec2) : 1;
  const effectiveThiefRate = tJacks * thiefSuccessRate * uptimeFraction2;
  const effectiveThiefFam  = tFam   * thiefSuccessRate * uptimeFraction2;
  const sfLevel2           = u.level('POTION_OF_STICKY_FINGERS');
  const avgDossierYield    = hasThiefRelic
    ? (2 + 2 * (1 + sfLevel2)) / 2
    : calcExpectedDossierYield(sfLevel2);
  const ppLevel            = u.level('PLENTIFUL_PLUNDERING');
  const thiefTreasurePerJack = hasThiefRelic ? 2 : 0;

  // ── Cat's Eye factor ──────────────────────────────────────
  const catsEyeLevel2  = u.level('POTION_CATS_EYE');
  const catsEyeFactor2 = 0.5 * (1 + (catsEyeLevel2 * 5) / 100);

  // ── Ranger relic ──────────────────────────────────────────
  const rangerBeastBonus       = hasRangerRelic ? 1 : 0;

  // ── Herb rates ────────────────────────────────────────────
  const vatLevel2     = ctx.fermentationVatsEnabled ? u.level('FERMENTATION_VATS') : 0;
  const vatHerbDrain  = vatLevel2 * 0.1;
  const vatPotionGain = vatLevel2 * 0.1;
  const vatGoldGain2  = vatPotionGain * goldPerBrew;
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

  // ── Bead multipliers (must match calculatePerSecondRates) ──
  const bm = (charId: string) => ctx.beadMultipliers?.[charId] ?? 1;

  // ── Build breakdown ───────────────────────────────────────
  const bd: PerSecondBreakdown = {};

  function add(currency: string, source: string, value: number): void {
    const v = roundTo(value, 2);
    if (v === 0) return;
    if (!bd[currency]) bd[currency] = {};
    bd[currency][source] = (bd[currency][source] ?? 0) + v;
  }

  // ── Gold ──────────────────────────────────────────────────
  // Rates: (autoGoldPerSec + fighterRelicGold + fighterJacks*goldPerClick) * bm('fighter')
  //      + (apothecaryJacks*goldPerBrew + vatGoldGain) * bm('apothecary')
  //      - culinarianJacks*culGoldCost   (no bead on cost)
  //      + ppGoldPerSecond * bm('thief')
  //      + graveLootGoldPerSec * bm('necromancer')
  if (autoGoldPerSec > 0) add('gold', 'Passive', autoGoldPerSec * bm('fighter'));
  if (fJacks > 0) add('gold', 'Fighter', (fJacks * goldPerClick + (hasFighterRelic ? fJacks * autoGoldPerSec : 0)) * bm('fighter'));
  if (fFam   > 0) add('gold', 'Familiar (Fighter)', (fFam * goldPerClick + (hasFighterRelic ? fFam * autoGoldPerSec : 0)) * bm('fighter'));
  if (aJacks > 0 && goldPerBrew > 0) add('gold', 'Apothecary', aJacks * goldPerBrew * bm('apothecary'));
  if (aFam   > 0 && goldPerBrew > 0) add('gold', 'Familiar (Apothecary)', aFam * goldPerBrew * bm('apothecary'));
  if (cJacks > 0) add('gold', 'Culinarian', -cJacks * culGoldCost);
  if (cFam   > 0) add('gold', 'Familiar (Culinarian)', -cFam * culGoldCost);
  if (effectiveThiefRate > 0 && ppLevel > 0) add('gold', 'Thief', effectiveThiefRate * avgDossierYield * ppLevel * bm('thief'));
  if (effectiveThiefFam  > 0 && ppLevel > 0) add('gold', 'Familiar (Thief)', effectiveThiefFam * avgDossierYield * ppLevel * bm('thief'));
  if (vatGoldGain2 > 0) add('gold', 'Fermentation Vats', vatGoldGain2 * bm('apothecary'));

  // ── XP ────────────────────────────────────────────────────
  if (fJacks > 0) add('xp', 'Fighter', fJacks * xpPerBounty * bm('fighter'));
  if (fFam   > 0) add('xp', 'Familiar (Fighter)', fFam * xpPerBounty * bm('fighter'));
  if (rJacks > 0) add('xp', 'Ranger', rJacks * bm('ranger'));
  if (rFam   > 0) add('xp', 'Familiar (Ranger)', rFam * bm('ranger'));
  if (aJacks > 0) add('xp', 'Apothecary', aJacks * bm('apothecary'));
  if (aFam   > 0) add('xp', 'Familiar (Apothecary)', aFam * bm('apothecary'));
  if (cJacks > 0) add('xp', 'Culinarian', cJacks * bm('culinarian'));
  if (cFam   > 0) add('xp', 'Familiar (Culinarian)', cFam * bm('culinarian'));
  if (effectiveThiefRate > 0) add('xp', 'Thief', effectiveThiefRate * bm('thief'));
  if (effectiveThiefFam  > 0) add('xp', 'Familiar (Thief)', effectiveThiefFam * bm('thief'));

  // ── Herb ──────────────────────────────────────────────────
  // Rates: herbProduced * bm('ranger') - herbConsumed  (no bead on consumption)
  const rJackHerb = (rJacks * herbPerRanger + (hasRangerRelic ? rJacks : 0) * catsEyeFactor2) * bm('ranger');
  const rFamHerb  = (rFam   * herbPerRanger + (hasRangerRelic ? rFam   : 0) * catsEyeFactor2) * bm('ranger');
  if (rJackHerb !== 0) add('herb', 'Ranger', rJackHerb);
  if (rFamHerb  !== 0) add('herb', 'Familiar (Ranger)', rFamHerb);
  if (hovelGardenRate2 !== 0) add('herb', 'Passive', hovelGardenRate2 * bm('ranger'));
  if (aJacks > 0) add('herb', 'Apothecary', -aJacks * herbCostPerJack);
  if (aFam   > 0) add('herb', 'Familiar (Apothecary)', -aFam * herbCostPerJack);
  if (vatHerbDrain > 0) add('herb', 'Passive', -vatHerbDrain);

  // ── Beast ─────────────────────────────────────────────────
  // Rates: (rangerJacks*beastPerRanger + baitedTrapsRate) * bm('ranger')
  const rJackBeast = rJacks * beastPerRanger * bm('ranger');
  const rFamBeast  = rFam   * beastPerRanger * bm('ranger');
  if (rJackBeast !== 0) add('beast', 'Ranger', rJackBeast);
  if (rFamBeast  !== 0) add('beast', 'Familiar (Ranger)', rFamBeast);
  if (baitedTrapsRate !== 0) add('beast', 'Passive', baitedTrapsRate * bm('ranger'));

  // ── Potion ────────────────────────────────────────────────
  // Rates: (apothecaryJacks*potionPerBrew + vatPotionGain) * bm('apothecary')
  if (aJacks > 0) add('potion', 'Apothecary', aJacks * potionPerBrew * bm('apothecary'));
  if (aFam   > 0) add('potion', 'Familiar (Apothecary)', aFam * potionPerBrew * bm('apothecary'));
  if (vatPotionGain > 0) add('potion', 'Passive', vatPotionGain * bm('apothecary'));

  // ── Spice ─────────────────────────────────────────────────
  if (cJacks > 0) add('spice', 'Culinarian', cJacks * spicePerClick * culSpiceMultiplier * bm('culinarian'));
  if (cFam   > 0) add('spice', 'Familiar (Culinarian)', cFam * spicePerClick * culSpiceMultiplier * bm('culinarian'));

  // ── Dossier ───────────────────────────────────────────────
  if (effectiveThiefRate > 0) add('dossier', 'Thief', effectiveThiefRate * avgDossierYield * bm('thief'));
  if (effectiveThiefFam  > 0) add('dossier', 'Familiar (Thief)', effectiveThiefFam * avgDossierYield * bm('thief'));

  // ── Treasure ──────────────────────────────────────────────
  // Rates: thiefTreasurePerSec * bm('thief') - artisanTreasurePerSec  (no bead on artisan cost)
  if (effectiveThiefRate > 0 && thiefTreasurePerJack > 0) add('treasure', 'Thief', effectiveThiefRate * thiefTreasurePerJack * bm('thief'));
  if (effectiveThiefFam  > 0 && thiefTreasurePerJack > 0) add('treasure', 'Familiar (Thief)', effectiveThiefFam * thiefTreasurePerJack * bm('thief'));

  // ── Artisan ───────────────────────────────────────────────
  const artTimerSec      = calcArtisanTimerMs(u.level('FASTER_APPRAISING')) / 1000;
  const artTreasureCost  = calcArtisanTreasureCost();
  const artJackCycles    = artJacks > 0 ? 1 / artTimerSec : 0;
  const artFamCycles     = artFam   > 0 ? 1 / artTimerSec : 0;

  if (artJacks > 0) {
    add('treasure',       'Artisan', -artJacks * artTreasureCost * artJackCycles);
    add('gemstone',       'Artisan', artJacks * expectedGemstonePerAppraisalJack(u.level('POTION_CATS_PAW'), hasArtisanRelic) * artJackCycles * bm('artisan'));
    add('precious-metal', 'Artisan', artJacks * expectedMetalPerAppraisalJack(u.level('POTION_CATS_PAW'), hasArtisanRelic) * artJackCycles * bm('artisan'));
    add('xp',             'Artisan', artJacks * artJackCycles * bm('artisan'));
  }
  if (artFam > 0) {
    add('treasure',       'Familiar (Artisan)', -artFam * artTreasureCost * artFamCycles);
    add('gemstone',       'Familiar (Artisan)', artFam * expectedGemstonePerAppraisalJack(u.level('POTION_CATS_PAW'), hasArtisanRelic) * artFamCycles * bm('artisan'));
    add('precious-metal', 'Familiar (Artisan)', artFam * expectedMetalPerAppraisalJack(u.level('POTION_CATS_PAW'), hasArtisanRelic) * artFamCycles * bm('artisan'));
    add('xp',             'Familiar (Artisan)', artFam * artFamCycles * bm('artisan'));
  }

  // ── Necromancer ───────────────────────────────────────────
  const hasNecromancerRelic2 = (rl['necromancer'] ?? 0) >= 1;
  const necRelicYieldMul = hasNecromancerRelic2 ? 2 : 1;

  // Raw jack counts (before active-button gating)
  const rawDefJacks = (ctx.jacksAllocations['necromancer-defile'] ?? 0) * jackdUpSpeedMult2 + chimeraRelicExtraJack;
  const rawDefFam   = famRaw('necromancer-defile') * jackdUpSpeedMult2 + chimeraRelicExtraFam;
  const rawWrdJacks = ctx.jackStarved['necromancer-ward'] ? 0 : ((ctx.jacksAllocations['necromancer-ward'] ?? 0) * jackdUpSpeedMult2 + chimeraRelicExtraJack);
  const rawWrdFam   = ctx.jackStarved['necromancer-ward'] ? 0 : (famRaw('necromancer-ward') * jackdUpSpeedMult2 + chimeraRelicExtraFam);

  // Active-button gating (relic: always active)
  const defJacks = hasNecromancerRelic2 ? rawDefJacks : (ctx.necromancerActiveButton === 'defile' ? rawDefJacks : 0);
  const defFam   = hasNecromancerRelic2 ? rawDefFam   : (ctx.necromancerActiveButton === 'defile' ? rawDefFam   : 0);
  const wrdJacks = hasNecromancerRelic2 ? rawWrdJacks : (ctx.necromancerActiveButton === 'ward'   ? rawWrdJacks : 0);
  const wrdFam   = hasNecromancerRelic2 ? rawWrdFam   : (ctx.necromancerActiveButton === 'ward'   ? rawWrdFam   : 0);

  const boneMax2          = calcNecromancerBoneYield(u.level('SPEAK_WITH_DEAD'));
  const avgBoneYield2     = (1 + boneMax2) / 2;
  const brimstoneMax2     = calcNecromancerBrimstoneYield(u.level('FORTIFIED_CHALK'));
  const avgBrimstoneYield2 = (1 + brimstoneMax2) / 2;

  if (defJacks > 0) add('bone', 'Necromancer', defJacks * avgBoneYield2 * necRelicYieldMul * bm('necromancer'));
  if (defFam   > 0) add('bone', 'Familiar (Necromancer)', defFam * avgBoneYield2 * necRelicYieldMul * bm('necromancer'));
  if (wrdJacks > 0) add('brimstone', 'Necromancer', wrdJacks * avgBrimstoneYield2 * necRelicYieldMul * bm('necromancer'));
  if (wrdFam   > 0) add('brimstone', 'Familiar (Necromancer)', wrdFam * avgBrimstoneYield2 * necRelicYieldMul * bm('necromancer'));

  // XP from Defile (production — beaded) / Ward (cost — not beaded)
  if (defJacks > 0) add('xp', 'Necromancer (Defile)', defJacks * bm('necromancer'));
  if (defFam   > 0) add('xp', 'Familiar (Defile)',    defFam   * bm('necromancer'));
  const wardXpCost = calcNecromancerWardXpCost(u.level('DARK_PACT'));
  if (wrdJacks > 0) add('xp', 'Necromancer (Ward)', -wrdJacks * wardXpCost);
  if (wrdFam   > 0) add('xp', 'Familiar (Ward)',    -wrdFam   * wardXpCost);

  // Grave Looting bonus loot
  const graveLootChance2 = calcGraveLootingChance(u.level('GRAVE_LOOTING')) / 100;
  if (graveLootChance2 > 0) {
    const glGold    = YIELDS.GRAVE_LOOTING_GOLD_WEIGHT    * YIELDS.GRAVE_LOOTING_GOLD_AMOUNT    * necRelicYieldMul;
    const glGem     = YIELDS.GRAVE_LOOTING_GEM_WEIGHT     * YIELDS.GRAVE_LOOTING_GEM_AMOUNT     * necRelicYieldMul;
    const glJewelry = YIELDS.GRAVE_LOOTING_JEWELRY_WEIGHT * YIELDS.GRAVE_LOOTING_JEWELRY_AMOUNT * necRelicYieldMul;
    if (defJacks > 0) {
      add('gold',    'Necromancer (Exhume)', defJacks * graveLootChance2 * glGold * bm('necromancer'));
      add('gemstone','Necromancer (Exhume)', defJacks * graveLootChance2 * glGem * bm('necromancer'));
      add('jewelry', 'Necromancer (Exhume)', defJacks * graveLootChance2 * glJewelry * bm('necromancer'));
    }
    if (defFam > 0) {
      add('gold',    'Familiar (Exhume)', defFam * graveLootChance2 * glGold * bm('necromancer'));
      add('gemstone','Familiar (Exhume)', defFam * graveLootChance2 * glGem * bm('necromancer'));
      add('jewelry', 'Familiar (Exhume)', defFam * graveLootChance2 * glJewelry * bm('necromancer'));
    }
  }

  // ── Merchant ────────────────────────────────────────────────
  // Merchant jacks consume illicit goods to open crates.
  const merchantOpens         = calcMerchantOpensPerClick(u.level('BOXING_DAY'));
  const mGoodsDrainPerJack    = merchantOpens;
  if (mJacks > 0) add('illicit-goods', 'Merchant', -mJacks * mGoodsDrainPerJack * bm('merchant'));
  if (mFam   > 0) add('illicit-goods', 'Familiar (Merchant)', -mFam * mGoodsDrainPerJack * bm('merchant'));
  if (mJacks > 0) add('xp', 'Merchant', mJacks * MERCHANT_MG.XP_REWARD * bm('merchant'));
  if (mFam   > 0) add('xp', 'Familiar (Merchant)', mFam * MERCHANT_MG.XP_REWARD * bm('merchant'));

  // Expected loot from opening illicit goods
  const illicitLoot2 = calcExpectedIllicitLootPerRoll(u.level('BLACK_MARKET_CONNECTIONS'));
  const mLootScaleJack = merchantOpens * MERCHANT_MG.BASE_ROLLS * bm('merchant');
  for (const [currId, expected] of Object.entries(illicitLoot2)) {
    if (mJacks > 0) add(currId, 'Merchant (Crate)', mJacks * expected * mLootScaleJack);
    if (mFam   > 0) add(currId, 'Familiar (Crate)', mFam   * expected * mLootScaleJack);
  }

  // Merchant relic: each jack awards RELIC_FREE_PURCHASE_QTY of a random resource from pool
  if (hasMerchantRelic) {
    const pool = MERCHANT_MG.RELIC_PURCHASE_POOL;
    if (pool.length > 0) {
      const perItemJack = mJacks * MERCHANT_MG.RELIC_FREE_PURCHASE_QTY / pool.length * bm('merchant');
      const perItemFam  = mFam   * MERCHANT_MG.RELIC_FREE_PURCHASE_QTY / pool.length * bm('merchant');
      for (const currencyId of pool) {
        if (perItemJack > 0) add(currencyId, 'Relic (Merchant)', perItemJack);
        if (perItemFam  > 0) add(currencyId, 'Relic (Familiar)', perItemFam);
      }
    }
  }

  // ── Merchant auto-buyers ─────────────────────────────────────
  const autoBuyers2 = ctx.merchantAutoBuyers ?? [];
  for (const ab of autoBuyers2) {
    add('gold', 'Auto-Buy (Merchant)', -ab.goldCostPerTick);
    add(ab.currencyId, 'Auto-Buy (Merchant)', ab.qtyPerTick);
  }

  // ── Artificer ──────────────────────────────────────────────
  const hasArtificerRelic2 = (rl['artificer'] ?? 0) >= 1;
  const rawArtStudyJacks = (ctx.jacksAllocations['artificer-study']   ?? 0) * jackdUpSpeedMult2 + chimeraRelicExtraJack;
  const rawArtStudyFam   = famRaw('artificer-study') * jackdUpSpeedMult2 + chimeraRelicExtraFam;
  const rawArtRefJacks   = (ctx.jacksAllocations['artificer-reflect'] ?? 0) * jackdUpSpeedMult2 + chimeraRelicExtraJack;
  const rawArtRefFam     = famRaw('artificer-reflect') * jackdUpSpeedMult2 + chimeraRelicExtraFam;
  const artStudyJacks = rawArtStudyJacks;
  const artStudyFam   = rawArtStudyFam;
  const artRefJacks   = rawArtRefJacks;
  const artRefFam     = rawArtRefFam;
  const amplifiedLevel2 = ctx.upgrades.level('AMPLIFIED_INSIGHT');
  const arcaneIntellectLevel2 = ctx.upgrades.level('POTION_ARCANE_INTELLECT');
  const maxInsight2   = YIELDS.ARTIFICER_MAX_INSIGHT + arcaneIntellectLevel2 * YIELDS.ARTIFICER_ARCANE_INTELLECT_PER_LEVEL;
  const effInsight2   = Math.min(32, maxInsight2 + amplifiedLevel2 * YIELDS.ARTIFICER_AMPLIFIED_INSIGHT_PER_LEVEL);
  const avgMana2      = effInsight2 > 0 ? effInsight2 * effInsight2 * (hasArtificerRelic2 ? 2 : 1) : 0;
  if (artRefJacks > 0) add('mana', 'Artificer', artRefJacks * avgMana2 * bm('artificer'));
  if (artRefFam   > 0) add('mana', 'Familiar (Artificer)', artRefFam * avgMana2 * bm('artificer'));


  // ── Chimeramancer ─────────────────────────────────────────────
  const chThreadPerJack = calcChimeramancerThreadPerClick(CHIMERAMANCER_YIELDS.THREAD_PER_CLICK, u.level('BIGGER_THREADS')) * bm('chimeramancer');
  if (chJacks > 0) add('life-thread', 'Chimeramancer', chJacks * chThreadPerJack);
  if (chFam   > 0) add('life-thread', 'Familiar (Chimeramancer)', chFam * chThreadPerJack);
  if (chJacks > 0) add('xp', 'Chimeramancer', chJacks * bm('chimeramancer'));
  if (chFam   > 0) add('xp', 'Familiar (Chimeramancer)', chFam * bm('chimeramancer'));
  // Sharper Needles: passive life-thread per second
  const needlesRate = calcSharperNeedlesThreadPerSec(u.level('SHARPER_NEEDLES'), u.level('LOOM_OF_LIFE')) * bm('chimeramancer');
  if (needlesRate > 0) add('life-thread', 'Passive (Needles)', needlesRate);

  // ── Slayer (ichor from auto-attack) ──────────────────────────
  const ichorPerSec = calcSlayerIchorPerSecond(ctx);
  if (ichorPerSec > 0) add('ichor', 'Slayer', ichorPerSec);

  return bd;
}
