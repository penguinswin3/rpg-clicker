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
import { YIELDS } from '../game-config';
import { CURRENCY_FLAVOR, cur } from '../flavor-text';
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
}

// ── Hero click dispatch ─────────────────────────────────────

/** Route a hero-button click to the correct character handler. */
export function dispatchHeroClick(charId: string, ctx: HeroActionContext): void {
  ctx.stats.trackManualHeroPress(charId);
  switch (charId) {
    case 'fighter':    return clickFighter(ctx);
    case 'ranger':     return clickRanger(ctx);
    case 'apothecary': return clickApothecary(ctx);
    case 'culinarian': return clickCulinarian(ctx);
    case 'thief':      return clickThief(ctx);
    case 'artisan':    return clickArtisan(ctx);
    case 'necromancer': return clickNecromancer(ctx);
  }
}

// ── Individual hero clicks ──────────────────────────────────

function clickFighter(ctx: HeroActionContext): void {
  const goldPerClick = calcGoldPerClick(ctx.upgrades.level('BETTER_BOUNTIES'));
  const xpPerBounty  = calcXpPerBounty(ctx.upgrades.level('INSIGHTFUL_CONTRACTS'));
  ctx.wallet.add('gold', goldPerClick);
  ctx.wallet.add('xp',   xpPerBounty);
  ctx.stats.trackCurrencyGain('gold', goldPerClick);
  ctx.stats.trackCurrencyGain('xp', xpPerBounty);
  ctx.log.log(`You ventured forth and found gold. (${cur('gold', goldPerClick)}, ${cur('xp', xpPerBounty)})`);
}

function clickRanger(ctx: HeroActionContext): void {
  const u = ctx.upgrades;
  ctx.wallet.add('xp', 1);
  ctx.stats.trackCurrencyGain('xp', 1);

  const moreHerbsLevel  = u.level('MORE_HERBS');
  const biggerGameLevel = u.level('BIGGER_GAME');
  const beastChance     = calcBeastFindChance(u.level('BETTER_TRACKING'));
  const catsEyeLevel    = u.level('POTION_CATS_EYE');
  const catsEyeProcs    = catsEyeLevel > 0 && rollChance(catsEyeLevel);

  if (catsEyeProcs) {
    const herbs    = computeHerbYield(moreHerbsLevel);
    const gotBeast = rollChance(beastChance);
    ctx.wallet.add('herb', herbs);
    ctx.stats.trackCurrencyGain('herb', herbs);
    if (gotBeast) {
      const meat = computeMeatYield(biggerGameLevel);
      ctx.wallet.add('beast', meat);
      ctx.stats.trackCurrencyGain('beast', meat);
      ctx.log.log(`Cat's Eye! You foraged herbs AND hunted a beast! (${cur('herb', herbs)}, ${cur('beast', meat)}, ${cur('xp', 1)})`, 'success');
    } else {
      ctx.log.log(`Cat's Eye! You foraged herbs, but the beast escaped. (${cur('herb', herbs)}, ${cur('xp', 1)})`, 'success');
    }
  } else {
    const targetHerb = rollChance(50);
    if (targetHerb) {
      const herbs = computeHerbYield(moreHerbsLevel);
      ctx.wallet.add('herb', herbs);
      ctx.stats.trackCurrencyGain('herb', herbs);
      ctx.log.log(`You targeted herbs and foraged some. (${cur('herb', herbs)}, ${cur('xp', 1)})`);
    } else {
      const gotBeast = rollChance(beastChance);
      if (gotBeast) {
        const meat = computeMeatYield(biggerGameLevel);
        ctx.wallet.add('beast', meat);
        ctx.stats.trackCurrencyGain('beast', meat);
        ctx.log.log(`You tracked a beast and claimed its meat. (${cur('beast', meat)}, ${cur('xp', 1)})`);
      } else {
        ctx.log.log(`You targeted a beast but it escaped. (${cur('xp', 1)})`);
      }
    }
  }
}

function clickApothecary(ctx: HeroActionContext): void {
  const u = ctx.upgrades;
  const herbCost       = YIELDS.APOTHECARY_BREW_HERB_COST;
  const herbSaveChance = calcHerbSaveChance(u.level('POTION_TITRATION'));
  const goldPerBrew    = calcPotionMarketingGoldPerBrew(u.level('POTION_MARKETING'));

  if (!ctx.wallet.canAfford('herb', herbCost)) {
    const have = Math.floor(ctx.wallet.get('herb'));
    ctx.log.log(`Not enough herbs to brew. Need ${cur('herb', herbCost, '')}, have ${cur('herb', have, '')}.`, 'warn');
    return;
  }
  ctx.wallet.remove('herb', herbCost);
  ctx.wallet.add('potion', 1);
  ctx.wallet.add('xp', 1);
  ctx.stats.trackCurrencyGain('potion', 1);
  ctx.stats.trackCurrencyGain('xp', 1);
  if (goldPerBrew > 0) {
    ctx.wallet.add('gold', goldPerBrew);
    ctx.stats.trackCurrencyGain('gold', goldPerBrew);
  }

  const herbsSaved = rollMultiChance(herbSaveChance);
  if (herbsSaved > 0) {
    ctx.wallet.add('herb', herbsSaved);
    ctx.stats.trackCurrencyGain('herb', herbsSaved);
    ctx.log.log(`You brewed a potion and recovered herbs! (${cur('potion', 1)}, ${cur('herb', herbsSaved)}, ${cur('xp', 1)})`, 'success');
  } else {
    ctx.log.log(`You brewed a potion. (${cur('potion', 1)}, ${cur('xp', 1)})`);
  }
}

function clickCulinarian(ctx: HeroActionContext): void {
  const u = ctx.upgrades;
  const goldCost   = calcCulinarianGoldCost(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'), u.level('POTION_GLIBNESS'));
  const spiceYield = calcSpicePerClick(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'));

  if (!ctx.wallet.canAfford('gold', goldCost)) {
    const have = Math.floor(ctx.wallet.get('gold'));
    ctx.log.log(`Not enough gold to gather spices. Need ${cur('gold', goldCost, '')}, have ${cur('gold', have, '')}.`, 'warn');
    return;
  }
  ctx.wallet.remove('gold', goldCost);
  ctx.wallet.add('spice', spiceYield);
  ctx.wallet.add('xp', 1);
  ctx.stats.trackCurrencyGain('spice', spiceYield);
  ctx.stats.trackCurrencyGain('xp', 1);
  ctx.log.log(`You sourced exotic spices. (${cur('gold', goldCost, '-')}, ${cur('spice', spiceYield)}, ${cur('xp', 1)})`);
}

function clickThief(ctx: HeroActionContext): void {
  if (ctx.isThiefStunned) return;

  const u = ctx.upgrades;
  const successChance = calcThiefSuccessChance(u.level('METICULOUS_PLANNING'));
  const sfLevel = u.level('POTION_OF_STICKY_FINGERS');
  const ppLevel = u.level('PLENTIFUL_PLUNDERING');

  if (rollChance(successChance)) {
    const dossierYield = sfLevel > 0 ? randInt(1, 1 + sfLevel) : 1;
    ctx.wallet.add('dossier', dossierYield);
    ctx.wallet.add('xp', 1);
    ctx.stats.trackCurrencyGain('dossier', dossierYield);
    ctx.stats.trackCurrencyGain('xp', 1);

    if (ppLevel > 0) {
      // NOTE: gold bonus uses an independent roll — intentional double-roll.
      const dossiers = randInt(1, 1 + sfLevel);
      const bonus = dossiers * ppLevel;
      if (bonus > 0) {
        ctx.wallet.add('gold', bonus);
        ctx.stats.trackCurrencyGain('gold', bonus);
      }
      ctx.log.log(
        `You slipped in undetected and secured some dossier. (${cur('dossier', dossierYield)}, ${cur('xp', 1)}, ${cur('gold', bonus)})`,
        'default',
      );
    } else {
      ctx.log.log(
        `You slipped in undetected and secured some dossier. (${cur('dossier', dossierYield)}, ${cur('xp', 1)})`,
        'default',
      );
    }
  } else {
    ctx.applyThiefStun();
    ctx.log.log(`You were spotted! Retreating for ${YIELDS.THIEF_STUN_DURATION_MS / 1000} seconds...`, 'warn');
  }
}

function clickArtisan(ctx: HeroActionContext): void {
  if (ctx.isArtisanTimerActive) return;

  const treasureCost = calcArtisanTreasureCost();
  if (!ctx.wallet.canAfford('treasure', treasureCost)) {
    const have = Math.floor(ctx.wallet.get('treasure'));
    ctx.log.log(`Not enough treasure to appraise. Need ${cur('treasure', treasureCost, '')}, have ${cur('treasure', have, '')}.`, 'warn');
    return;
  }
  ctx.wallet.remove('treasure', treasureCost);
  ctx.startArtisanTimer(1);
  ctx.log.log(`Appraisal started... (${cur('treasure', treasureCost, '-')})`);
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
  const boneYield = randInt(1, calcNecromancerBoneYield(u.level('SPEAK_WITH_DEAD')));
  ctx.wallet.add('bone', boneYield);
  ctx.wallet.add('xp', 1);
  ctx.stats.trackCurrencyGain('bone', boneYield);
  ctx.stats.trackCurrencyGain('xp', 1);

  // Grave Looting: chance to find bonus loot (Gold, Gems, or Jewelry)
  const graveLootChance = calcGraveLootingChance(u.level('GRAVE_LOOTING'));
  if (graveLootChance > 0 && rollChance(graveLootChance)) {
    const roll = Math.random();
    if (roll < YIELDS.GRAVE_LOOTING_GOLD_WEIGHT) {
      const gold = YIELDS.GRAVE_LOOTING_GOLD_AMOUNT;
      ctx.wallet.add('gold', gold);
      ctx.stats.trackCurrencyGain('gold', gold);
      ctx.log.log(`You defiled the earth and unearthed bones — and found buried gold! (${cur('bone', boneYield)}, ${cur('gold', gold)}, ${cur('xp', 1)})`, 'success');
    } else if (roll < YIELDS.GRAVE_LOOTING_GOLD_WEIGHT + YIELDS.GRAVE_LOOTING_GEM_WEIGHT) {
      const gems = YIELDS.GRAVE_LOOTING_GEM_AMOUNT;
      ctx.wallet.add('gemstone', gems);
      ctx.stats.trackCurrencyGain('gemstone', gems);
      ctx.log.log(`You defiled the earth and unearthed bones — adorned with gemstones! (${cur('bone', boneYield)}, ${cur('gemstone', gems)}, ${cur('xp', 1)})`, 'success');
    } else {
      const jewelry = YIELDS.GRAVE_LOOTING_JEWELRY_AMOUNT;
      ctx.wallet.add('jewelry', jewelry);
      ctx.stats.trackCurrencyGain('jewelry', jewelry);
      ctx.log.log(`You defiled the earth and unearthed bones — and uncovered jewelry! (${cur('bone', boneYield)}, ${cur('jewelry', jewelry)}, ${cur('xp', 1)})`, 'success');
    }
  } else {
    ctx.log.log(`You defiled the earth and unearthed bones. (${cur('bone', boneYield)}, ${cur('xp', 1)})`);
  }
}

function clickNecromancerWard(ctx: HeroActionContext): void {
  const u = ctx.upgrades;
  const xpCost = calcNecromancerWardXpCost(u.level('DARK_PACT'));
  if (!ctx.wallet.canAfford('xp', xpCost)) {
    const have = Math.floor(ctx.wallet.get('xp'));
    ctx.log.log(`Not enough XP to ward. Need ${cur('xp', xpCost, '')}, have ${cur('xp', have, '')}.`, 'warn');
    return;
  }
  const brimstoneMax   = calcNecromancerBrimstoneYield(u.level('FORTIFIED_CHALK'));
  const brimstoneYield = randInt(1, brimstoneMax);
  ctx.wallet.remove('xp', xpCost);
  ctx.wallet.add('brimstone', brimstoneYield);
  ctx.stats.trackCurrencyGain('brimstone', brimstoneYield);
  ctx.log.log(`You warded the veil and conjured brimstone. (${cur('xp', xpCost, '-')}, ${cur('brimstone', brimstoneYield)})`);
}

// ── Jack auto-click dispatch ────────────────────────────────

/** Execute one jack auto-click for the given character. */
export function performJackAutoClick(charId: string, ctx: JackAutoClickContext): void {
  // Normalize necromancer sub-keys to 'necromancer' for stats tracking
  const statsCharId = charId.startsWith('necromancer') ? 'necromancer' : charId;
  ctx.stats.trackJackHeroPress(statsCharId);
  switch (charId) {
    case 'fighter':            return jackFighter(ctx);
    case 'ranger':             return jackRanger(ctx);
    case 'apothecary':         return jackApothecary(ctx);
    case 'culinarian':         return jackCulinarian(ctx);
    case 'thief':              return jackThief(ctx);
    // Artisan jacks are handled as a batch in app.component (shared timer).
    case 'artisan':            return;
    case 'necromancer-defile': return jackNecromancerDefile(ctx);
    case 'necromancer-ward':   return jackNecromancerWard(ctx);
  }
}

// ── Jack per-character logic ────────────────────────────────

function jackFighter(ctx: JackAutoClickContext): void {
  const goldPerClick = calcGoldPerClick(ctx.upgrades.level('BETTER_BOUNTIES'));
  const xpPerBounty  = calcXpPerBounty(ctx.upgrades.level('INSIGHTFUL_CONTRACTS'));
  ctx.wallet.add('gold', goldPerClick);
  ctx.wallet.add('xp',   xpPerBounty);
  ctx.stats.trackCurrencyGain('gold', goldPerClick);
  ctx.stats.trackCurrencyGain('xp', xpPerBounty);

  // Relic: Crown of Hireling Command — each jack also generates hireling gold
  if (ctx.relicLevel('fighter') >= 1) {
    const hirelingGold = calcAutoGoldPerSecond(
      ctx.upgrades.level('CONTRACTED_HIRELINGS'),
      ctx.upgrades.level('HIRELINGS_HIRELINGS'),
    );
    if (hirelingGold > 0) {
      ctx.wallet.add('gold', hirelingGold);
      ctx.stats.trackCurrencyGain('gold', hirelingGold);
    }
  }

  if (ctx.isJackStarved('fighter')) ctx.setJackStarved('fighter', false);
}

function jackRanger(ctx: JackAutoClickContext): void {
  const u = ctx.upgrades;
  ctx.wallet.add('xp', 1);
  ctx.stats.trackCurrencyGain('xp', 1);

  const moreHerbsLevel  = u.level('MORE_HERBS');
  const biggerGameLevel = u.level('BIGGER_GAME');
  const beastChance     = calcBeastFindChance(u.level('BETTER_TRACKING'));
  const catsEyeLevel    = u.level('POTION_CATS_EYE');
  const catsEyeProcs    = catsEyeLevel > 0 && rollChance(catsEyeLevel);
  const hasRangerRelic  = ctx.relicLevel('ranger') >= 1;

  // Relic: Belt of the Woodlands — +1 base herb (before doubling), +1 beast per hunt
  const herbBonusBase  = hasRangerRelic ? 1 : 0;
  const beastBonusMeat = hasRangerRelic ? 1 : 0;

  if (catsEyeProcs) {
    const herbs = computeHerbYield(moreHerbsLevel) + herbBonusBase;
    ctx.wallet.add('herb', herbs);
    ctx.stats.trackCurrencyGain('herb', herbs);
    if (rollChance(beastChance)) {
      const meat = computeMeatYield(biggerGameLevel) + beastBonusMeat;
      ctx.wallet.add('beast', meat);
      ctx.stats.trackCurrencyGain('beast', meat);
    }
  } else {
    if (rollChance(50)) {
      const herbs = computeHerbYield(moreHerbsLevel) + herbBonusBase;
      ctx.wallet.add('herb', herbs);
      ctx.stats.trackCurrencyGain('herb', herbs);
    } else if (rollChance(beastChance)) {
      const meat = computeMeatYield(biggerGameLevel) + beastBonusMeat;
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
  const potionYield = hasRelic ? 2 : 1;
  ctx.wallet.add('potion', potionYield);
  ctx.wallet.add('xp', 1);
  ctx.stats.trackCurrencyGain('potion', potionYield);
  ctx.stats.trackCurrencyGain('xp', 1);
  if (goldPerBrew > 0) {
    ctx.wallet.add('gold', goldPerBrew);
    ctx.stats.trackCurrencyGain('gold', goldPerBrew);
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
  const spiceYield = ctx.relicLevel('culinarian') >= 1 ? baseSpice * 2 : baseSpice;
  ctx.wallet.remove('gold', goldCost);
  ctx.wallet.add('spice', spiceYield);
  ctx.wallet.add('xp', 1);
  ctx.stats.trackCurrencyGain('spice', spiceYield);
  ctx.stats.trackCurrencyGain('xp', 1);
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
    const dossierMin = hasRelic ? 2 : 1;
    const dossierMax = hasRelic ? 2 * (1 + sfLevel) : 1 + sfLevel;
    const dossierToAward = dossierMax > dossierMin ? randInt(dossierMin, dossierMax) : dossierMin;
    ctx.wallet.add('dossier', dossierToAward);
    ctx.wallet.add('xp', 1);
    ctx.stats.trackCurrencyGain('dossier', dossierToAward);
    ctx.stats.trackCurrencyGain('xp', 1);

    // Relic: Ring of Shadows — also steal 2 treasure per action
    if (hasRelic) {
      ctx.wallet.add('treasure', 2);
      ctx.stats.trackCurrencyGain('treasure', 2);
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
  // Without relic: only fire when defile is the active button.
  // With relic: always fire.
  if (!hasRelic && ctx.necromancerActiveButton() !== 'defile') return;

  const u = ctx.upgrades;
  const boneMax   = calcNecromancerBoneYield(u.level('SPEAK_WITH_DEAD'));
  const boneYield = randInt(1, boneMax) * (hasRelic ? 2 : 1);
  ctx.wallet.add('bone', boneYield);
  ctx.wallet.add('xp', 1);
  ctx.stats.trackCurrencyGain('bone', boneYield);
  ctx.stats.trackCurrencyGain('xp', 1);

  // Grave Looting: chance for bonus loot
  const graveLootChance = calcGraveLootingChance(u.level('GRAVE_LOOTING'));
  if (graveLootChance > 0 && rollChance(graveLootChance)) {
    const roll = Math.random();
    if (roll < YIELDS.GRAVE_LOOTING_GOLD_WEIGHT) {
      const gold = YIELDS.GRAVE_LOOTING_GOLD_AMOUNT;
      ctx.wallet.add('gold', gold);
      ctx.stats.trackCurrencyGain('gold', gold);
    } else if (roll < YIELDS.GRAVE_LOOTING_GOLD_WEIGHT + YIELDS.GRAVE_LOOTING_GEM_WEIGHT) {
      const gems = YIELDS.GRAVE_LOOTING_GEM_AMOUNT;
      ctx.wallet.add('gemstone', gems);
      ctx.stats.trackCurrencyGain('gemstone', gems);
    } else {
      const jewelry = YIELDS.GRAVE_LOOTING_JEWELRY_AMOUNT;
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

  const brimstoneMax   = calcNecromancerBrimstoneYield(ctx.upgrades.level('FORTIFIED_CHALK'));
  const brimstoneYield = randInt(1, brimstoneMax) * (hasRelic ? 2 : 1);
  ctx.wallet.remove('xp', xpCost);
  ctx.wallet.add('brimstone', brimstoneYield);
  ctx.stats.trackCurrencyGain('brimstone', brimstoneYield);

  // Only count toward the switch when ward is the active button.
  if (ctx.necromancerActiveButton() === 'ward') ctx.necromancerDecrementClick();
}
