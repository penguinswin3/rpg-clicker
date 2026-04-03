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
import { YIELDS } from '../game-config';
import { CURRENCY_FLAVOR } from '../flavor-text';
import { rollChance, rollMultiChance, randInt } from '../utils/mathUtils';
import {
  calcGoldPerClick, calcXpPerBounty,
  calcBeastFindChance, computeHerbYield, computeMeatYield,
  calcHerbSaveChance, calcPotionMarketingGoldPerBrew,
  calcSpicePerClick, calcCulinarianGoldCost,
  calcThiefSuccessChance,
} from './yield-helpers';

// ── Contexts ────────────────────────────────────────────────

/** Shared dependency bag for all hero click handlers. */
export interface HeroActionContext {
  wallet:                 WalletService;
  log:                    ActivityLogService;
  upgrades:               UpgradeService;
  wholesaleSpicesEnabled: boolean;
  /** Current thief stun state (needed by clickThief). */
  isThiefStunned:         boolean;
  /** Callback to apply stun on a failed thief break-in. */
  applyThiefStun:         () => void;
}

/**
 * Dependency bag for jack auto-clicks.
 * Uses **function-based** getters for mutable state that can
 * change within a single tick (multiple jacks fire sequentially).
 */
export interface JackAutoClickContext {
  wallet:                 WalletService;
  upgrades:               UpgradeService;
  wholesaleSpicesEnabled: boolean;
  /** Live check — may change after a thief jack triggers a stun. */
  isThiefStunned:         () => boolean;
  applyThiefStun:         () => void;
  /** Per-character starvation flag (true = starved). */
  isJackStarved:          (charId: string) => boolean;
  setJackStarved:         (charId: string, starved: boolean) => void;
  /** Called when starvation state changes so per-second rates refresh. */
  onPerSecondUpdate:      () => void;
}

// ── Hero click dispatch ─────────────────────────────────────

/** Route a hero-button click to the correct character handler. */
export function dispatchHeroClick(charId: string, ctx: HeroActionContext): void {
  switch (charId) {
    case 'fighter':    return clickFighter(ctx);
    case 'ranger':     return clickRanger(ctx);
    case 'apothecary': return clickApothecary(ctx);
    case 'culinarian': return clickCulinarian(ctx);
    case 'thief':      return clickThief(ctx);
  }
}

// ── Individual hero clicks ──────────────────────────────────

function clickFighter(ctx: HeroActionContext): void {
  const goldPerClick = calcGoldPerClick(ctx.upgrades.level('BETTER_BOUNTIES'));
  const xpPerBounty  = calcXpPerBounty(ctx.upgrades.level('INSIGHTFUL_CONTRACTS'));
  ctx.wallet.add('gold', goldPerClick);
  ctx.wallet.add('xp',   xpPerBounty);
  ctx.log.log(`You ventured forth and found ${goldPerClick} gold. (+${xpPerBounty} XP)`);
}

function clickRanger(ctx: HeroActionContext): void {
  const u = ctx.upgrades;
  ctx.wallet.add('xp', 1);

  const moreHerbsLevel  = u.level('MORE_HERBS');
  const biggerGameLevel = u.level('BIGGER_GAME');
  const beastChance     = calcBeastFindChance(u.level('BETTER_TRACKING'));
  const catsEyeLevel    = u.level('POTION_CATS_EYE');
  const catsEyeProcs    = catsEyeLevel > 0 && rollChance(catsEyeLevel);

  if (catsEyeProcs) {
    const herbs    = computeHerbYield(moreHerbsLevel);
    const gotBeast = rollChance(beastChance);
    ctx.wallet.add('herb', herbs);
    if (gotBeast) {
      const meat = computeMeatYield(biggerGameLevel);
      ctx.wallet.add('beast', meat);
      ctx.log.log(`Cat's Eye! You foraged ${herbs} herb(s) AND hunted a beast! (+${meat} meat, +1 XP)`, 'success');
    } else {
      ctx.log.log(`Cat's Eye! You foraged ${herbs} herb(s), but the beast escaped. (+1 XP)`, 'success');
    }
  } else {
    const targetHerb = rollChance(50);
    if (targetHerb) {
      const herbs = computeHerbYield(moreHerbsLevel);
      ctx.wallet.add('herb', herbs);
      ctx.log.log(`You targeted herbs and foraged ${herbs} herb(s). (+1 XP)`);
    } else {
      const gotBeast = rollChance(beastChance);
      if (gotBeast) {
        const meat = computeMeatYield(biggerGameLevel);
        ctx.wallet.add('beast', meat);
        ctx.log.log(`You tracked a beast and claimed its meat. (+${meat} meat, +1 XP)`);
      } else {
        ctx.log.log(`You targeted a beast but it escaped. (+1 XP)`);
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
    ctx.log.log(`Not enough herbs to brew. Need ${herbCost}, have ${have}.`, 'warn');
    return;
  }
  ctx.wallet.remove('herb', herbCost);
  ctx.wallet.add('potion', 1);
  ctx.wallet.add('xp', 1);
  if (goldPerBrew > 0) ctx.wallet.add('gold', goldPerBrew);

  const herbsSaved = rollMultiChance(herbSaveChance);
  if (herbsSaved > 0) {
    ctx.wallet.add('herb', herbsSaved);
    ctx.log.log(`You brewed a potion and recovered ${herbsSaved} herb${herbsSaved > 1 ? 's' : ''}! (+1 XP)`, 'success');
  } else {
    ctx.log.log(`You brewed a potion from ${herbCost} herbs. (+1 XP)`);
  }
}

function clickCulinarian(ctx: HeroActionContext): void {
  const u = ctx.upgrades;
  const goldCost   = calcCulinarianGoldCost(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'), u.level('POTION_GLIBNESS'));
  const spiceYield = calcSpicePerClick(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'));

  if (!ctx.wallet.canAfford('gold', goldCost)) {
    const have = Math.floor(ctx.wallet.get('gold'));
    ctx.log.log(`Not enough gold to gather spices. Need ${goldCost}g, have ${have}g.`, 'warn');
    return;
  }
  ctx.wallet.remove('gold', goldCost);
  ctx.wallet.add('spice', spiceYield);
  ctx.wallet.add('xp', 1);
  ctx.log.log(`You sourced exotic spices. (−${goldCost}g, +${spiceYield}${CURRENCY_FLAVOR.spice.symbol}, +1 XP)`);
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

    if (ppLevel > 0) {
      // NOTE: gold bonus uses an independent roll — intentional double-roll.
      const dossiers = randInt(1, 1 + sfLevel);
      const bonus = dossiers * ppLevel;
      if (bonus > 0) ctx.wallet.add('gold', bonus);
      ctx.log.log(
        `You slipped in undetected and secured ${dossierYield === 1 ? 'a dossier' : `${dossierYield} dossiers`}. (+1 XP, +${bonus}g)`,
        'default',
      );
    } else {
      ctx.log.log(
        `You slipped in undetected and secured ${dossierYield === 1 ? 'a dossier' : `${dossierYield} dossiers`}. (+1 XP)`,
        'default',
      );
    }
  } else {
    ctx.applyThiefStun();
    ctx.log.log(`You were spotted! Retreating for ${YIELDS.THIEF_STUN_DURATION_MS / 1000} seconds...`, 'warn');
  }
}

// ── Jack auto-click dispatch ────────────────────────────────

/** Execute one jack auto-click for the given character. */
export function performJackAutoClick(charId: string, ctx: JackAutoClickContext): void {
  switch (charId) {
    case 'fighter':    return jackFighter(ctx);
    case 'ranger':     return jackRanger(ctx);
    case 'apothecary': return jackApothecary(ctx);
    case 'culinarian': return jackCulinarian(ctx);
    case 'thief':      return jackThief(ctx);
  }
}

// ── Jack per-character logic ────────────────────────────────

function jackFighter(ctx: JackAutoClickContext): void {
  const goldPerClick = calcGoldPerClick(ctx.upgrades.level('BETTER_BOUNTIES'));
  const xpPerBounty  = calcXpPerBounty(ctx.upgrades.level('INSIGHTFUL_CONTRACTS'));
  ctx.wallet.add('gold', goldPerClick);
  ctx.wallet.add('xp',   xpPerBounty);
  if (ctx.isJackStarved('fighter')) ctx.setJackStarved('fighter', false);
}

function jackRanger(ctx: JackAutoClickContext): void {
  const u = ctx.upgrades;
  ctx.wallet.add('xp', 1);

  const moreHerbsLevel  = u.level('MORE_HERBS');
  const biggerGameLevel = u.level('BIGGER_GAME');
  const beastChance     = calcBeastFindChance(u.level('BETTER_TRACKING'));
  const catsEyeLevel    = u.level('POTION_CATS_EYE');
  const catsEyeProcs    = catsEyeLevel > 0 && rollChance(catsEyeLevel);

  if (catsEyeProcs) {
    ctx.wallet.add('herb', computeHerbYield(moreHerbsLevel));
    if (rollChance(beastChance)) ctx.wallet.add('beast', computeMeatYield(biggerGameLevel));
  } else {
    if (rollChance(50)) {
      ctx.wallet.add('herb', computeHerbYield(moreHerbsLevel));
    } else if (rollChance(beastChance)) {
      ctx.wallet.add('beast', computeMeatYield(biggerGameLevel));
    }
  }
  if (ctx.isJackStarved('ranger')) ctx.setJackStarved('ranger', false);
}

function jackApothecary(ctx: JackAutoClickContext): void {
  const u = ctx.upgrades;
  const herbCost = YIELDS.APOTHECARY_BREW_HERB_COST;

  if (!ctx.wallet.canAfford('herb', herbCost)) {
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

  ctx.wallet.remove('herb', herbCost);
  ctx.wallet.add('potion', 1);
  ctx.wallet.add('xp', 1);
  if (goldPerBrew > 0) ctx.wallet.add('gold', goldPerBrew);
  const herbsSaved = rollMultiChance(herbSaveChance);
  if (herbsSaved > 0) ctx.wallet.add('herb', herbsSaved);
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

  const spiceYield = calcSpicePerClick(ctx.wholesaleSpicesEnabled, u.level('WHOLESALE_SPICES'));
  ctx.wallet.remove('gold', goldCost);
  ctx.wallet.add('spice', spiceYield);
  ctx.wallet.add('xp', 1);
}

function jackThief(ctx: JackAutoClickContext): void {
  // Jacks cannot act while the thief is stunned — includes mid-tick stuns
  // from an earlier jack in the same loop iteration.
  if (ctx.isThiefStunned()) return;

  const u = ctx.upgrades;
  const successChance = calcThiefSuccessChance(u.level('METICULOUS_PLANNING'));
  const sfLevel = u.level('POTION_OF_STICKY_FINGERS');
  const ppLevel = u.level('PLENTIFUL_PLUNDERING');

  if (rollChance(successChance)) {
    const dossierToAward = randInt(1, 1 + sfLevel);
    ctx.wallet.add('dossier', dossierToAward);
    ctx.wallet.add('xp', 1);
    if (ppLevel > 0) {
      const bonus = Math.floor(dossierToAward) * ppLevel;
      if (bonus > 0) ctx.wallet.add('gold', bonus);
    }
  } else {
    // Stun fires once — applyThiefStun guards against extending an
    // existing stun, and subsequent jacks this tick will see
    // isThiefStunned() === true and bail out above.
    ctx.applyThiefStun();
  }
}

