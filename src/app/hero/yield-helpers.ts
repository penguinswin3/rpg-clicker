/**
 * ════════════════════════════════════════════════════════════
 *   YIELD HELPERS
 *   Pure functions for all upgrade-derived game values.
 *   No side effects — takes numbers in, returns numbers out.
 * ════════════════════════════════════════════════════════════
 */

import { YIELDS, ARTISAN_MG, MERCHANT_MG } from '../game-config';
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
 * Beast yield per 5-second Baited Traps tick, combining Baited Traps and Spiced Bait.
 * Formula: baitedTrapsLevel + (baitedTrapsLevel × spicedBaitLevel)
 * Multiply by 0.2 to get the per-second display rate.
 */
export function calcBaitedTrapsBeastPerTick(
  baitedTrapsLevel: number,
  spicedBaitLevel: number,
): number {
  return baitedTrapsLevel + baitedTrapsLevel * spicedBaitLevel;
}

/**
 * Herb yield per 5-second Hovel Garden tick, combining Hovel Garden and Ornate Herb Pots.
 * Formula: hovelGardenLevel + (hovelGardenLevel × ornateHerbPotsLevel)
 * Multiply by 0.2 to get the per-second display rate.
 */
export function calcHovelGardenHerbPerTick(
  hovelGardenLevel: number,
  ornateHerbPotsLevel: number,
): number {
  return hovelGardenLevel + hovelGardenLevel * ornateHerbPotsLevel;
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

/** Herb save chance in % — 4% per Potion Titration level. */
export function calcHerbSaveChance(potionTitrationLevel: number): number {
  return potionTitrationLevel * 4;
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

// ── Artisan ─────────────────────────────────────────────────

/** Treasure cost per artisan appraisal (base, upgradeable later). */
export function calcArtisanTreasureCost(): number {
  return YIELDS.ARTISAN_TREASURE_COST;
}

/** Duration of the artisan appraisal timer in ms, reduced by Faster Appraising. */
export function calcArtisanTimerMs(fasterAppraisingLevel: number = 0): number {
  return Math.max(
    ARTISAN_MG.FASTER_APPRAISING_MIN_MS,
    YIELDS.ARTISAN_TIMER_MS - fasterAppraisingLevel * ARTISAN_MG.FASTER_APPRAISING_MS_PER_LEVEL,
  );
}

/** Maximum gemstone yield, increased by Potion of Cat's Paw. */
export function calcArtisanGemstoneMax(catsPawLevel: number = 0): number {
  return YIELDS.ARTISAN_GEMSTONE_MAX + catsPawLevel;
}

/** Maximum precious metal yield, increased by Potion of Cat's Paw. */
export function calcArtisanMetalMax(catsPawLevel: number = 0): number {
  return YIELDS.ARTISAN_METAL_MAX + catsPawLevel;
}

/** Roll a random gemstone yield for one appraisal. */
export function calcArtisanGemstoneYield(catsPawLevel: number = 0): number {
  return randInt(YIELDS.ARTISAN_GEMSTONE_MIN, calcArtisanGemstoneMax(catsPawLevel));
}

/** Roll a gemstone yield for a jack appraisal with optional relic bonus (doubled minimum). */
export function calcArtisanGemstoneYieldJack(catsPawLevel: number = 0, hasRelic: boolean = false): number {
  const min = hasRelic ? YIELDS.ARTISAN_GEMSTONE_MIN * 2 : YIELDS.ARTISAN_GEMSTONE_MIN;
  return randInt(min, Math.max(min, calcArtisanGemstoneMax(catsPawLevel)));
}

/** Roll a random precious metal yield for one appraisal. */
export function calcArtisanMetalYield(catsPawLevel: number = 0): number {
  return randInt(YIELDS.ARTISAN_METAL_MIN, calcArtisanMetalMax(catsPawLevel));
}

/** Metal yield for a jack appraisal with optional relic bonus (always max). */
export function calcArtisanMetalYieldJack(catsPawLevel: number = 0, hasRelic: boolean = false): number {
  return hasRelic ? calcArtisanMetalMax(catsPawLevel) : randInt(YIELDS.ARTISAN_METAL_MIN, calcArtisanMetalMax(catsPawLevel));
}

/** Expected (average) gemstone yield per appraisal — for per-second display. */
export function expectedGemstonePerAppraisal(catsPawLevel: number = 0): number {
  return (YIELDS.ARTISAN_GEMSTONE_MIN + calcArtisanGemstoneMax(catsPawLevel)) / 2;
}

/** Expected (average) gemstone yield per jack appraisal with optional relic bonus. */
export function expectedGemstonePerAppraisalJack(catsPawLevel: number = 0, hasRelic: boolean = false): number {
  const min = hasRelic ? YIELDS.ARTISAN_GEMSTONE_MIN * 2 : YIELDS.ARTISAN_GEMSTONE_MIN;
  return (min + Math.max(min, calcArtisanGemstoneMax(catsPawLevel))) / 2;
}

/** Expected (average) precious metal yield per appraisal — for per-second display. */
export function expectedMetalPerAppraisal(catsPawLevel: number = 0): number {
  return (YIELDS.ARTISAN_METAL_MIN + calcArtisanMetalMax(catsPawLevel)) / 2;
}

/** Expected (average) precious metal yield per jack appraisal with optional relic bonus. */
export function expectedMetalPerAppraisalJack(catsPawLevel: number = 0, hasRelic: boolean = false): number {
  return hasRelic ? calcArtisanMetalMax(catsPawLevel) : (YIELDS.ARTISAN_METAL_MIN + calcArtisanMetalMax(catsPawLevel)) / 2;
}

// ── Necromancer ─────────────────────────────────────────────

/** Bones yielded per Defile click (max, based on Speak With Dead level). */
export function calcNecromancerBoneYield(speakWithDeadLevel: number = 0): number {
  return YIELDS.NECROMANCER_BONE_PER_CLICK + speakWithDeadLevel;
}

/** XP cost per Ward click, reduced by Dark Pact (min 1). */
export function calcNecromancerWardXpCost(darkPactLevel: number): number {
  return Math.max(1, YIELDS.NECROMANCER_WARD_XP_COST - darkPactLevel * 2);
}

/** Brimstone yielded per Ward click (max, based on Fortified Chalk level). */
export function calcNecromancerBrimstoneYield(fortifiedChalkLevel: number = 0): number {
  return YIELDS.NECROMANCER_BRIMSTONE_PER_WARD + fortifiedChalkLevel;
}

/** Percent chance to find bonus loot from Grave Looting during Defile (0–100). */
export function calcGraveLootingChance(graveLootingLevel: number): number {
  return graveLootingLevel * YIELDS.GRAVE_LOOTING_CHANCE_PER_LEVEL;
}

/** Minimum clicks before the active necromancer button switches. */
export function calcNecromancerSwitchMin(extendedRitualLevel: number): number {
  return YIELDS.NECROMANCER_SWITCH_MIN + extendedRitualLevel * 2;
}

/** Maximum clicks before the active necromancer button switches. */
export function calcNecromancerSwitchMax(extendedRitualLevel: number): number {
  return YIELDS.NECROMANCER_SWITCH_MAX + extendedRitualLevel * 2;
}

/** Roll a random switch-click threshold for the necromancer. */
export function rollNecromancerSwitchClicks(extendedRitualLevel: number): number {
  return randInt(calcNecromancerSwitchMin(extendedRitualLevel), calcNecromancerSwitchMax(extendedRitualLevel));
}

// ── Merchant ────────────────────────────────────────────────

/** Number of illicit goods opened per Merchant hero-button click (1 base + Boxing Day). */
export function calcMerchantOpensPerClick(boxingDayLevel: number): number {
  return 1 + boxingDayLevel;
}

/** Percent chance to double the goods opened per click (Smuggler's Network, 4% per level). */
export function calcMerchantDoubleChance(smugglerNetworkLevel: number): number {
  return smugglerNetworkLevel * MERCHANT_MG.SMUGGLER_NETWORK_CHANCE_PER_LEVEL;
}

/**
 * Expected loot per single illicit goods open (one roll from the loot table).
 * Returns a map of currencyId → expected amount per roll, factoring in Black Market level.
 */
export function calcExpectedIllicitLootPerRoll(
  blackMarketLevel: number = 0,
): Record<string, number> {
  const table = MERCHANT_MG.LOOT_TABLE;
  const rareCurrencies = new Set(['monster-trophy', 'forbidden-tome', 'magical-implement']);
  const rareBonus = blackMarketLevel * MERCHANT_MG.BLACK_MARKET_RARE_BONUS_PER_LEVEL;
  const effectiveWeights = table.map(e =>
    rareCurrencies.has(e.currencyId) ? e.weight + rareBonus : e.weight
  );
  const totalWeight = effectiveWeights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) return {};

  const result: Record<string, number> = {};
  for (let i = 0; i < table.length; i++) {
    const entry = table[i];
    const prob = effectiveWeights[i] / totalWeight;
    const avgAmount = (entry.min + entry.max) / 2;
    result[entry.currencyId] = (result[entry.currencyId] ?? 0) + prob * avgAmount;
  }
  return result;
}

/**
 * Roll the illicit goods loot table once.
 * Returns { currencyId, amount } or null if nothing.
 * blackMarketLevel shifts weight toward rare entries.
 */
export function rollIllicitLootTable(
  blackMarketLevel: number = 0,
): { currencyId: string; amount: number } | null {
  const table = MERCHANT_MG.LOOT_TABLE;
  if (table.length === 0) return null;

  // Rare currency IDs
  const rareCurrencies = new Set(['monster-trophy', 'forbidden-tome', 'magical-implement']);

  // Compute effective weights — Black Market Connections boosts rare rows
  const rareBonus = blackMarketLevel * MERCHANT_MG.BLACK_MARKET_RARE_BONUS_PER_LEVEL;
  const effectiveWeights = table.map(e =>
    rareCurrencies.has(e.currencyId) ? e.weight + rareBonus : e.weight
  );
  const totalWeight = effectiveWeights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) return null;

  let roll = Math.random() * totalWeight;
  for (let i = 0; i < table.length; i++) {
    roll -= effectiveWeights[i];
    if (roll <= 0) {
      const entry = table[i];
      const amount = randInt(entry.min, entry.max);
      return { currencyId: entry.currencyId, amount };
    }
  }

  // Fallback (should not happen)
  const last = table[table.length - 1];
  return { currencyId: last.currencyId, amount: randInt(last.min, last.max) };
}

// ── Chimeramancer ────────────────────────────────────────────

/**
 * Life Thread added per Stitch hero-button click (base + Bigger Threads bonus).
 * Uses CHIMERAMANCER_YIELDS.THREAD_PER_CLICK as the base.
 */
export function calcChimeramancerThreadPerClick(
  baseThreadPerClick: number,
  biggerThreadsLevel: number,
): number {
  return baseThreadPerClick + biggerThreadsLevel;
}

/**
 * Passive Life Thread per second from Sharper Needles × Loom of Life multiplier.
 * Mirrors the Contracted Hirelings + Hireling's Hirelings formula:
 *   base + base * multiplier = base * (1 + multiplier)
 */
export function calcSharperNeedlesThreadPerSec(
  sharperNeedlesLevel: number,
  loomOfLifeLevel: number,
): number {
  return sharperNeedlesLevel + sharperNeedlesLevel * loomOfLifeLevel;
}
