/**
 * ════════════════════════════════════════════════════════════
 *   HERO STATS BUILDER
 *   Builds the HeroStat[] array shown in the character
 *   sidebar, delegating all math to yield-helpers.
 * ════════════════════════════════════════════════════════════
 */

import { HeroStat } from '../character/character-sidebar.component';
import { HERO_STATS_FLAVOR, CHARACTER_FLAVOR } from '../flavor-text';
import { YIELDS, APOTH_MG, THIEF_MG } from '../game-config';
import { UpgradeService } from '../upgrade/upgrade.service';
import { WalletService } from '../wallet/wallet.service';
import { roundTo } from '../utils/mathUtils';
import {
  calcGoldPerClick, calcAutoGoldPerSecond, calcXpPerBounty,
  calcBeastFindChance, herbDoublingDisplay,
  calcPotionMarketingGoldPerBrew, calcHerbSaveChance,
  calcSpicePerClick, calcCulinarianGoldCost,
  calcThiefSuccessChance, calcExpectedDossierYield,
  calcBaitedTrapsBeastPerTick, calcHovelGardenHerbPerTick,
  calcArtisanTreasureCost, calcArtisanTimerMs,
} from './yield-helpers';

// ── Context required by the builder ──────────────────────────

export interface HeroStatsContext {
  upgrades:               UpgradeService;
  wallet:                 WalletService;
  minigameUnlocked:       boolean;
  wholesaleSpicesEnabled: boolean;
  jacksAllocations:       Record<string, number>;
  isThiefStunned:         boolean;
  /** Lifetime total relics ever collected — used to display the Relic Hunter cap. */
  relicLifetimeCount:     number;
}

// ── Public API ──────────────────────────────────────────────

/** Returns the quest-button label for the active character. */
export function getQuestBtnLabel(charId: string): string {
  const map: Record<string, string> = {
    fighter:    CHARACTER_FLAVOR.FIGHTER.questBtn,
    ranger:     CHARACTER_FLAVOR.RANGER.questBtn,
    apothecary: CHARACTER_FLAVOR.APOTHECARY.questBtn,
    culinarian: CHARACTER_FLAVOR.CULINARIAN.questBtn,
    thief:      CHARACTER_FLAVOR.THIEF.questBtn,
    artisan:    CHARACTER_FLAVOR.ARTISAN.questBtn,
  };
  return map[charId] ?? CHARACTER_FLAVOR.FIGHTER.questBtn;
}

/** Build the HeroStat[] array for the given character. */
export function buildHeroStats(charId: string, ctx: HeroStatsContext): HeroStat[] {
  switch (charId) {
    case 'ranger':     return buildRangerStats(ctx);
    case 'apothecary': return buildApothecaryStats(ctx);
    case 'culinarian': return buildCulinarianStats(ctx);
    case 'thief':      return buildThiefStats(ctx);
    case 'artisan':    return buildArtisanStats(ctx);
    default:           return buildFighterStats(ctx);
  }
}

// ── Per-character builders ──────────────────────────────────

function buildFighterStats(ctx: HeroStatsContext): HeroStat[] {
  const u = ctx.upgrades;
  const goldPerClick   = calcGoldPerClick(u.level('BETTER_BOUNTIES'));
  const autoGoldPerSec = calcAutoGoldPerSecond(u.level('CONTRACTED_HIRELINGS'), u.level('HIRELINGS_HIRELINGS'));
  const xpPerBounty    = calcXpPerBounty(u.level('INSIGHTFUL_CONTRACTS'));

  return [
    { label: HERO_STATS_FLAVOR.FIGHTER.PER_CLICK,  value: `${goldPerClick}` },
    { label: HERO_STATS_FLAVOR.FIGHTER.PER_SECOND, value: `${autoGoldPerSec}` },
    ...(ctx.minigameUnlocked
      ? [{ label: HERO_STATS_FLAVOR.FIGHTER.DAMAGE_RANGE, value: `${1 + u.level('SLOW_BLADE')}-${1 + u.level('SHARPER_SWORDS')}` }]
      : []),
    ...(u.level('INSIGHTFUL_CONTRACTS') > 0
      ? [{ label: HERO_STATS_FLAVOR.FIGHTER.XP_PER_CLICK, value: `${xpPerBounty}` }]
      : []),
  ];
}

function buildRangerStats(ctx: HeroStatsContext): HeroStat[] {
  const u = ctx.upgrades;
  const trapRate   = calcBaitedTrapsBeastPerTick(u.level('BAITED_TRAPS'), u.level('SPICED_BAIT')) * 0.2;
  const gardenRate = calcHovelGardenHerbPerTick(u.level('HOVEL_GARDEN'), u.level('ORNATE_HERB_POTS')) * 0.2;

  return [
    { label: HERO_STATS_FLAVOR.RANGER.BEAST_CHANCE, value: `${calcBeastFindChance(u.level('BETTER_TRACKING'))}%` },
    { label: HERO_STATS_FLAVOR.RANGER.HERB_DOUBLE,  value: herbDoublingDisplay(u.level('MORE_HERBS')) },
    { label: HERO_STATS_FLAVOR.RANGER.CATS_EYE,     value: `${u.level('POTION_CATS_EYE')}%` },
    ...(u.level('BIGGER_GAME') > 0
      ? [{ label: HERO_STATS_FLAVOR.RANGER.MAX_MEAT, value: `${u.level('BIGGER_GAME') + 1}` }]
      : []),
    ...(u.level('BAITED_TRAPS') > 0
      ? [{ label: HERO_STATS_FLAVOR.RANGER.TRAP_RATE, value: `${roundTo(trapRate, 2)}/s` }]
      : []),
    ...(u.level('HOVEL_GARDEN') > 0
      ? [{ label: HERO_STATS_FLAVOR.RANGER.GARDEN_RATE, value: `${roundTo(gardenRate, 2)}/s` }]
      : []),
  ];
}

function buildApothecaryStats(ctx: HeroStatsContext): HeroStat[] {
  const u = ctx.upgrades;
  const stats: HeroStat[] = [
    { label: HERO_STATS_FLAVOR.APOTHECARY.HERBS_BREW,    value: `${YIELDS.APOTHECARY_BREW_HERB_COST}` },
    { label: HERO_STATS_FLAVOR.APOTHECARY.SAVE_CHANCE,   value: `${calcHerbSaveChance(u.level('POTION_TITRATION'))}%` },
    { label: HERO_STATS_FLAVOR.APOTHECARY.GOLD_PER_BREW, value: `${calcPotionMarketingGoldPerBrew(u.level('POTION_MARKETING'))}` },
  ];
  if (u.level('POTION_DILUTION') >= 1) {
    const successChance = Math.min(100, APOTH_MG.DILUTION_BASE_CHANCE);
    const totalRolls    = 2 + u.level('SERIAL_DILUTION');
    stats.push({ label: HERO_STATS_FLAVOR.APOTHECARY.DILUTION_SUCCESS, value: `${successChance}%` });
    stats.push({ label: HERO_STATS_FLAVOR.APOTHECARY.DILUTION_ROLLS,   value: `${totalRolls}` });
  }
  return stats;
}

function buildCulinarianStats(ctx: HeroStatsContext): HeroStat[] {
  const u = ctx.upgrades;
  const spicePerClick = calcSpicePerClick(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'));
  const goldCost      = calcCulinarianGoldCost(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'), u.level('POTION_GLIBNESS'));
  const pricePerSpice = roundTo(goldCost / spicePerClick, 2);

  const stats: HeroStat[] = [
    { label: HERO_STATS_FLAVOR.CULINARIAN.SPICE_PER_CLICK, value: `${spicePerClick}` },
    { label: HERO_STATS_FLAVOR.CULINARIAN.GOLD_COST,       value: `${goldCost}` },
    { label: HERO_STATS_FLAVOR.CULINARIAN.PRICE_PER_SPICE, value: `${pricePerSpice}g` },
  ];
  if (u.level('POTION_GLIBNESS') > 0) {
    stats.push({
      label: HERO_STATS_FLAVOR.CULINARIAN.GOLD_DISCOUNT,
      value: `-${u.level('POTION_GLIBNESS')}%`,
    });
  }
  return stats;
}

function buildThiefStats(ctx: HeroStatsContext): HeroStat[] {
  const u          = ctx.upgrades;
  const thiefJacks = ctx.jacksAllocations['thief'] ?? 0;
  const sf         = u.level('POTION_OF_STICKY_FINGERS');
  const successChance  = calcThiefSuccessChance(u.level('METICULOUS_PLANNING'));
  const avgYield       = calcExpectedDossierYield(sf);
  const expectedPerSec = roundTo(thiefJacks * (successChance / 100) * avgYield, 2);
  const isMPMaxed      = u.level('METICULOUS_PLANNING') >= u.maxLevel('METICULOUS_PLANNING');
  const isExact        = isMPMaxed && sf === 0;

  // Yield ranges
  const bagGoldBonus     = u.level('BAG_OF_HOLDING') * THIEF_MG.BAG_OF_HOLDING_GOLD_YIELD_PER_LEVEL;
  const bagTreasureBonus = u.level('BAG_OF_HOLDING') * THIEF_MG.BAG_OF_HOLDING_TREASURE_YIELD_PER_LEVEL;
  const maxDetect    = THIEF_MG.MAX_DETECTION + u.level('VANISHING_POWDER') * THIEF_MG.VANISHING_POWDER_DETECT_PER_LEVEL;
  const goldMin      = THIEF_MG.GOLD_BASE;
  const goldMax      = THIEF_MG.GOLD_BASE     + THIEF_MG.GOLD_PER_UNUSED     * maxDetect + bagGoldBonus;
  const treasureMin  = THIEF_MG.TREASURE_BASE;
  const treasureMax  = THIEF_MG.TREASURE_BASE + THIEF_MG.TREASURE_PER_UNUSED * maxDetect + bagTreasureBonus;
  const relicUnlocked = ctx.wallet.isCurrencyUnlocked('relic');
  const relicCap      = 1 + u.level('RELIC_HUNTER');

  const stats: HeroStat[] = [
    { label: HERO_STATS_FLAVOR.THIEF.SUCCESS_CHANCE, value: `${successChance}%` },
    { label: HERO_STATS_FLAVOR.THIEF.GOLD_RANGE,     value: `${goldMin} - ${goldMax}` },
    { label: HERO_STATS_FLAVOR.THIEF.TREASURE_RANGE, value: `${treasureMin} - ${treasureMax}` },
  ];
  if (sf > 0) {
    stats.push({ label: HERO_STATS_FLAVOR.THIEF.DOSSIER_YIELD, value: `1 - ${1 + sf}` });
  }
  if (relicUnlocked) {
    stats.push({ label: HERO_STATS_FLAVOR.THIEF.RELIC_CAP,    value: `${ctx.relicLifetimeCount} / ${relicCap}` });
  }
  return stats;
}

function buildArtisanStats(_ctx: HeroStatsContext): HeroStat[] {
  const treasureCost = calcArtisanTreasureCost();
  const timerSec     = calcArtisanTimerMs() / 1000;

  return [
    { label: HERO_STATS_FLAVOR.ARTISAN.TREASURE_COST,  value: `${treasureCost}` },
    { label: HERO_STATS_FLAVOR.ARTISAN.TIMER_DURATION, value: `${timerSec}s` },
    { label: HERO_STATS_FLAVOR.ARTISAN.GEMSTONE_RANGE, value: `${YIELDS.ARTISAN_GEMSTONE_MIN} - ${YIELDS.ARTISAN_GEMSTONE_MAX}` },
    { label: HERO_STATS_FLAVOR.ARTISAN.METAL_RANGE,    value: `${YIELDS.ARTISAN_METAL_MIN} - ${YIELDS.ARTISAN_METAL_MAX}` },
  ];
}

