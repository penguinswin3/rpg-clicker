/**
 * ════════════════════════════════════════════════════════════
 *   HERO ACTIONS
 *   Click handlers for each hero and jack auto-click logic.
 *   Receives services through a context interface to stay
 *   framework-agnostic and easily testable.
 * ════════════════════════════════════════════════════════════
 */

import { WalletService } from '../wallet/wallet.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { UpgradeService } from '../upgrade/upgrade.service';
import { StatisticsService } from '../statistics/statistics.service';
import { YIELDS, BEADS, MERCHANT_MG } from '../game-config';
import { cur, LOG_MSG, CURRENCY_FLAVOR } from '../flavor-text';
import { rollChance, rollMultiChance, randInt } from '../utils/mathUtils';
import {
  calcGoldPerClick, calcXpPerBounty,
  calcBeastFindChance, computeHerbYield, computeMeatYield,
  calcHerbSaveChance, calcPotionMarketingGoldPerBrew,
  calcSpicePerClick, calcCulinarianGoldCost,
  calcThiefSuccessChance,
  calcArtisanTreasureCost,
  calcAutoGoldPerSecond,
  calcNecromancerBoneYield, calcNecromancerWardXpCost,
  calcNecromancerBrimstoneYield, calcGraveLootingChance,
  calcMerchantGoodsPerClick, calcMerchantDoubleChance,
  rollIllicitLootTable, calcMerchantFencedGold,
} from './yield-helpers';

// ── Contexts ────────────────────────────────────────────────

/** Shared dependency bag for all hero click handlers. */
export interface HeroActionContext {
  wallet:                 WalletService;
  log:                    ActivityLogService;
  upgrades:               UpgradeService;
  stats:                  StatisticsService;
  wholesaleSpicesEnabled: boolean;
  /** Current thief stun state (needed by clickThief). */
  isThiefStunned:         boolean;
  /** Callback to apply stun on a failed thief break-in. */
  applyThiefStun:         () => void;
  /** Whether the Artisan's appraisal timer is currently active. */
  isArtisanTimerActive:   boolean;
  /** Start the Artisan appraisal timer (batchSize = 1 for manual click). */
  startArtisanTimer:      (batchSize: number) => void;
  /** Which necromancer button is currently active ('defile' or 'ward'). */
  necromancerActiveButton: 'defile' | 'ward';
  /** Callback to decrement necromancer clicks and switch if needed. Returns true if button switched. */
  necromancerDecrementClick: () => boolean;
  /** Get the bead yield multiplier for a character. */
  beadMultiplier?: (charId: string) => number;
  /** Whether the character has an unfound blue bead slot. */
  hasUnfoundBlueBead?: (charId: string) => boolean;
  /** Callback when a blue bead is discovered. */
  onBlueBeadFound?: (charId: string) => void;
}

/**
 * Dependency bag for jack auto-clicks.
 * Uses **function-based** getters for mutable state that can
 * change within a single tick (multiple jacks fire sequentially).
 */
export interface JackAutoClickContext {
  wallet:                 WalletService;
  upgrades:               UpgradeService;
  stats:                  StatisticsService;
  wholesaleSpicesEnabled: boolean;
  /** Live check — may change after a thief jack triggers a stun. */
  isThiefStunned:         () => boolean;
  applyThiefStun:         () => void;
  /** Per-character starvation flag (true = starved). */
  isJackStarved:          (charId: string) => boolean;
  setJackStarved:         (charId: string, starved: boolean) => void;
  /** Called when starvation state changes so per-second rates refresh. */
  onPerSecondUpdate:      () => void;
  /** Live check — true while the artisan timer is running. */
  isArtisanTimerActive:   () => boolean;
  /** Start the artisan shared timer with the given batch size (= jackCount). */
  startArtisanTimer:      (batchSize: number) => void;
  /** Returns the level of a character's relic upgrade (0 = not owned). */
  relicLevel:             (charId: string) => number;
  /** Live check — which necromancer button is currently active. */
  necromancerActiveButton: () => 'defile' | 'ward';
  /** Decrement necromancer clicks remaining and switch if needed. Returns true if button switched. */
  necromancerDecrementClick: () => boolean;
  /** Get the bead yield multiplier for a character. */
  beadMultiplier?: (charId: string) => number;
  /** Whether the character's right blue bead (blue-2, awarded by jacks) is still undiscovered. */
  hasUnfoundJackBead?: (charId: string) => boolean;
  /** Callback when the right blue bead (blue-2) is discovered by a jack. */
  onJackBeadFound?: (charId: string) => void;
}

// ── Hero click dispatch ─────────────────────────────────────

/** Route a hero-button click to the correct character handler. */
export function dispatchHeroClick(charId: string, ctx: HeroActionContext): void {
  ctx.stats.trackManualHeroPress(charId);
  switch (charId) {
    case 'fighter':    clickFighter(ctx); break;
    case 'ranger':     clickRanger(ctx); break;
    case 'apothecary': clickApothecary(ctx); break;
    case 'culinarian': clickCulinarian(ctx); break;
    case 'thief':      clickThief(ctx); break;
    case 'artisan':    clickArtisan(ctx); break;
    case 'necromancer': clickNecromancer(ctx); break;
    case 'merchant':   clickMerchant(ctx); break;
  }
  // Roll for blue bead discovery
  if (ctx.hasUnfoundBlueBead?.(charId) && Math.random() < BEADS.BLUE_CHANCE) {
    ctx.onBlueBeadFound?.(charId);
  }
}

// ── Individual hero clicks ──────────────────────────────────

function clickFighter(ctx: HeroActionContext): void {
  const bm = ctx.beadMultiplier?.('fighter') ?? 1;
  const goldPerClick = calcGoldPerClick(ctx.upgrades.level('BETTER_BOUNTIES')) * bm;
  const xpPerBounty  = calcXpPerBounty(ctx.upgrades.level('INSIGHTFUL_CONTRACTS')) * bm;
  ctx.wallet.add('gold', goldPerClick);
  ctx.wallet.add('xp',   xpPerBounty);
  ctx.stats.trackCurrencyGain('gold', goldPerClick);
  ctx.stats.trackCurrencyGain('xp', xpPerBounty);
  ctx.log.log(LOG_MSG.HERO.FIGHTER.BOUNTY(cur('gold', goldPerClick), cur('xp', xpPerBounty)));
}

function clickRanger(ctx: HeroActionContext): void {
  const u = ctx.upgrades;
  const bm = ctx.beadMultiplier?.('ranger') ?? 1;
  ctx.wallet.add('xp', 1 * bm);
  ctx.stats.trackCurrencyGain('xp', 1 * bm);

  const moreHerbsLevel  = u.level('MORE_HERBS');
  const biggerGameLevel = u.level('BIGGER_GAME');
  const beastChance     = calcBeastFindChance(u.level('BETTER_TRACKING'));
  const catsEyeLevel    = u.level('POTION_CATS_EYE');
  const catsEyeProcs    = catsEyeLevel > 0 && rollChance(catsEyeLevel * 5);

  if (catsEyeProcs) {
    const herbs    = computeHerbYield(moreHerbsLevel) * bm;
    const gotBeast = rollChance(beastChance);
    ctx.wallet.add('herb', herbs);
    ctx.stats.trackCurrencyGain('herb', herbs);
    if (gotBeast) {
      const meat = computeMeatYield(biggerGameLevel) * bm;
      ctx.wallet.add('beast', meat);
      ctx.stats.trackCurrencyGain('beast', meat);
      ctx.log.log(LOG_MSG.HERO.RANGER.CATS_EYE_BOTH(cur('herb', herbs), cur('beast', meat), cur('xp', 1 * bm)), 'success');
    } else {
      ctx.log.log(LOG_MSG.HERO.RANGER.CATS_EYE_HERB_ONLY(cur('herb', herbs), cur('xp', 1 * bm)), 'success');
    }
  } else {
    const targetHerb = rollChance(50);
    if (targetHerb) {
      const herbs = computeHerbYield(moreHerbsLevel) * bm;
      ctx.wallet.add('herb', herbs);
      ctx.stats.trackCurrencyGain('herb', herbs);
      ctx.log.log(LOG_MSG.HERO.RANGER.FORAGE_HERB(cur('herb', herbs), cur('xp', 1 * bm)));
    } else {
      const gotBeast = rollChance(beastChance);
      if (gotBeast) {
        const meat = computeMeatYield(biggerGameLevel) * bm;
        ctx.wallet.add('beast', meat);
        ctx.stats.trackCurrencyGain('beast', meat);
        ctx.log.log(LOG_MSG.HERO.RANGER.HUNT_BEAST(cur('beast', meat), cur('xp', 1 * bm)));
      } else {
        ctx.log.log(LOG_MSG.HERO.RANGER.BEAST_ESCAPED(cur('xp', 1 * bm)));
      }
    }
  }
}

function clickApothecary(ctx: HeroActionContext): void {
  const u = ctx.upgrades;
  const bm = ctx.beadMultiplier?.('apothecary') ?? 1;
  const herbCost       = YIELDS.APOTHECARY_BREW_HERB_COST;
  const herbSaveChance = calcHerbSaveChance(u.level('POTION_TITRATION'));
  const goldPerBrew    = calcPotionMarketingGoldPerBrew(u.level('POTION_MARKETING'));

  if (!ctx.wallet.canAfford('herb', herbCost)) {
    const have = Math.floor(ctx.wallet.get('herb'));
    ctx.log.log(LOG_MSG.HERO.APOTHECARY.NOT_ENOUGH_HERBS(cur('herb', herbCost, ''), cur('herb', have, '')), 'warn');
    return;
  }
  ctx.wallet.remove('herb', herbCost);
  const potionYield = 1 * bm;
  const xpYield = 1 * bm;
  ctx.wallet.add('potion', potionYield);
  ctx.wallet.add('xp', xpYield);
  ctx.stats.trackCurrencyGain('potion', potionYield);
  ctx.stats.trackCurrencyGain('xp', xpYield);
  if (goldPerBrew > 0) {
    const goldYield = goldPerBrew * bm;
    ctx.wallet.add('gold', goldYield);
    ctx.stats.trackCurrencyGain('gold', goldYield);
  }

  const herbsSaved = rollMultiChance(herbSaveChance);
  if (herbsSaved > 0) {
    ctx.wallet.add('herb', herbsSaved);
    ctx.stats.trackCurrencyGain('herb', herbsSaved);
    ctx.log.log(LOG_MSG.HERO.APOTHECARY.BREW_RECOVERED(cur('potion', potionYield), cur('herb', herbsSaved), cur('xp', xpYield)), 'default');
  } else {
    ctx.log.log(LOG_MSG.HERO.APOTHECARY.BREW(cur('potion', potionYield), cur('xp', xpYield)));
  }
}

function clickCulinarian(ctx: HeroActionContext): void {
  const u = ctx.upgrades;
  const bm = ctx.beadMultiplier?.('culinarian') ?? 1;
  const goldCost   = calcCulinarianGoldCost(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'), u.level('POTION_GLIBNESS'));
  const spiceYield = calcSpicePerClick(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES')) * bm;

  if (!ctx.wallet.canAfford('gold', goldCost)) {
    const have = Math.floor(ctx.wallet.get('gold'));
    ctx.log.log(LOG_MSG.HERO.CULINARIAN.NOT_ENOUGH_GOLD(cur('gold', goldCost, ''), cur('gold', have, '')), 'warn');
    return;
  }
  ctx.wallet.remove('gold', goldCost);
  ctx.wallet.add('spice', spiceYield);
  const xpYield = 1 * bm;
  ctx.wallet.add('xp', xpYield);
  ctx.stats.trackCurrencyGain('spice', spiceYield);
  ctx.stats.trackCurrencyGain('xp', xpYield);
  ctx.log.log(LOG_MSG.HERO.CULINARIAN.SOURCED(cur('gold', goldCost, '-'), cur('spice', spiceYield), cur('xp', xpYield)));
}

function clickThief(ctx: HeroActionContext): void {
  if (ctx.isThiefStunned) return;

  const u = ctx.upgrades;
  const bm = ctx.beadMultiplier?.('thief') ?? 1;
  const successChance = calcThiefSuccessChance(u.level('METICULOUS_PLANNING'));
  const sfLevel = u.level('POTION_OF_STICKY_FINGERS');
  const ppLevel = u.level('PLENTIFUL_PLUNDERING');

  if (rollChance(successChance)) {
    const dossierYield = (sfLevel > 0 ? randInt(1, 1 + sfLevel) : 1) * bm;
    const xpYield = 1 * bm;
    ctx.wallet.add('dossier', dossierYield);
    ctx.wallet.add('xp', xpYield);
    ctx.stats.trackCurrencyGain('dossier', dossierYield);
    ctx.stats.trackCurrencyGain('xp', xpYield);

    if (ppLevel > 0) {
      const dossiers = randInt(1, 1 + sfLevel);
      const bonus = dossiers * ppLevel * bm;
      if (bonus > 0) {
        ctx.wallet.add('gold', bonus);
        ctx.stats.trackCurrencyGain('gold', bonus);
      }
      ctx.log.log(
        LOG_MSG.HERO.THIEF.SUCCESS_WITH_GOLD(cur('dossier', dossierYield), cur('xp', xpYield), cur('gold', bonus)),
        'default',
      );
    } else {
      ctx.log.log(
        LOG_MSG.HERO.THIEF.SUCCESS(cur('dossier', dossierYield), cur('xp', xpYield)),
        'default',
      );
    }
  } else {
    ctx.applyThiefStun();
    ctx.log.log(LOG_MSG.HERO.THIEF.SPOTTED(YIELDS.THIEF_STUN_DURATION_MS / 1000), 'warn');
  }
}

function clickArtisan(ctx: HeroActionContext): void {
  if (ctx.isArtisanTimerActive) return;

  const treasureCost = calcArtisanTreasureCost();
  if (!ctx.wallet.canAfford('treasure', treasureCost)) {
    const have = Math.floor(ctx.wallet.get('treasure'));
    ctx.log.log(LOG_MSG.HERO.ARTISAN.NOT_ENOUGH_TREASURE(cur('treasure', treasureCost, ''), cur('treasure', have, '')), 'warn');
    return;
  }
  ctx.wallet.remove('treasure', treasureCost);
  ctx.startArtisanTimer(1);
  ctx.log.log(LOG_MSG.HERO.ARTISAN.APPRAISAL_STARTED(cur('treasure', treasureCost, '-')));
}

function clickNecromancer(ctx: HeroActionContext): void {
  if (ctx.necromancerActiveButton === 'defile') {
    clickNecromancerDefile(ctx);
  } else {
    clickNecromancerWard(ctx);
  }
  ctx.necromancerDecrementClick();
}

function clickNecromancerDefile(ctx: HeroActionContext): void {
  const u = ctx.upgrades;
  const bm = ctx.beadMultiplier?.('necromancer') ?? 1;
  const boneYield = randInt(1, calcNecromancerBoneYield(u.level('SPEAK_WITH_DEAD'))) * bm;
  ctx.wallet.add('bone', boneYield);
  const xpYield = 1 * bm;
  ctx.wallet.add('xp', xpYield);
  ctx.stats.trackCurrencyGain('bone', boneYield);
  ctx.stats.trackCurrencyGain('xp', xpYield);

  // Grave Looting: chance to find bonus loot (Gold, Gems, or Jewelry)
  const graveLootChance = calcGraveLootingChance(u.level('GRAVE_LOOTING'));
  if (graveLootChance > 0 && rollChance(graveLootChance)) {
    const roll = Math.random();
    if (roll < YIELDS.GRAVE_LOOTING_GOLD_WEIGHT) {
      const gold = YIELDS.GRAVE_LOOTING_GOLD_AMOUNT * bm;
      ctx.wallet.add('gold', gold);
      ctx.stats.trackCurrencyGain('gold', gold);
      ctx.log.log(LOG_MSG.HERO.NECROMANCER.DEFILE_GOLD(cur('bone', boneYield), cur('gold', gold), cur('xp', xpYield)), 'success');
    } else if (roll < YIELDS.GRAVE_LOOTING_GOLD_WEIGHT + YIELDS.GRAVE_LOOTING_GEM_WEIGHT) {
      const gems = YIELDS.GRAVE_LOOTING_GEM_AMOUNT * bm;
      ctx.wallet.add('gemstone', gems);
      ctx.stats.trackCurrencyGain('gemstone', gems);
      ctx.log.log(LOG_MSG.HERO.NECROMANCER.DEFILE_GEM(cur('bone', boneYield), cur('gemstone', gems), cur('xp', xpYield)), 'success');
    } else {
      const jewelry = YIELDS.GRAVE_LOOTING_JEWELRY_AMOUNT * bm;
      ctx.wallet.add('jewelry', jewelry);
      ctx.stats.trackCurrencyGain('jewelry', jewelry);
      ctx.log.log(LOG_MSG.HERO.NECROMANCER.DEFILE_JEWELRY(cur('bone', boneYield), cur('jewelry', jewelry), cur('xp', xpYield)), 'success');
    }
  } else {
    ctx.log.log(LOG_MSG.HERO.NECROMANCER.DEFILE(cur('bone', boneYield), cur('xp', xpYield)));
  }
}

function clickNecromancerWard(ctx: HeroActionContext): void {
  const u = ctx.upgrades;
  const bm = ctx.beadMultiplier?.('necromancer') ?? 1;
  const xpCost = calcNecromancerWardXpCost(u.level('DARK_PACT'));
  if (!ctx.wallet.canAfford('xp', xpCost)) {
    const have = Math.floor(ctx.wallet.get('xp'));
    ctx.log.log(LOG_MSG.HERO.NECROMANCER.NOT_ENOUGH_XP(cur('xp', xpCost, ''), cur('xp', have, '')), 'warn');
    return;
  }
  const brimstoneMax   = calcNecromancerBrimstoneYield(u.level('FORTIFIED_CHALK'));
  const brimstoneYield = randInt(1, brimstoneMax) * bm;
  ctx.wallet.remove('xp', xpCost);
  ctx.wallet.add('brimstone', brimstoneYield);
  ctx.stats.trackCurrencyGain('brimstone', brimstoneYield);
  ctx.log.log(LOG_MSG.HERO.NECROMANCER.WARD(cur('xp', xpCost, '-'), cur('brimstone', brimstoneYield)));
}

// ── Jack auto-click dispatch ────────────────────────────────

/** Execute one jack auto-click for the given character. */
export function performJackAutoClick(charId: string, ctx: JackAutoClickContext): void {
  // Normalize necromancer sub-keys to 'necromancer' for stats tracking
  const statsCharId = charId.startsWith('necromancer') ? 'necromancer' : charId;
  ctx.stats.trackJackHeroPress(statsCharId);
  switch (charId) {
    case 'fighter':            jackFighter(ctx); break;
    case 'ranger':             jackRanger(ctx); break;
    case 'apothecary':         jackApothecary(ctx); break;
    case 'culinarian':         jackCulinarian(ctx); break;
    case 'thief':              jackThief(ctx); break;
    // Artisan jacks are handled as a batch in app.component (shared timer).
    case 'artisan':            break;
    case 'necromancer-defile': jackNecromancerDefile(ctx); break;
    case 'necromancer-ward':   jackNecromancerWard(ctx); break;
    case 'merchant':           jackMerchant(ctx); break;
  }
  // Roll for right blue bead (blue-2) discovery via jack/familiar clicks
  const baseCharId = charId.startsWith('necromancer') ? 'necromancer' : charId;
  if (ctx.hasUnfoundJackBead?.(baseCharId) && Math.random() < BEADS.GOLD_CHANCE) {
    ctx.onJackBeadFound?.(baseCharId);
  }
}

// ── Jack per-character logic ────────────────────────────────

function jackFighter(ctx: JackAutoClickContext): void {
  const bm = ctx.beadMultiplier?.('fighter') ?? 1;
  const goldPerClick = calcGoldPerClick(ctx.upgrades.level('BETTER_BOUNTIES')) * bm;
  const xpPerBounty  = calcXpPerBounty(ctx.upgrades.level('INSIGHTFUL_CONTRACTS')) * bm;
  ctx.wallet.add('gold', goldPerClick);
  ctx.wallet.add('xp',   xpPerBounty);
  ctx.stats.trackCurrencyGain('gold', goldPerClick);
  ctx.stats.trackCurrencyGain('xp', xpPerBounty);

  // Relic: Crown of Hireling Command — each jack also generates hireling gold
  if (ctx.relicLevel('fighter') >= 1) {
    const hirelingGold = calcAutoGoldPerSecond(
      ctx.upgrades.level('CONTRACTED_HIRELINGS'),
      ctx.upgrades.level('HIRELINGS_HIRELINGS'),
    ) * bm;
    if (hirelingGold > 0) {
      ctx.wallet.add('gold', hirelingGold);
      ctx.stats.trackCurrencyGain('gold', hirelingGold);
    }
  }

  if (ctx.isJackStarved('fighter')) ctx.setJackStarved('fighter', false);
}

function jackRanger(ctx: JackAutoClickContext): void {
  const u = ctx.upgrades;
  const bm = ctx.beadMultiplier?.('ranger') ?? 1;
  ctx.wallet.add('xp', 1 * bm);
  ctx.stats.trackCurrencyGain('xp', 1 * bm);

  const moreHerbsLevel  = u.level('MORE_HERBS');
  const biggerGameLevel = u.level('BIGGER_GAME');
  const beastChance     = calcBeastFindChance(u.level('BETTER_TRACKING'));
  const catsEyeLevel    = u.level('POTION_CATS_EYE');
  const catsEyeProcs    = catsEyeLevel > 0 && rollChance(catsEyeLevel * 5);
  const hasRangerRelic  = ctx.relicLevel('ranger') >= 1;

  // Relic: Belt of the Woodlands — +1 base herb (before doubling), +1 beast per hunt
  const herbBonusBase  = hasRangerRelic ? 1 : 0;
  const beastBonusMeat = hasRangerRelic ? 1 : 0;

  if (catsEyeProcs) {
    const herbs = (computeHerbYield(moreHerbsLevel) + herbBonusBase) * bm;
    ctx.wallet.add('herb', herbs);
    ctx.stats.trackCurrencyGain('herb', herbs);
    if (rollChance(beastChance)) {
      const meat = (computeMeatYield(biggerGameLevel) + beastBonusMeat) * bm;
      ctx.wallet.add('beast', meat);
      ctx.stats.trackCurrencyGain('beast', meat);
    }
  } else {
    if (rollChance(50)) {
      const herbs = (computeHerbYield(moreHerbsLevel) + herbBonusBase) * bm;
      ctx.wallet.add('herb', herbs);
      ctx.stats.trackCurrencyGain('herb', herbs);
    } else if (rollChance(beastChance)) {
      const meat = (computeMeatYield(biggerGameLevel) + beastBonusMeat) * bm;
      ctx.wallet.add('beast', meat);
      ctx.stats.trackCurrencyGain('beast', meat);
    }
  }
  if (ctx.isJackStarved('ranger')) ctx.setJackStarved('ranger', false);
}

function jackApothecary(ctx: JackAutoClickContext): void {
  const u = ctx.upgrades;
  const hasRelic = ctx.relicLevel('apothecary') >= 1;
  const herbCost = Math.max(0, YIELDS.APOTHECARY_BREW_HERB_COST - (hasRelic ? 1 : 0));

  if (herbCost > 0 && !ctx.wallet.canAfford('herb', herbCost)) {
    if (!ctx.isJackStarved('apothecary')) {
      ctx.setJackStarved('apothecary', true);
      ctx.onPerSecondUpdate();
    }
    return;
  }
  if (ctx.isJackStarved('apothecary')) {
    ctx.setJackStarved('apothecary', false);
    ctx.onPerSecondUpdate();
  }

  const herbSaveChance = calcHerbSaveChance(u.level('POTION_TITRATION'));
  const goldPerBrew    = calcPotionMarketingGoldPerBrew(u.level('POTION_MARKETING'));

  if (herbCost > 0) ctx.wallet.remove('herb', herbCost);

  // Relic: Monocle of Perfect Theurgy — auto-dilute into 2 potions
  const bm = ctx.beadMultiplier?.('apothecary') ?? 1;
  const potionYield = (hasRelic ? 2 : 1) * bm;
  ctx.wallet.add('potion', potionYield);
  const xpYield = 1 * bm;
  ctx.wallet.add('xp', xpYield);
  ctx.stats.trackCurrencyGain('potion', potionYield);
  ctx.stats.trackCurrencyGain('xp', xpYield);
  if (goldPerBrew > 0) {
    const goldYield = goldPerBrew * bm;
    ctx.wallet.add('gold', goldYield);
    ctx.stats.trackCurrencyGain('gold', goldYield);
  }
  const herbsSaved = rollMultiChance(herbSaveChance);
  if (herbsSaved > 0) {
    ctx.wallet.add('herb', herbsSaved);
    ctx.stats.trackCurrencyGain('herb', herbsSaved);
  }
}

function jackCulinarian(ctx: JackAutoClickContext): void {
  const u = ctx.upgrades;
  const goldCost = calcCulinarianGoldCost(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'), u.level('POTION_GLIBNESS'));

  if (!ctx.wallet.canAfford('gold', goldCost)) {
    if (!ctx.isJackStarved('culinarian')) {
      ctx.setJackStarved('culinarian', true);
      ctx.onPerSecondUpdate();
    }
    return;
  }
  if (ctx.isJackStarved('culinarian')) {
    ctx.setJackStarved('culinarian', false);
    ctx.onPerSecondUpdate();
  }

  const baseSpice  = calcSpicePerClick(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'));
  // Relic: Clasp of Exquisite Taste — double effective spice at no extra cost
  const bm = ctx.beadMultiplier?.('culinarian') ?? 1;
  const spiceYield = (ctx.relicLevel('culinarian') >= 1 ? baseSpice * 2 : baseSpice) * bm;
  ctx.wallet.remove('gold', goldCost);
  ctx.wallet.add('spice', spiceYield);
  const xpYield = 1 * bm;
  ctx.wallet.add('xp', xpYield);
  ctx.stats.trackCurrencyGain('spice', spiceYield);
  ctx.stats.trackCurrencyGain('xp', xpYield);
}

function jackThief(ctx: JackAutoClickContext): void {
  // Jacks cannot act while the thief is stunned — includes mid-tick stuns
  // from an earlier jack in the same loop iteration.
  if (ctx.isThiefStunned()) return;

  const u = ctx.upgrades;
  const successChance = calcThiefSuccessChance(u.level('METICULOUS_PLANNING'));
  const sfLevel = u.level('POTION_OF_STICKY_FINGERS');
  const ppLevel = u.level('PLENTIFUL_PLUNDERING');
  const hasRelic = ctx.relicLevel('thief') >= 1;

  if (rollChance(successChance)) {
    // Base dossier range: [1, 1 + sfLevel]
    // Relic: Ring of Shadows — double both min and max
    const bm = ctx.beadMultiplier?.('thief') ?? 1;
    const dossierMin = hasRelic ? 2 : 1;
    const dossierMax = hasRelic ? 2 * (1 + sfLevel) : 1 + sfLevel;
    const dossierToAward = (dossierMax > dossierMin ? randInt(dossierMin, dossierMax) : dossierMin) * bm;
    ctx.wallet.add('dossier', dossierToAward);
    const xpYield = 1 * bm;
    ctx.wallet.add('xp', xpYield);
    ctx.stats.trackCurrencyGain('dossier', dossierToAward);
    ctx.stats.trackCurrencyGain('xp', xpYield);

    // Relic: Ring of Shadows — also steal 2 treasure per action
    if (hasRelic) {
      const treasureYield = 2 * bm;
      ctx.wallet.add('treasure', treasureYield);
      ctx.stats.trackCurrencyGain('treasure', treasureYield);
    }

    if (ppLevel > 0) {
      const bonus = Math.floor(dossierToAward) * ppLevel;
      if (bonus > 0) {
        ctx.wallet.add('gold', bonus);
        ctx.stats.trackCurrencyGain('gold', bonus);
      }
    }
  } else {
    // Stun fires once — applyThiefStun guards against extending an
    // existing stun, and subsequent jacks this tick will see
    // isThiefStunned() === true and bail out above.
    ctx.applyThiefStun();
  }
}

function jackNecromancerDefile(ctx: JackAutoClickContext): void {
  const hasRelic = ctx.relicLevel('necromancer') >= 1;
  if (!hasRelic && ctx.necromancerActiveButton() !== 'defile') return;

  const u = ctx.upgrades;
  const bm = ctx.beadMultiplier?.('necromancer') ?? 1;
  const boneMax   = calcNecromancerBoneYield(u.level('SPEAK_WITH_DEAD'));
  const boneYield = randInt(1, boneMax) * (hasRelic ? 2 : 1) * bm;
  ctx.wallet.add('bone', boneYield);
  const xpYield = 1 * bm;
  ctx.wallet.add('xp', xpYield);
  ctx.stats.trackCurrencyGain('bone', boneYield);
  ctx.stats.trackCurrencyGain('xp', xpYield);

  // Grave Looting: chance for bonus loot
  const graveLootChance = calcGraveLootingChance(u.level('GRAVE_LOOTING'));
  if (graveLootChance > 0 && rollChance(graveLootChance)) {
    const roll = Math.random();
    if (roll < YIELDS.GRAVE_LOOTING_GOLD_WEIGHT) {
      const gold = YIELDS.GRAVE_LOOTING_GOLD_AMOUNT * bm;
      ctx.wallet.add('gold', gold);
      ctx.stats.trackCurrencyGain('gold', gold);
    } else if (roll < YIELDS.GRAVE_LOOTING_GOLD_WEIGHT + YIELDS.GRAVE_LOOTING_GEM_WEIGHT) {
      const gems = YIELDS.GRAVE_LOOTING_GEM_AMOUNT * bm;
      ctx.wallet.add('gemstone', gems);
      ctx.stats.trackCurrencyGain('gemstone', gems);
    } else {
      const jewelry = YIELDS.GRAVE_LOOTING_JEWELRY_AMOUNT * bm;
      ctx.wallet.add('jewelry', jewelry);
      ctx.stats.trackCurrencyGain('jewelry', jewelry);
    }
  }

  if (ctx.isJackStarved('necromancer-defile')) ctx.setJackStarved('necromancer-defile', false);

  // Only count toward the switch when defile is the active button.
  if (ctx.necromancerActiveButton() === 'defile') ctx.necromancerDecrementClick();
}

function jackNecromancerWard(ctx: JackAutoClickContext): void {
  const hasRelic = ctx.relicLevel('necromancer') >= 1;
  // Without relic: only fire when ward is the active button.
  // With relic: always fire.
  if (!hasRelic && ctx.necromancerActiveButton() !== 'ward') return;

  const xpCost = calcNecromancerWardXpCost(ctx.upgrades.level('DARK_PACT'));
  if (!ctx.wallet.canAfford('xp', xpCost)) {
    if (!ctx.isJackStarved('necromancer-ward')) {
      ctx.setJackStarved('necromancer-ward', true);
      ctx.onPerSecondUpdate();
    }
    return;
  }
  if (ctx.isJackStarved('necromancer-ward')) {
    ctx.setJackStarved('necromancer-ward', false);
    ctx.onPerSecondUpdate();
  }

  const bm = ctx.beadMultiplier?.('necromancer') ?? 1;
  const brimstoneMax   = calcNecromancerBrimstoneYield(ctx.upgrades.level('FORTIFIED_CHALK'));
  const brimstoneYield = randInt(1, brimstoneMax) * (hasRelic ? 2 : 1) * bm;
  ctx.wallet.remove('xp', xpCost);
  ctx.wallet.add('brimstone', brimstoneYield);
  ctx.stats.trackCurrencyGain('brimstone', brimstoneYield);

  // Only count toward the switch when ward is the active button.
  if (ctx.necromancerActiveButton() === 'ward') ctx.necromancerDecrementClick();
}

// ── Merchant click ──────────────────────────────────────────

function clickMerchant(ctx: HeroActionContext): void {
  const u = ctx.upgrades;
  const bm = ctx.beadMultiplier?.('merchant') ?? 1;

  // Must have enough illicit goods to open a crate
  if (!ctx.wallet.canAfford('illicit-goods', MERCHANT_MG.GOODS_COST)) {
    const have = Math.floor(ctx.wallet.get('illicit-goods'));
    ctx.log.log(LOG_MSG.HERO.MERCHANT.NOT_ENOUGH_GOODS(
      cur('illicit-goods', MERCHANT_MG.GOODS_COST, ''),
      cur('illicit-goods', have, ''),
    ), 'warn');
    return;
  }

  ctx.wallet.remove('illicit-goods', MERCHANT_MG.GOODS_COST);

  const contrabandLevel = u.level('CONTRABAND_EXPERTISE');
  const shadyLevel      = u.level('SHADY_CONNECTIONS');
  const fencedLevel     = u.level('FENCED_GOODS');

  // Roll loot table
  let rolls = MERCHANT_MG.BASE_ROLLS;
  const bonusChance = shadyLevel * MERCHANT_MG.SHADY_CONNECTIONS_BONUS_PER_LEVEL;
  if (bonusChance > 0 && rollChance(bonusChance)) rolls++;

  const lootMap = new Map<string, number>();
  for (let i = 0; i < rolls; i++) {
    const result = rollIllicitLootTable(contrabandLevel);
    if (result) {
      const amount = Math.round(result.amount * bm);
      lootMap.set(result.currencyId, (lootMap.get(result.currencyId) ?? 0) + amount);
    }
  }

  // Award loot
  const parts: string[] = [];
  for (const [currencyId, amount] of lootMap) {
    ctx.wallet.add(currencyId, amount);
    ctx.stats.trackCurrencyGain(currencyId, amount);
    parts.push(cur(currencyId, amount));

    // Unlock rare currencies on first discovery
    if (currencyId === 'monster-trophy' && !ctx.wallet.isCurrencyUnlocked('monster-trophy')) {
      ctx.wallet.unlockCurrency('monster-trophy');
      ctx.log.log(LOG_MSG.MG_MERCHANT.TROPHY_UNLOCKED, 'rare');
    }
    if (currencyId === 'forbidden-tome' && !ctx.wallet.isCurrencyUnlocked('forbidden-tome')) {
      ctx.wallet.unlockCurrency('forbidden-tome');
      ctx.log.log(LOG_MSG.MG_MERCHANT.TOME_UNLOCKED, 'rare');
    }
    if (currencyId === 'magical-implement' && !ctx.wallet.isCurrencyUnlocked('magical-implement')) {
      ctx.wallet.unlockCurrency('magical-implement');
      ctx.log.log(LOG_MSG.MG_MERCHANT.IMPLEMENT_UNLOCKED, 'rare');
    }
  }

  // XP reward
  const xp = MERCHANT_MG.XP_REWARD * bm;
  ctx.wallet.add('xp', xp);
  ctx.stats.trackCurrencyGain('xp', xp);
  parts.push(cur('xp', xp));

  // Fenced Goods — bonus gold
  const fencedGold = calcMerchantFencedGold(fencedLevel) * bm;
  if (fencedGold > 0) {
    ctx.wallet.add('gold', fencedGold);
    ctx.stats.trackCurrencyGain('gold', fencedGold);
    parts.push(cur('gold', fencedGold));
  }

  if (parts.length > 0) {
    ctx.log.log(LOG_MSG.MG_MERCHANT.OPEN_RESULT(parts.join(', ')));
  } else {
    ctx.log.log(LOG_MSG.MG_MERCHANT.OPEN_NOTHING);
  }
}

// ── Merchant jack ───────────────────────────────────────────

function jackMerchant(ctx: JackAutoClickContext): void {
  const u = ctx.upgrades;
  const bm = ctx.beadMultiplier?.('merchant') ?? 1;
  const hasRelic = ctx.relicLevel('merchant') >= 1;

  // Must have enough illicit goods to open a crate
  if (!ctx.wallet.canAfford('illicit-goods', MERCHANT_MG.GOODS_COST)) {
    if (!ctx.isJackStarved('merchant')) {
      ctx.setJackStarved('merchant', true);
      ctx.onPerSecondUpdate();
    }
    return;
  }
  if (ctx.isJackStarved('merchant')) {
    ctx.setJackStarved('merchant', false);
    ctx.onPerSecondUpdate();
  }

  ctx.wallet.remove('illicit-goods', MERCHANT_MG.GOODS_COST);

  const contrabandLevel = u.level('CONTRABAND_EXPERTISE');
  const shadyLevel      = u.level('SHADY_CONNECTIONS');
  const fencedLevel     = u.level('FENCED_GOODS');

  // Roll loot table
  let rolls = MERCHANT_MG.BASE_ROLLS;
  const bonusChance = shadyLevel * MERCHANT_MG.SHADY_CONNECTIONS_BONUS_PER_LEVEL;
  if (bonusChance > 0 && rollChance(bonusChance)) rolls++;

  // Relic: Ledger of Infinite Commerce — double loot rolls
  if (hasRelic) rolls *= 2;

  for (let i = 0; i < rolls; i++) {
    const result = rollIllicitLootTable(contrabandLevel);
    if (result) {
      const amount = Math.round(result.amount * bm);
      ctx.wallet.add(result.currencyId, amount);
      ctx.stats.trackCurrencyGain(result.currencyId, amount);
    }
  }

  // XP reward
  const xp = MERCHANT_MG.XP_REWARD * bm;
  ctx.wallet.add('xp', xp);
  ctx.stats.trackCurrencyGain('xp', xp);

  // Fenced Goods — bonus gold
  const fencedGold = calcMerchantFencedGold(fencedLevel) * bm;
  if (fencedGold > 0) {
    ctx.wallet.add('gold', fencedGold);
    ctx.stats.trackCurrencyGain('gold', fencedGold);
  }
}

