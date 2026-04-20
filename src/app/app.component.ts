import { Component, HostListener, inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ActivityLogComponent } from './activity-log/activity-log.component';
import { ActivityLogService } from './activity-log/activity-log.service';
import { WalletSidebarComponent } from './wallet/wallet-sidebar.component';
import { WalletService } from './wallet/wallet.service';
import { CharacterSidebarComponent, HeroStat } from './character/character-sidebar.component';
import { CharacterUnlockComponent } from './character/character-unlock.component';
import { CharacterService } from './character/character.service';
import { MinigamePanelComponent } from './minigame/minigame-panel.component';
import { OptionsMenuComponent } from './options/options-menu.component';
import { StatisticsComponent } from './statistics/statistics.component';
import { SaveService, UpgradeState, FighterCombatState } from './options/save.service';
import { StatisticsService } from './statistics/statistics.service';
import { UpgradeService, UpgradeCategory } from './upgrade/upgrade.service';
import { XP_THRESHOLDS, YIELDS, GLOBAL_PURCHASE_DEFS, getActiveCosts, getGlobalDef, FAMILIAR, JACKD_UP_SPEED_MULT, BEADS, BEAD_SLOT_ORDER, BeadSlotState, BeadType, GOLD2_CONDITIONS, GOOD_AUTO_SOLVE, SLAYER } from './game-config';
import { UPGRADE_FLAVOR, CURRENCY_FLAVOR, UPGRADE_COLORS, cur, CHARACTER_FLAVOR, BEAD_FLAVOR, BEAD_COLORS, BEAD_SYMBOL, HERO_PRESS_PULSE_COLOR, LOG_MSG } from './flavor-text';
import { fmtNumber, clamp } from './utils/mathUtils';

// ── Extracted hero helpers ─────────────────────────────────────
import { calcAutoGoldPerSecond, calcBeastFindChance, calcCulinarianGoldCost, calcBaitedTrapsBeastPerTick, calcHovelGardenHerbPerTick, calcArtisanTreasureCost, calcArtisanTimerMs, calcArtisanGemstoneYield, calcArtisanMetalYield, calcArtisanGemstoneYieldJack, calcArtisanMetalYieldJack, rollNecromancerSwitchClicks, calcSharperNeedlesThreadPerSec } from './hero/yield-helpers';
import { buildHeroStats, getQuestBtnLabel } from './hero/hero-stats';
import { dispatchHeroClick, performJackAutoClick, HeroActionContext, JackAutoClickContext } from './hero/hero-actions';
import { calculatePerSecondRates, calculatePerSecondBreakdown } from './hero/per-second-calculator';
import {
  calculateJackCosts, isJacksVisible, getJacksToPurchase,
  canAffordJackCosts, getJacksPoolFree, getJacksMax,
  isActiveCharJackStarved, getJackStarvedMessage, JackCostEntry,
} from './hero/jack-calculator';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ActivityLogComponent,
    WalletSidebarComponent,
    CharacterSidebarComponent,
    CharacterUnlockComponent,
    MinigamePanelComponent,
    OptionsMenuComponent,
    StatisticsComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'RPG Clicker';

  @ViewChild(StatisticsComponent) statsPanel!: StatisticsComponent;

  // ── Services ──────────────────────────────────────────────────
  private readonly log         = inject(ActivityLogService);
  private readonly wallet      = inject(WalletService);
  private readonly charService = inject(CharacterService);
  private readonly saveService = inject(SaveService);
  private readonly statsService = inject(StatisticsService);
  /** Exposed publicly so the template can call upgrade methods directly. */
  readonly upgrades            = inject(UpgradeService);

  // ── Readonly template refs ─────────────────────────────────────
  private readonly minigameDef = getGlobalDef('UNLOCK_MINIGAME')!;
  /** Pre-computed minigame costs (flat, never changes). */
  readonly minigameCosts: { currency: string; amount: number }[] = getActiveCosts(this.minigameDef, 0);

  private readonly jackdUpDef = getGlobalDef('JACKD_UP')!;
  /** Pre-computed Jack'd Up costs (flat, never changes). */
  readonly jackdUpCosts: { currency: string; amount: number }[] = getActiveCosts(this.jackdUpDef, 0);

  // ── Wallet state (template bindings) ──────────────────────────
  gold                = 0;
  xp                  = 0;
  /** All-time peak XP — used for all XP-threshold gate checks. */
  highestXp           = 0;
  potions             = 0;
  beast               = 0;
  koboldEars          = 0;
  pixieDust           = 0;
  concentratedPotions = 0;
  spice               = 0;

  // ── Character state ────────────────────────────────────────────
  activeCharacterId  = 'fighter';
  apothecaryUnlocked = false;
  culinarianUnlocked = false;
  thiefUnlocked      = false;
  artisanUnlocked    = false;
  necromancerUnlocked = false;
  merchantUnlocked    = false;
  artificerUnlocked   = false;
  chimeramancerUnlocked = false;
  unlockedCharacters: { id: string; name: string; color: string }[] = [];

  // ── Necromancer state ────────────────────────────────────────────
  /** Which necromancer ability is currently enabled. */
  necromancerActiveButton: 'defile' | 'ward' = 'defile';
  /** How many clicks remain before the active ability switches. */
  necromancerClicksRemaining = 10;

  // ── Artificer state ────────────────────────────────────────────
  /** Which artificer ability is currently enabled. */
  artificerActiveButton: 'study' | 'reflect' = 'study';
  /** Current insight level (0–max). */
  artificerInsight = 0;
  /** Computed max insight (base + Arcane Intellect bonus). */
  get artificerMaxInsight(): number {
    return YIELDS.ARTIFICER_MAX_INSIGHT
      + this.upgrades.level('POTION_ARCANE_INTELLECT') * YIELDS.ARTIFICER_ARCANE_INTELLECT_PER_LEVEL;
  }
  /** Currently-selected etching difficulty level (0 = base, max = EXTENDED_ETCHING level). */
  selectedEtchingLevel = 0;

  // ── Minigame state ─────────────────────────────────────────────
  minigameUnlocked = false;
  private _sidequestCollapsed = false;
  get sidequestCollapsed(): boolean { return this._sidequestCollapsed; }
  set sidequestCollapsed(v: boolean) {
    this._sidequestCollapsed = v;
    this.saveService.sidequestCollapsed = v;
  }

  get minigameShown():           boolean { return this.minigameUnlocked; }
  get minigameUnlockAvailable(): boolean {
    return this.highestXp >= XP_THRESHOLDS.MINIGAME_UNLOCK && !this.minigameUnlocked;
  }

  // ── Jack'd Up state ───────────────────────────────────────────
  jackdUpUnlocked = false;

  get jackdUpUnlockAvailable(): boolean {
    return this.highestXp >= XP_THRESHOLDS.JACKD_UP_UNLOCK && !this.jackdUpUnlocked;
  }

  // ── Kobold level selector ──────────────────────────────────────
  selectedKoboldLevel = 1;

  // ── Fighter combat state ───────────────────────────────────────
  fighterCombatState: FighterCombatState | null = null;

  // ── UI toggles ─────────────────────────────────────────────────
  shortRestEnabled        = false;
  dilutionEnabled         = false;
  synapticalEnabled       = false;
  hideMaxedUpgrades       = false;
  hideMinigameUpgrades    = false;
  blandMode               = false;
  wholesaleSpicesEnabled  = true;
  fermentationVatsEnabled = true;
  koboldBaitEnabled       = false;
  ancientCookbookEnabled  = true;
  chimeramancerRelicEnabled = true;
  firstStrikeEnabled      = true;

  // ── Slayer endgame state ────────────────────────────────────
  /** Whether the Slayer endgame sequence has been triggered. */
  slayerMode = false;
  /** Slayer boss fight state. */
  slayerHp: number = SLAYER.MAX_HP;
  slayerDamageDone: number = 0;
  /** Whether each of the 9 circular buttons is currently active. */
  slayerButtons: boolean[] = new Array(SLAYER.BUTTON_COUNT).fill(false);
  /** Interval handle for the button cycling. */
  private slayerCycleTimer: ReturnType<typeof setInterval> | null = null;
  /** Whether the death sequence animation is currently playing. */
  slayerDeathSequencePlaying = false;
  /** Whether the slayer-charge-kill animation is playing. */
  slayerChargeAnimPlaying = false;
  /** Whether the Scroll of True Resurrection has been used (prevents re-triggering End Times). */
  trueResurrected = false;
  /** Whether the slayer has frozen in place (pre-charge pause). */
  slayerFrozen = false;
  /** Whether the chimera has been slain (frozen chimera art). */
  chimeraSlain = false;
  /** Whether the victory modal is open. */
  victoryModalOpen = false;
  /** Formatted playtime string for the victory modal. */
  victoryPlaytime = '';
  /** IDs of characters that have been killed by the chimera. */
  deadCharacters: string[] = [];
  /** The Slayer character has been unlocked (distinct from slayerMode during death sequence). */
  slayerUnlocked = false;
  /** Interval handle for the Slayer auto-attack timer. */
  private slayerAutoAttackTimer: ReturnType<typeof setInterval> | null = null;

  // ── Condemn stacks (Slayer) ─────────────────────────────────
  /** Expiry timestamps (ms) for each active Condemn stack. */
  condemnStacks: number[] = [];

  // ── Slayer bead socket helpers ───────────────────────────────
  /** Whether the Bead of Carnage (SLAYER_GOLD_BEAD_1) is socketed and active. */
  get slayerBead1Socketed(): boolean {
    return !!this.beadState['slayer']?.['gold-1']?.socketed;
  }
  /** Whether the Bead of Annihilation (SLAYER_GOLD_BEAD_2) is socketed and active. */
  get slayerBead2Socketed(): boolean {
    return !!this.beadState['slayer']?.['gold-2']?.socketed;
  }
  /** Timer that cleans up expired stacks. */
  private condemnCleanupTimer: ReturnType<typeof setInterval> | null = null;

  // ── Multi-buy state ──────────────────────────────────────────
  /** How many upgrade levels to purchase per click: 1, 5, 10, or 'max'. */
  buyQuantity: 1 | 5 | 10 | 'max' = 1;

  // ── Character shine state (new content notification) ────────
  /**
   * Set of character IDs that have pending "new content" shine.
   * Cleared when the player selects the character.
   */
  charShine = new Set<string>();

  /** Tracks previously known unlocked character IDs so we only shine *newly* unlocked ones. */
  private _prevUnlockedCharIds = new Set<string>(['fighter']);

  /** Cached visible upgrade IDs per character — used to detect when new upgrades become available. */
  private _prevVisibleUpgradeIdsByChar: Record<string, Set<string>> = {};

  /** Mark a character as having new content — adds a shine to its sidebar button. */
  addCharShine(charId: string): void {
    if (charId === this.activeCharacterId) return; // no shine for the current character
    this.charShine.add(charId);
    this.charShine = new Set(this.charShine); // trigger change detection
  }

  // ── Relic popup state ─────────────────────────────────────────
  /** ID of the relic upgrade whose popup is currently shown, or null. */
  relicPopupId: string | null = null;

  /** The currency symbol used for the compact relic icon (from CURRENCY_FLAVOR). */
  readonly relicSymbol = CURRENCY_FLAVOR.relic.symbol;

  // ── Bead state ──────────────────────────────────────────────────
  /**
   * Bead state per character. Each character has 4 slots:
   * 'blue-1', 'gold-1', 'gold-2', 'blue-2' (displayed left to right).
   */
  beadState: Record<string, Record<string, { found: boolean; socketed: boolean }> | undefined> = {};

  /** Info about the bead popup currently open, or null. */
  beadPopupInfo: { charId: string; slotId: string; type: BeadType } | null = null;

  /** Pre-computed bead crown display items — refreshed by _refreshDerived(). */
  beadCrownItems: { kind: 'bead' | 'relic'; slotId?: string; beadType?: BeadType; beadState?: 'locked' | 'found' | 'socketed'; relicId?: string; relicPurchased?: boolean; relicFound?: boolean; relicName?: string }[] = [];

  /** Whether the Vorpal Blade relic has been socketed into the crown. */
  vorpalBladeSocketed = false;

  /** Whether any bead for the active character is found but not yet socketed. */
  anyBeadUnsocketed = false;

  // ── Auto-solve state ──────────────────────────────────────────
  /** Per-character auto-solve toggle state. */
  autoSolveEnabled: Record<string, boolean> = {};

  /** Per-character gold-2 bead unlock progress (shape varies per character). */
  gold2Progress: Record<string, unknown> = {};

  /** Merchant auto-buyer selections (currencyId → enabled). Persisted. */
  merchantAutoBuySelections: Record<string, boolean> = {};
  /** Current merchant auto-buyer info for per-second calculation. */
  merchantAutoBuyerInfo: { currencyId: string; goldCostPerTick: number; qtyPerTick: number }[] = [];

  /** Chimeramancer chimera-building contribution progress (currencyId → amount). */
  chimeramancerContributions: Record<string, number> | null = null;

  /** Called when chimeramancer contribution progress changes. */
  onChimeramancerContributionsChange(contributions: Record<string, number>): void {
    this.chimeramancerContributions = { ...contributions };
  }

  /** Called when merchant auto-buyer selections change. */
  onMerchantAutoBuySelectionsChange(selections: Record<string, boolean>): void {
    this.merchantAutoBuySelections = { ...selections };
  }

  /** Called when merchant auto-buyer state changes (prices update, selections toggle). */
  onMerchantAutoBuyerStateChange(infos: { currencyId: string; goldCostPerTick: number; qtyPerTick: number }[]): void {
    this.merchantAutoBuyerInfo = infos;
    this.updateAllPerSecond();
  }

  /** Whether auto-solve is unlocked for a character (either gold bead socketed). */
  isAutoSolveUnlocked(charId: string): boolean {
    return !!this.beadState[charId]?.['gold-1']?.socketed
        || !!this.beadState[charId]?.['gold-2']?.socketed;
  }

  /** Whether the "good" auto-solve is active (both gold beads socketed). */
  isAutoSolveGood(charId: string): boolean {
    return !!this.beadState[charId]?.['gold-1']?.socketed
        && !!this.beadState[charId]?.['gold-2']?.socketed;
  }

  /** Whether the character's first gold bead (gold-1, awarded by minigame success) is undiscovered. */
  hasUnfoundMinigameGoldBead(charId: string): boolean {
    this.ensureBeadState(charId);
    return !this.beadState[charId]!['gold-1'].found;
  }

  /** Award the first gold bead (gold-1) for a character via minigame success. */
  findMinigameGoldBead(charId: string): void {
    this.ensureBeadState(charId);
    if (this.beadState[charId]!['gold-1'].found) return;
    this.beadState[charId]!['gold-1'].found = true;
    this.beadState = { ...this.beadState };
    this._refreshDerived();
    this.addCharShine(charId);
    const charName = this.unlockedCharacters.find(c => c.id === charId)?.name ?? charId;
    this.log.log(LOG_MSG.SYSTEM.BEAD_GOLD_MG(charName), 'rare');
    this.statsService.recordMilestone(`bead_gold_mg_${charId}`, `${charName}: Gold Bead Found (Sidequest)`);
  }

  /** Award the gold-2 bead for a character via the deterministic unlock challenge. */
  findGold2Bead(charId: string): void {
    this.ensureBeadState(charId);
    if (this.beadState[charId]!['gold-2'].found) return;
    this.beadState[charId]!['gold-2'].found = true;
    this.beadState = { ...this.beadState };
    this._refreshDerived();
    this.addCharShine(charId);
    const charName = this.unlockedCharacters.find(c => c.id === charId)?.name ?? charId;
    this.log.log(LOG_MSG.SYSTEM.BEAD_GOLD2(charName), 'rare');
    this.statsService.recordMilestone(`bead_gold2_${charId}`, `${charName}: Gold Bead Found (Challenge)`);
  }

  /** Update gold-2 progress for a character. */
  onGold2ProgressChange(charId: string, progress: unknown): void {
    this.gold2Progress = { ...this.gold2Progress, [charId]: progress };
  }
  // ── Thief stun state ───────────────────────────────────────────
  /** Absolute timestamp (ms) when the Thief's stun expires. 0 = not stunned. */
  thiefStunUntil = 0;
  /** Handle for the post-stun updateAllPerSecond timeout, so stale callbacks can be cancelled. */
  private thiefStunTimeoutId: ReturnType<typeof setTimeout> | null = null;
  /**
   * Cached inline styles for the stun fill-bar. Plain property (NOT a getter)
   * so Angular does not re-evaluate it on every CD cycle.
   */
  thiefStunAnimStyle: Record<string, string> = {};

  /** True while the Thief is in a stun lockout after a failed break-in. */
  get isThiefStunned(): boolean { return Date.now() < this.thiefStunUntil; }
  /** Seconds remaining in the Thief stun (0 if not stunned). */
  get thiefStunRemaining(): number {
    return Math.ceil(Math.max(0, this.thiefStunUntil - Date.now()) / 1000);
  }
  /** Whether the hero button should be disabled (only true for thief while stunned). */
  get isHeroDisabled(): boolean {
    if (this.deadCharacters.includes(this.activeCharacterId)) return true;
    if (this.activeCharacterId === 'thief') return this.isThiefStunned;
    if (this.activeCharacterId === 'artisan') return this.isArtisanTimerActive;
    return false;
  }

  // ── Artisan timer state ────────────────────────────────────────
  /** Absolute timestamp (ms) when the Artisan's appraisal timer expires. 0 = idle. */
  artisanTimerUntil = 0;
  /** How many appraisals are batched in the current timer (1 for manual, N for jacks). */
  artisanTimerBatchSize = 0;
  /** Whether the current artisan timer is from a jack batch (relic only applies to jacks). */
  private artisanTimerIsJackBatch = false;
  /** Handle for the post-timer updateAllPerSecond timeout. */
  private artisanTimerTimeoutId: ReturnType<typeof setTimeout> | null = null;
  /**
   * Cached inline styles for the artisan timer fill-bar.
   */
  artisanTimerAnimStyle: Record<string, string> = {};

  /** True while the Artisan's appraisal timer is running. */
  get isArtisanTimerActive(): boolean { return Date.now() < this.artisanTimerUntil; }

  // ── Jack of All Trades state ───────────────────────────────────
  jacksOwned       = 0;
  jacksAllocations: Record<string, number> = {};
  jackStarved:      Record<string, boolean> = {};

  // ── Familiar state ─────────────────────────────────────────────
  /**
   * Absolute timestamps (ms since epoch) at which each familiar timer expires.
   * Keys are jack allocation keys (character IDs or compound like 'necromancer-defile').
   * A key with 0 or absent = inactive.
   */
  familiarTimers: Record<string, number> = {};
  /** When true, all familiars are paused — they don't click and don't count for per-second. */
  familiarsPaused = false;
  /** Per-key individual pause state — a familiar is paused if this OR familiarsPaused is true. */
  familiarPausedKeys: Record<string, boolean> = {};
  /** Timestamp (ms) at which each familiar was individually paused — used to freeze timer countdown. */
  familiarPausedAt: Record<string, number> = {};
  /** Timestamp (ms) at which the global pause was started — used to freeze all timers. */
  familiarsPausedAt: number | null = null;

  // ── Jack computed getters (delegated to jack-calculator) ───────

  get jacksVisible():    boolean { return isJacksVisible(this.highestXp, this.jacksOwned); }
  get jacksToPurchase(): number  { return getJacksToPurchase(this.highestXp, this.jacksOwned); }
  get jacksPoolFree():   number  { return getJacksPoolFree(this.jacksOwned, this.jacksAllocations); }

  /** Pre-computed jack costs — refreshed by _refreshDerived(). */
  jackCurrentCosts: JackCostEntry[] = [];
  /** Pre-computed jack affordability — refreshed by _refreshDerived(). */
  canAffordJack = false;
  /** Pre-computed active character info — refreshed by _refreshDerived(). */
  activeCharacterInfo: { id: string; name: string; color: string } | undefined;

  get activeCharJackStarved(): boolean {
    return isActiveCharJackStarved(
      this.activeCharacterId, this.isThiefStunned, this.isArtisanTimerActive,
      this.jacksAllocations, this.jackStarved,
    );
  }

  get activeCharJackStarvedMsg(): string {
    const culGoldCost = calcCulinarianGoldCost(
      this.wholesaleSpicesEnabled,
      this.upgrades.level('WHOLESALE_SPICES'),
      this.upgrades.level('POTION_GLIBNESS'),
    );
    return getJackStarvedMessage(
      this.activeCharacterId,
      culGoldCost,
      id => this.wallet.get(id),
      this.upgrades.level('RELIC_APOTHECARY'),
      this.getJackCount('artisan'),
      this.upgrades.level('DARK_PACT'),
    );
  }

  getJackCount(charId: string): number { return this.jacksAllocations[charId] ?? 0; }

  // ── Minigame-panel prop (thin delegation) ──────────────────────

  /** Fighter minigame attack power. */
  get fighterAttackPower(): number { return this.upgrades.level('SHARPER_SWORDS'); }

  // ── Hero display (delegated to hero-stats) ─────────────────────

  get questBtnLabel(): string {
    return getQuestBtnLabel(this.activeCharacterId);
  }

  /** Pre-computed hero stats — refreshed by _refreshDerived(). */
  heroStats: HeroStat[] = [];

  // ── Upgrade display helpers ────────────────────────────────────

  /** Pre-computed visible upgrade lists — refreshed by _refreshDerived(). */
  private _visibleUpgradesCache: Record<string, string[]> = {};

  /** Pre-computed relic unpurchased flag — refreshed by _refreshDerived(). */
  anyRelicUnpurchased = false;

  shouldShowUpgrade(isMaxed: boolean): boolean {
    return !this.hideMaxedUpgrades || !isMaxed;
  }

  /** Returns visible upgrade IDs for the active character in the given column (cached). */
  getVisibleUpgrades(category: UpgradeCategory): string[] {
    return this._visibleUpgradesCache[category] ?? [];
  }

  /** Checks gate conditions for an upgrade. */
  isUpgradeVisible(id: string): boolean {
    const gates = this.upgrades.getGates(id);
    if (!gates) return true;
    if (gates.requiresApothecary    && !this.apothecaryUnlocked)                     return false;
    if (gates.requiresCulinarian    && !this.culinarianUnlocked)                     return false;
    if (gates.requiresThief         && !this.thiefUnlocked)                          return false;
    if (gates.requiresArtisan       && !this.artisanUnlocked)                        return false;
    if (gates.requiresNecromancer   && !this.necromancerUnlocked)                     return false;
    if (gates.requiresMerchant      && !this.merchantUnlocked)                        return false;
    if (gates.requiresArtificer     && !this.artificerUnlocked)                       return false;
    if (gates.requiresChimeramancer && !this.chimeramancerUnlocked)                    return false;
    if (gates.requiresRelic         && !this.wallet.isCurrencyUnlocked('relic'))     return false;
    if (gates.requiresFang          && !this.wallet.isCurrencyUnlocked('kobold-fang')) return false;
    if (gates.requiresFeather       && !this.wallet.isCurrencyUnlocked('kobold-feather')) return false;
    if (gates.requiresDossier       && !this.wallet.isCurrencyUnlocked('dossier'))   return false;
    if (gates.requiresBubblingBrew  && this.upgrades.level('BUBBLING_BREW') < 1)     return false;
    if (gates.requiresPotionDilution && this.upgrades.level('POTION_DILUTION') < 1)  return false;
    if (gates.requiresLockedIn      && this.upgrades.level('LOCKED_IN') < 1)         return false;
    if (gates.requiresSynapticalPotions && this.upgrades.level('SYNAPTICAL_POTIONS') < 1) return false;
    if (gates.requiresDoubleDip     && this.upgrades.level('DOUBLE_DIP') < 1)        return false;
    if (gates.requiresFindFamiliar  && this.upgrades.level('FIND_FAMILIAR') < 1)     return false;
    if (gates.requiresBiggerThreads && this.upgrades.level('BIGGER_THREADS') < 1)   return false;
    if (gates.requiresSharperNeedles && this.upgrades.level('SHARPER_NEEDLES') < 1) return false;
    if (gates.xpMin != null && this.highestXp < gates.xpMin) return false;
    if (gates.requiresSharperSwordsMin != null && this.upgrades.level('SHARPER_SWORDS') < gates.requiresSharperSwordsMin) return false;
    if (gates.requiresTreasureChestMin != null && this.upgrades.level('TREASURE_CHEST') < gates.requiresTreasureChestMin) return false;
    if (gates.requiresSlayerDamage && (
      !this.slayerMode                                           // 1) chimera not 100% / boss fight not started
      || this.slayerDamageDone < SLAYER.UPGRADE_THRESHOLD       // 2) fewer than 50 damage dealt
      || (!this.slayerUnlocked && this.wallet.get('ichor') < SLAYER.UPGRADE_THRESHOLD)  // 3) fewer than 50 ichor (only before slayer is purchased)
    )) return false;
    if (gates.requiresSlayerGoldBeads && (
      this.upgrades.level('SLAYER_GOLD_BEAD_1') < 1 || this.upgrades.level('SLAYER_GOLD_BEAD_2') < 1
    )) return false;
    if (gates.requiresSlayerGoldBead1 && this.upgrades.level('SLAYER_GOLD_BEAD_1') < 1) return false;
    if (gates.requiresWindfury        && this.upgrades.level('WINDFURY') < 1)            return false;
    if (gates.requiresThunderfury     && this.upgrades.level('THUNDERFURY') < 1)          return false;
    if (gates.requiresChimeraSlain    && !(this.slayerMode && this.slayerHp <= 0))        return false;
    return true;
  }

  /** Returns a live description suffix for upgrades that show current values. */
  upgradeDescSuffix(id: string): string {
    switch (id) {
      default: return '';
    }
  }

  /** Safe accessor for currency flavor by dynamic key. */
  getCurrencyFlavor(currency: string): { symbol: string; color: string } {
    return (CURRENCY_FLAVOR as Record<string, { symbol: string; color: string }>)[currency]
      ?? { symbol: '?', color: '#ccc' };
  }

  /** Whether the player can afford a specific currency amount. */
  canAffordCurrency(currency: string, amount: number): boolean {
    return this.wallet.canAfford(currency, amount);
  }

  /** Safe accessor for upgrade flavor by dynamic key. */
  getUpgradeFlavor(id: string): { name: string; desc: string } {
    return (UPGRADE_FLAVOR as Record<string, { name: string; desc: string }>)[id]
      ?? { name: id, desc: '' };
  }

  /**
   * Returns the accent color for an upgrade card (title text + left border).
   * Relic upgrades → relic color.
   * Single-level or maxed-out upgrades → rare color.
   * Everything else → standard color.
   */
  getUpgradeColor(id: string): string {
    if (this.upgrades.category(id) === 'relic' || id === 'RELIC_HUNTER' || id === 'RELIC_SLAYER') return UPGRADE_COLORS.relic;
    if (this.upgrades.maxLevel(id) === 1 || this.upgrades.isMaxed(id)) return UPGRADE_COLORS.rare;
    return UPGRADE_COLORS.standard;
  }

  /** Format large numbers as shorthand. */
  formatNumber(num: number): string {
    return fmtNumber(num);
  }

  // ── Multi-buy helpers ──────────────────────────────────────────

  /** Effective number of levels that will be purchased for the given upgrade. */
  effectiveBuyCount(id: string): number {
    if (this.buyQuantity === 'max') return Math.max(1, this.upgrades.maxAffordable(id));
    const remaining = this.upgrades.maxLevel(id) - this.upgrades.level(id);
    return Math.min(this.buyQuantity, remaining);
  }

  /** Summed costs for the current buy quantity on an upgrade. */
  getMultiCosts(id: string): Array<{ currency: string; amount: number }> {
    const count = this.effectiveBuyCount(id);
    return this.upgrades.allCostsMulti(id, count);
  }

  /** Whether the player can afford the current buy-quantity purchase. */
  canAffordMultiBuy(id: string): boolean {
    const count = this.effectiveBuyCount(id);
    return this.upgrades.canAffordMulti(id, count);
  }

  /** Buy the current buy-quantity of levels for an upgrade. */
  buyUpgrade(id: string): void {
    // Special case: Scroll of True Resurrection — deducts ALL ichor and triggers resurrection.
    if (id === 'SCROLL_OF_TRUE_RESURRECTION') {
      this.performTrueResurrection();
      return;
    }
    const prevLevel = this.upgrades.level(id);
    if (this.buyQuantity === 'max') {
      const max = this.upgrades.maxAffordable(id);
      if (max > 0) this.upgrades.buyMulti(id, max);
    } else {
      const count = this.effectiveBuyCount(id);
      this.upgrades.buyMulti(id, count);
    }
    // After buying a slayer gold bead, mark it as "found" so the player
    // must manually socket it via the bead crown before it takes effect.
    if (id === 'SLAYER_GOLD_BEAD_1' && this.upgrades.level(id) > prevLevel) {
      this._markSlayerBeadFound('gold-1', 'Bead of Carnage');
    } else if (id === 'SLAYER_GOLD_BEAD_2' && this.upgrades.level(id) > prevLevel) {
      this._markSlayerBeadFound('gold-2', 'Bead of Annihilation');
    }
  }

  /** Mark a slayer gold bead slot as found (purchased but not yet socketed). */
  private _markSlayerBeadFound(slotId: 'gold-1' | 'gold-2', beadName: string): void {
    this.ensureBeadState('slayer');
    if (this.beadState['slayer']![slotId].found) return; // already found
    this.beadState['slayer']![slotId].found = true;
    this.beadState = { ...this.beadState };
    this._refreshDerived();
    this.addCharShine('slayer');
    this.log.log(`The ${beadName} awaits socketing — open the bead crown to activate it.`, 'rare');
    this.statsService.recordMilestone(`slayer_bead_found_${slotId}`, `Slayer: ${beadName} Purchased`);
  }

  // ── Relic popup ────────────────────────────────────────────────

  /** Pre-computed relic socket data for the crown display — refreshed by _refreshDerived(). */
  relicSlots: { id: string; name: string; purchased: boolean }[] = [];

  openRelicPopup(id: string): void { this.relicPopupId = id; }
  closeRelicPopup(): void          { this.relicPopupId = null; }

  /** Buy the relic currently shown in the popup, if affordable. */
  buyRelicFromPopup(): void {
    if (this.relicPopupId && !this.upgrades.isMaxed(this.relicPopupId) && this.upgrades.canAfford(this.relicPopupId)) {
      this.upgrades.buy(this.relicPopupId);
    }
  }

  /** Socket the Vorpal Blade relic into the crown (slayer-specific — purchased via sidequest). */
  socketVorpalBlade(): void {
    if (this.upgrades.level('RELIC_SLAYER') >= 1 && !this.vorpalBladeSocketed) {
      this.vorpalBladeSocketed = true;
      this._refreshDerived();
      this.closeRelicPopup();
      this.log.log('⚔ The Vorpal Blade is socketed. The chimera can now be slain.', 'rare');
    }
  }

  /** Whether the Sunfury upgrade is active (used for godhead visual). */
  get sunfuryActive(): boolean { return this.upgrades.level('SUNFURY') > 0; }

  /** Format playtime seconds as a human-readable string. */
  private _formatPlaytime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  /** Close victory modal and open the statistics screen. */
  openStatsFromVictory(): void {
    this.victoryModalOpen = false;
    setTimeout(() => this.statsPanel?.open(), 100);
  }

  // ── Bead helpers ────────────────────────────────────────────────

  /** Ensure bead state exists for a character, initializing all 4 slots. */
  private ensureBeadState(charId: string): void {
    if (!this.beadState[charId]) {
      this.beadState[charId] = {};
    }
    const slots = this.beadState[charId]!;
    for (const slotId of BEAD_SLOT_ORDER) {
      if (!slots[slotId]) {
        slots[slotId] = { found: false, socketed: false };
      }
    }
  }

  /** Get the bead state for a specific character + slot. */
  getBeadSlot(charId: string, slotId: string): { found: boolean; socketed: boolean } {
    return this.beadState[charId]?.[slotId] ?? { found: false, socketed: false };
  }

  /** Whether the character's LEFT blue bead (blue-1, awarded by manual clicks) is undiscovered. */
  hasUnfoundBlueBead(charId: string): boolean {
    this.ensureBeadState(charId);
    return !this.beadState[charId]!['blue-1'].found;
  }

  /** Whether the character's RIGHT blue bead (blue-2, awarded by jacks) is undiscovered. */
  hasUnfoundJackBead(charId: string): boolean {
    this.ensureBeadState(charId);
    return !this.beadState[charId]!['blue-2'].found;
  }

  /** Award the left blue bead (blue-1) for a character via manual clicks. */
  findBlueBead(charId: string): void {
    this.ensureBeadState(charId);
    if (this.beadState[charId]!['blue-1'].found) return;
    this.beadState[charId]!['blue-1'].found = true;
    this.beadState = { ...this.beadState };
    this._refreshDerived();
    this.addCharShine(charId);
    const charName = this.unlockedCharacters.find(c => c.id === charId)?.name ?? charId;
    this.log.log(LOG_MSG.SYSTEM.BEAD_BLUE(charName), 'rare');
    this.statsService.recordMilestone(`bead_blue_${charId}`, `${charName}: Blue Bead Found`);
  }

  /** Award the right blue bead (blue-2) for a character via jack/familiar auto-clicks. */
  findJackBead(charId: string): void {
    this.ensureBeadState(charId);
    if (this.beadState[charId]!['blue-2'].found) return;
    this.beadState[charId]!['blue-2'].found = true;
    this.beadState = { ...this.beadState };
    this._refreshDerived();
    this.addCharShine(charId);
    const charName = this.unlockedCharacters.find(c => c.id === charId)?.name ?? charId;
    this.log.log(LOG_MSG.SYSTEM.BEAD_JACK(charName), 'rare');
    this.statsService.recordMilestone(`bead_jack_${charId}`, `${charName}: Jack Bead Found`);
  }

  /** Socket a bead from the popup. */
  socketBeadFromPopup(): void {
    if (!this.beadPopupInfo) return;
    const { charId, slotId, type } = this.beadPopupInfo;
    this.ensureBeadState(charId);
    const slot = this.beadState[charId]![slotId];
    if (slot?.found && !slot?.socketed) {
      slot.socketed = true;
      this.beadState = { ...this.beadState };
      this.syncBeadMultipliers();
      this._refreshDerived();
      this.updateAllPerSecond();
      const charName = this.unlockedCharacters.find(c => c.id === charId)?.name ?? charId;
      const beadName = BEAD_FLAVOR[charId]?.[slotId]?.name ?? 'Bead';
      this.log.log(LOG_MSG.SYSTEM.BEAD_SOCKETED(beadName, charName, type === 'blue'), 'rare');
    }
  }

  /** Open the bead detail popup. */
  openBeadPopup(item: { slotId?: string; beadType?: BeadType }): void {
    if (!item.slotId || !item.beadType) return;
    this.beadPopupInfo = { charId: this.activeCharacterId, slotId: item.slotId, type: item.beadType };
  }

  /** Close the bead popup. */
  closeBeadPopup(): void { this.beadPopupInfo = null; }

  /** Get bead flavor name for a character + slot. */
  getBeadName(charId: string, slotId: string): string {
    return BEAD_FLAVOR[charId]?.[slotId]?.name ?? 'Unknown Bead';
  }

  /** Get bead lore for a character + slot. */
  getBeadLore(charId: string, slotId: string): string {
    return BEAD_FLAVOR[charId]?.[slotId]?.lore ?? '';
  }

  /** Get bead effect text for a character + slot.
   *  If gold-2 is socketed but gold-1 is not, display gold-1's effect instead
   *  since the actual behavior is basic auto-solve (not enhanced). */
  getBeadEffect(charId: string, slotId: string): string {
    if (slotId === 'gold-2') {
      const gold1Socketed = !!this.beadState[charId]?.['gold-1']?.socketed;
      if (!gold1Socketed) {
        return BEAD_FLAVOR[charId]?.['gold-1']?.effect ?? '';
      }
    }
    return BEAD_FLAVOR[charId]?.[slotId]?.effect ?? '';
  }

  /** Get bead display symbol based on state. */
  getBeadSymbol(state: string): string {
    return BEAD_SYMBOL;
  }

  /** Get bead primary color for a type. */
  getBeadColor(type: BeadType): string {
    return BEAD_COLORS[type].primary;
  }

  /** Count socketed blue beads for a character. */
  private getSocketedBlueCount(charId: string): number {
    const char = this.beadState[charId];
    if (!char) return 0;
    let count = 0;
    if (char['blue-1']?.socketed) count++;
    if (char['blue-2']?.socketed) count++;
    return count;
  }

  /** Sync all bead multipliers to the wallet service. */
  private syncBeadMultipliers(): void {
    const allChars = ['fighter', 'ranger', 'apothecary', 'culinarian', 'thief', 'artisan', 'necromancer', 'merchant', 'artificer', 'slayer'];
    for (const charId of allChars) {
      const blueCount = this.getSocketedBlueCount(charId);
      this.wallet.setBeadMultiplier(charId, Math.pow(BEADS.BLUE_YIELD_MULT, blueCount));
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  constructor() {
    // Sync wallet display fields
    this.wallet.state$.subscribe(state => {
      this.gold                = Math.floor(state['gold']?.amount                 ?? 0);
      this.xp                  = Math.floor(state['xp']?.amount                  ?? 0);
      this.potions             = Math.floor(state['potion']?.amount              ?? 0);
      this.beast               = Math.floor(state['beast']?.amount               ?? 0);
      this.koboldEars          = Math.floor(state['kobold-ear']?.amount          ?? 0);
      this.pixieDust           = Math.floor(state['pixie-dust']?.amount          ?? 0);
      this.concentratedPotions = Math.floor(state['concentrated-potion']?.amount ?? 0);
      this.spice               = Math.floor(state['spice']?.amount               ?? 0);
      this._refreshDerived();
      // Keep the Scroll of True Resurrection cost in sync with current ichor balance.
      if (this.upgrades.level('SCROLL_OF_TRUE_RESURRECTION') < 1) {
        const ichor = Math.floor(state['ichor']?.amount ?? 0);
        this.upgrades.updateCost('SCROLL_OF_TRUE_RESURRECTION', 'ichor', Math.max(1, ichor));
      }
    });
    this.wallet.highestXpEver$.subscribe(v => {
      const prev = this.highestXp;
      this.highestXp = v;
      // Track XP milestone crossings
      for (const [key, threshold] of Object.entries(XP_THRESHOLDS)) {
        if (v >= threshold && prev < threshold) {
          this.statsService.recordMilestone(`xp_${key}`, `XP ${threshold.toLocaleString()} (${key.replace(/_/g, ' ')})`);
        }
      }
    });

    this.charService.activeId$.subscribe(id => {
      this.activeCharacterId = id;
      // Clear shine when the player selects this character
      if (this.charShine.has(id)) {
        this.charShine.delete(id);
        this.charShine = new Set(this.charShine);
      }
      if (id === 'thief' && this.isThiefStunned) this.refreshThiefStunAnimStyle();
      if (id === 'artisan' && this.isArtisanTimerActive) this.refreshArtisanTimerAnimStyle();
      this._refreshDerived();
    });
    this.charService.characters$.subscribe(chars => {
      this.apothecaryUnlocked = chars.find(c => c.id === 'apothecary')?.unlocked ?? false;
      this.culinarianUnlocked = chars.find(c => c.id === 'culinarian')?.unlocked ?? false;
      this.thiefUnlocked      = chars.find(c => c.id === 'thief')?.unlocked      ?? false;
      this.artisanUnlocked    = chars.find(c => c.id === 'artisan')?.unlocked    ?? false;
      this.necromancerUnlocked = chars.find(c => c.id === 'necromancer')?.unlocked ?? false;
      this.merchantUnlocked   = chars.find(c => c.id === 'merchant')?.unlocked   ?? false;
      this.artificerUnlocked  = chars.find(c => c.id === 'artificer')?.unlocked  ?? false;
      this.chimeramancerUnlocked = chars.find(c => c.id === 'chimeramancer')?.unlocked ?? false;
      this.unlockedCharacters = chars.filter(c => c.unlocked).map(c => ({ id: c.id, name: c.name, color: c.color }));
      this.updateRelicHunterMax(chars);
      // Shine newly unlocked characters (skip ones already known from save restore)
      for (const c of chars) {
        if (c.unlocked && !this._prevUnlockedCharIds.has(c.id)) {
          this.addCharShine(c.id);
        }
      }
      this._prevUnlockedCharIds = new Set(chars.filter(c => c.unlocked).map(c => c.id));
      // Track character unlock milestones
      for (const c of chars) {
        if (c.unlocked && c.id !== 'fighter') {
          this.statsService.recordMilestone(`char_${c.id}`, `${c.name} Unlocked`);
        }
      }
      this._refreshDerived();
    });

    // Reactively update per-second display rates whenever any upgrade changes
    this.upgrades.changed$.subscribe(id => {
      this.updateAllPerSecond();
      // Update SLOW_BLADE's dynamic max whenever Sharper Swords level changes
      if (id === 'SHARPER_SWORDS') this.updateSlowBladeMax();
      // Track relic purchase milestones
      if (id.startsWith('RELIC_') && this.upgrades.level(id) >= 1) {
        const flavorName = (UPGRADE_FLAVOR as any)[id]?.name ?? id;
        this.statsService.recordMilestone(`relic_${id}`, `Relic: ${flavorName}`);
      }
      // Restart auto-attack timer when Bloodlust changes (interval changed)
      if (id === 'BLOODLUST' && this.slayerUnlocked) {
        this._startSlayerAutoAttack();
      }
      // Shine the character button when something new happens for a non-active character
      const charId = this.upgrades.charIdFor(id);
      if (charId) this.addCharShine(charId);
      this._refreshDerived();
      // Check if this upgrade purchase made new upgrades visible for other characters
      this._checkUpgradeVisibilityShines();
    });

    // Passive gold income (Contracted Hirelings only)
    setInterval(() => {
      const autoGold = calcAutoGoldPerSecond(
        this.upgrades.level('CONTRACTED_HIRELINGS'),
        this.upgrades.level('HIRELINGS_HIRELINGS'),
      ) * this.wallet.getBeadMultiplier('fighter');
      if (autoGold > 0) {
        this.wallet.add('gold', autoGold);
        this.statsService.trackCurrencyGain('gold', autoGold);
      }
    }, 1000);

    // Passive ranger income: Baited Traps + Spiced Bait (beast) and Hovel Garden + Ornate Herb Pots (herb) — every 5 seconds
    setInterval(() => {
      const rangerMult = this.wallet.getBeadMultiplier('ranger');
      const beastYield = calcBaitedTrapsBeastPerTick(
        this.upgrades.level('BAITED_TRAPS'),
        this.upgrades.level('SPICED_BAIT'),
      ) * rangerMult;
      if (beastYield > 0) {
        this.wallet.add('beast', beastYield);
        this.statsService.trackCurrencyGain('beast', beastYield);
      }
      const herbYield = calcHovelGardenHerbPerTick(
        this.upgrades.level('HOVEL_GARDEN'),
        this.upgrades.level('ORNATE_HERB_POTS'),
      ) * rangerMult;
      if (herbYield > 0) {
        this.wallet.add('herb', herbYield);
        this.statsService.trackCurrencyGain('herb', herbYield);
      }
    }, 5000);

    // Fermentation Vats: convert herbs → potions every 10 seconds (when enabled)
    // Also awards gold based on Potion Marketing level for each potion brewed.
    setInterval(() => {
      const vatLevel = this.upgrades.level('FERMENTATION_VATS');
      if (vatLevel > 0 && this.fermentationVatsEnabled) {
        if (this.wallet.canAfford('herb', vatLevel)) {
          const apothMult = this.wallet.getBeadMultiplier('apothecary');
          this.wallet.remove('herb', vatLevel);
          const potionYield = vatLevel * apothMult;
          this.wallet.add('potion', potionYield);
          this.statsService.trackCurrencyGain('potion', potionYield);
          const vatGold = vatLevel * this.upgrades.level('POTION_MARKETING') * apothMult;
          if (vatGold > 0) {
            this.wallet.add('gold', vatGold);
            this.statsService.trackCurrencyGain('gold', vatGold);
          }
        }
      }
    }, 10000);

    // Passive life-thread income: Sharper Needles + Loom of Life — every second
    setInterval(() => {
      const needlesYield = calcSharperNeedlesThreadPerSec(
        this.upgrades.level('SHARPER_NEEDLES'),
        this.upgrades.level('LOOM_OF_LIFE'),
      ) * this.wallet.getBeadMultiplier('chimeramancer');
      if (needlesYield > 0) {
        this.wallet.add('life-thread', needlesYield);
        this.statsService.trackCurrencyGain('life-thread', needlesYield);
      }
    }, 1000);

    // Jack auto-clicks: each allocated Jack fires once per second
    // Relic doubling: when a character's relic is active, each jack counts as two.
    // Jack'd Up: when purchased, jacks fire 50% faster (1.5× effective clicks per tick).
    setInterval(() => {
      const ctx = this.buildJackAutoClickCtx();
      const jackdUpMult = this.jackdUpUnlocked ? JACKD_UP_SPEED_MULT : 1;

      // Collect entries and ensure artificer-study fires before artificer-reflect
      const entries = Object.entries(this.jacksAllocations);
      entries.sort((a, b) => {
        const order = (k: string) =>
          k === 'artificer-study' ? 0 : k === 'artificer-reflect' ? 1 : -1;
        return order(a[0]) - order(b[0]);
      });

      for (const [charId, count] of entries) {
        // Normalize compound keys (e.g. 'necromancer-defile' → 'necromancer', 'artificer-study' → 'artificer') for relic lookup
        const baseCharId = charId.startsWith('necromancer') ? 'necromancer' : charId.startsWith('artificer') ? 'artificer' : charId;
        const relicMult = this.upgrades.level(`RELIC_${baseCharId.toUpperCase()}`) >= 1 ? 2 : 1;
        const scaledRaw = count * relicMult * jackdUpMult;
        const effective = Math.floor(scaledRaw) + (Math.random() < (scaledRaw % 1) ? 1 : 0);
        if (charId === 'artisan') {
          // Artisan jacks share a single timer — handle as a batch
          if (effective > 0) this.handleArtisanJackBatch(effective);
          continue;
        }
        for (let i = 0; i < effective; i++) performJackAutoClick(charId, ctx);
      }

      // ── Chimeramancer Relic: Thread of Infinite Weaving ──────────
      // Each chimeramancer jack also clicks every other hero button once.
      if (this.chimeramancerRelicEnabled && this.upgrades.level('RELIC_CHIMERAMANCER') >= 1) {
        const chimeraCount = this.jacksAllocations['chimeramancer'] ?? 0;
        if (chimeraCount > 0) {
          const chimeraRelicMult = this.upgrades.level('RELIC_CHIMERAMANCER') >= 1 ? 2 : 1;
          const chimeraScaledRaw = chimeraCount * chimeraRelicMult * jackdUpMult;
          const chimeraEffective = Math.floor(chimeraScaledRaw) + (Math.random() < (chimeraScaledRaw % 1) ? 1 : 0);
          const otherCharIds = ['fighter', 'ranger', 'apothecary', 'culinarian', 'thief',
            'necromancer-defile', 'necromancer-ward', 'merchant',
            'artificer-study', 'artificer-reflect'];
          for (let i = 0; i < chimeraEffective; i++) {
            for (const otherId of otherCharIds) {
              if (otherId === 'artisan') continue; // artisan handled via batch below
              performJackAutoClick(otherId, ctx);
            }
            this.handleArtisanJackBatch(1);
          }
        }
      }

      // Familiar auto-clicks: each active familiar fires JACKS_PER_FAMILIAR additional clicks
      if (this.familiarUnlocked) {
        const now = Date.now();
        let anyExpired = false;
        for (const [key, expiry] of Object.entries(this.familiarTimers)) {
          const isPaused = this.familiarsPaused || !!this.familiarPausedKeys[key];
          if (!isPaused && expiry <= now) {
            // Timer just expired — mark for cleanup
            anyExpired = true;
            continue;
          }
          // Skip clicks when familiars are paused (globally or individually)
          if (isPaused) continue;

          const baseId = key.startsWith('necromancer') ? 'necromancer' : key.startsWith('artificer') ? 'artificer' : key;
          const relicMult = this.upgrades.level(`RELIC_${baseId.toUpperCase()}`) >= 1 ? 2 : 1;
          const mindAndSoul = this.upgrades.level('MIND_AND_SOUL');
          const effectiveFamiliars = FAMILIAR.JACKS_PER_FAMILIAR + mindAndSoul * FAMILIAR.MIND_AND_SOUL_PER_LEVEL;
          const famScaledRaw = effectiveFamiliars * relicMult * jackdUpMult;
          const clicks = Math.floor(famScaledRaw) + (Math.random() < (famScaledRaw % 1) ? 1 : 0);
          if (key === 'artisan') {
            this.handleArtisanJackBatch(clicks);
          } else {
            for (let i = 0; i < clicks; i++) performJackAutoClick(key, ctx);
          }
        }

        // ── Chimeramancer Relic (familiars): also click all other hero buttons ──
        if (this.chimeramancerRelicEnabled && this.upgrades.level('RELIC_CHIMERAMANCER') >= 1) {
          const chimeraFamExpiry = this.familiarTimers['chimeramancer'] ?? 0;
          if (chimeraFamExpiry > Date.now() && !this.familiarsPaused && !this.familiarPausedKeys['chimeramancer']) {
            const chimeraRelicMult = 2; // relic is active → 2×
            const mindAndSoul = this.upgrades.level('MIND_AND_SOUL');
            const effectiveFamiliars = FAMILIAR.JACKS_PER_FAMILIAR + mindAndSoul * FAMILIAR.MIND_AND_SOUL_PER_LEVEL;
            const famScaledRaw = effectiveFamiliars * chimeraRelicMult * jackdUpMult;
            const famClicks = Math.floor(famScaledRaw) + (Math.random() < (famScaledRaw % 1) ? 1 : 0);
            const otherCharIds = ['fighter', 'ranger', 'apothecary', 'culinarian', 'thief',
              'necromancer-defile', 'necromancer-ward', 'merchant',
              'artificer-study', 'artificer-reflect'];
            for (let i = 0; i < famClicks; i++) {
              for (const otherId of otherCharIds) {
                performJackAutoClick(otherId, ctx);
              }
              this.handleArtisanJackBatch(1);
            }
          }
        }

        // Prune expired timers and recalc rates
        if (anyExpired) {
          const cleaned: Record<string, number> = {};
          for (const [k, v] of Object.entries(this.familiarTimers)) {
            const isPaused = this.familiarsPaused || !!this.familiarPausedKeys[k];
            if (isPaused || v > now) cleaned[k] = v;
          }
          this.familiarTimers = cleaned;
          this.updateAllPerSecond();
        }
      }
    }, 1000);
  }

  ngOnInit(): void {
    this.saveService.registerUpgradeHandlers(
      () => this.getUpgradeState(),
      (s) => this.setUpgradeState(s),
    );
    this.saveService.hideMaxedUpgrades$.subscribe(v    => { this.hideMaxedUpgrades = v; this._refreshDerived(); });
    this.saveService.hideMinigameUpgrades$.subscribe(v => { this.hideMinigameUpgrades = v; this._refreshDerived(); });
    this.saveService.blandMode$.subscribe(v            => this.blandMode            = v);

    // Keep --log-height in sync so sidebars shrink when the log is expanded.
    this.log.minimized$.subscribe(minimized => {
      const px = minimized ? 30 : 210;
      document.documentElement.style.setProperty('--log-height', `${px}px`);
    });

    if (this.saveService.hasSave()) this.saveService.loadFromLocalStorage();
    // After save restore, clear any shine that was triggered by loading previously-unlocked state
    this.charShine = new Set<string>();
    // Snapshot visible upgrades so we only shine on genuinely new ones
    this._initVisibleUpgradeCache();
    this.sidequestCollapsed = this.saveService.sidequestCollapsed;
    this.saveService.startAutoSave();
    // Start the playtime counter
    this.statsService.startPlaytimeTimer();
  }

  ngOnDestroy(): void {
    this.saveService.stopAutoSave();
    this.heroHoldStop();
    this.stopSlayerButtonCycle();
    this._stopSlayerAutoAttack();
    this._stopCondemnCleanup();
  }

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    if (!this.saveService.consumeSuppression()) this.saveService.saveToLocalStorage();
  }

  // ── Save state ─────────────────────────────────────────────────

  getUpgradeState(): UpgradeState {
    return {
      upgradeLevels:           this.upgrades.snapshot(),
      selectedKoboldLevel:     this.selectedKoboldLevel,
      minigameUnlocked:        this.minigameUnlocked,
      jackdUpUnlocked:         this.jackdUpUnlocked,
      jacksOwned:              this.jacksOwned,
      jacksAllocations:        { ...this.jacksAllocations },
      fighterCombatState:      this.fighterCombatState ?? undefined,
      shortRestEnabled:        this.shortRestEnabled,
      wholesaleSpicesEnabled:  this.wholesaleSpicesEnabled,
      dilutionEnabled:         this.dilutionEnabled,
      synapticalEnabled:       this.synapticalEnabled,
      fermentationVatsEnabled: this.fermentationVatsEnabled,
      koboldBaitEnabled:       this.koboldBaitEnabled,
      ancientCookbookEnabled:  this.ancientCookbookEnabled,
      firstStrikeEnabled:      this.firstStrikeEnabled,
      artisanTimerUntil:       this.artisanTimerUntil,
      artisanTimerBatchSize:   this.artisanTimerBatchSize,
      necromancerActiveButton:     this.necromancerActiveButton,
      necromancerClicksRemaining:  this.necromancerClicksRemaining,
      familiarTimers:              { ...this.familiarTimers },
      familiarsPaused:             this.familiarsPaused,
      familiarPausedKeys:          { ...this.familiarPausedKeys },
      familiarPausedAt:            { ...this.familiarPausedAt },
      beads:                       JSON.parse(JSON.stringify(this.beadState)),
      autoSolveEnabled:            { ...this.autoSolveEnabled },
      gold2Progress:               JSON.parse(JSON.stringify(this.gold2Progress)),
      merchantAutoBuySelections:   { ...this.merchantAutoBuySelections },
      artificerActiveButton:       this.artificerActiveButton,
      artificerInsight:            this.artificerInsight,
      selectedEtchingLevel:        this.selectedEtchingLevel,
      chimeramancerContributions:  this.chimeramancerContributions ?? undefined,
      chimeramancerRelicEnabled:   this.chimeramancerRelicEnabled,
      slayerMode:                  this.slayerMode,
      slayerState:                 { hp: this.slayerHp, damageDone: this.slayerDamageDone },
      vorpalBladeSocketed:         this.vorpalBladeSocketed,
      deadCharacters:              [...this.deadCharacters],
      trueResurrected:             this.trueResurrected,
    };
  }

  setUpgradeState(s: UpgradeState): void {
    this.upgrades.restore(s.upgradeLevels);
    this.updateSlowBladeMax();
    this.selectedKoboldLevel = clamp(
      s.selectedKoboldLevel ?? 1,
      1,
      this.upgrades.level('STRONGER_KOBOLDS') + 1,
    );
    this.minigameUnlocked        = s.minigameUnlocked        ?? false;
    this.jackdUpUnlocked         = s.jackdUpUnlocked         ?? false;
    this.jacksOwned              = s.jacksOwned              ?? 0;
    this.jacksAllocations        = s.jacksAllocations ? { ...s.jacksAllocations } : {};
    this.fighterCombatState      = s.fighterCombatState      ?? null;
    this.shortRestEnabled        = s.shortRestEnabled        ?? false;
    this.wholesaleSpicesEnabled  = s.wholesaleSpicesEnabled  ?? true;
    this.dilutionEnabled         = s.dilutionEnabled         ?? false;
    this.synapticalEnabled       = s.synapticalEnabled       ?? false;
    this.fermentationVatsEnabled = s.fermentationVatsEnabled ?? true;
    this.koboldBaitEnabled       = s.koboldBaitEnabled       ?? false;
    this.ancientCookbookEnabled  = s.ancientCookbookEnabled  ?? true;
    this.firstStrikeEnabled      = s.firstStrikeEnabled      ?? true;
    // Restore necromancer state
    this.necromancerActiveButton     = s.necromancerActiveButton     ?? 'defile';
    this.necromancerClicksRemaining  = s.necromancerClicksRemaining  ?? 10;
    // Restore familiar timers — prune any that have expired while the game was closed
    // (but keep timers that were paused when saved — they were frozen so still valid)
    const now = Date.now();
    const rawTimers = s.familiarTimers ?? {};
    const restoredPausedKeys: Record<string, boolean> = s.familiarPausedKeys ? { ...s.familiarPausedKeys } : {};
    const restoredPausedAt: Record<string, number> = s.familiarPausedAt ? { ...s.familiarPausedAt } : {};
    const restoredTimers: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawTimers)) {
      const wasPaused = !!restoredPausedKeys[k] || (s.familiarsPaused ?? false);
      if (wasPaused) {
        // Timer was frozen — extend by time elapsed while game was closed
        const pausedAt = restoredPausedAt[k] ?? now;
        const elapsed = now - pausedAt;
        restoredTimers[k] = v + elapsed;
        restoredPausedAt[k] = now; // reset pause reference point to now
      } else if (v > now) {
        restoredTimers[k] = v;
      }
    }
    this.familiarTimers = restoredTimers;
    this.familiarsPaused = s.familiarsPaused ?? false;
    this.familiarsPausedAt = this.familiarsPaused ? now : null;
    this.familiarPausedKeys = restoredPausedKeys;
    this.familiarPausedAt = restoredPausedAt;
    // Restore bead state
    this.beadState = s.beads ? JSON.parse(JSON.stringify(s.beads)) : {};
    this.syncBeadMultipliers();
    // Migrate: if slayer gold beads were already purchased in an older save,
    // auto-socket them so existing players don't lose their bonuses.
    this._migrateSlayerBeads();
    // Restore auto-solve toggle state
    this.autoSolveEnabled = s.autoSolveEnabled ? { ...s.autoSolveEnabled } : {};
    // Restore gold-2 progress state
    this.gold2Progress = s.gold2Progress ? JSON.parse(JSON.stringify(s.gold2Progress)) : {};
    // Restore merchant auto-buyer selections
    this.merchantAutoBuySelections = s.merchantAutoBuySelections ? { ...s.merchantAutoBuySelections } : {};
    // Restore artificer state
    this.artificerActiveButton = s.artificerActiveButton ?? 'study';
    this.artificerInsight      = s.artificerInsight      ?? 0;
    this.selectedEtchingLevel  = clamp(
      s.selectedEtchingLevel ?? this.upgrades.level('EXTENDED_ETCHING'),
      0,
      this.upgrades.level('EXTENDED_ETCHING'),
    );
    // Restore chimeramancer contributions
    this.chimeramancerContributions = s.chimeramancerContributions
      ? { ...s.chimeramancerContributions }
      : null;
    this.chimeramancerRelicEnabled = s.chimeramancerRelicEnabled ?? true;
    // Restore slayer state
    this.slayerMode = s.slayerMode ?? false;
    if (s.slayerState) {
      this.slayerHp = s.slayerState.hp ?? SLAYER.MAX_HP;
      this.slayerDamageDone = s.slayerState.damageDone ?? 0;
    }
    this.vorpalBladeSocketed = s.vorpalBladeSocketed ?? false;
    this.trueResurrected     = s.trueResurrected     ?? false;
    // If chimera was already killed, restore the slain visual state
    if (this.slayerHp <= 0 && this.slayerMode) {
      this.chimeraSlain = true;
      this.slayerFrozen = true;
    }
    // When slayer mode is active, ALL non-slayer characters must be dead.
    // If the game was saved mid-death-sequence, deadCharacters may be incomplete —
    // so rebuild the full list from all unlocked non-slayer characters.
    if (this.slayerMode) {
      const allNonSlayer = this.charService.getCharacters()
        .filter(c => c.id !== 'slayer' && c.unlocked)
        .map(c => c.id);
      this.deadCharacters = allNonSlayer;
      this.charService.setDead(allNonSlayer);
      // Sequence is never mid-flight after a reload — always treat as complete
      this.slayerDeathSequencePlaying = false;
    } else {
      this.deadCharacters = s.deadCharacters ? [...s.deadCharacters] : [];
      if (this.deadCharacters.length > 0) {
        this.charService.setDead(this.deadCharacters);
      }
    }
    // Derive slayerUnlocked from the character service — characters are already
    // restored (step 3 of applySnapshot) before setUpgradeState is called (step 5).
    this.slayerUnlocked = this.charService.getCharacters().find(c => c.id === 'slayer')?.unlocked ?? false;
    if (this.slayerMode && this.slayerHp > 0) {
      this.startSlayerButtonCycle();
    }
    // Restart auto-attack if slayer is unlocked and chimera still alive
    if (this.slayerUnlocked && this.slayerHp > 0) {
      this._startSlayerAutoAttack();
    }
    // Restore artisan timer — if still in the future, reschedule the completion callback
    this.artisanTimerUntil     = s.artisanTimerUntil     ?? 0;
    this.artisanTimerBatchSize = s.artisanTimerBatchSize  ?? 0;
    if (this.isArtisanTimerActive) {
      this.scheduleArtisanTimerCompletion(this.artisanTimerUntil - Date.now());
    } else {
      // Timer expired while offline — award the yields immediately
      if (this.artisanTimerBatchSize > 0) {
        this.completeArtisanTimer();
      }
    }
    this.updateAllPerSecond();
  }

  /**
   * Backward-compat migration: if a slayer gold bead upgrade was already
   * purchased in an older save (before the socketing mechanic was added),
   * auto-find AND auto-socket the bead so the player doesn't lose the bonus.
   * New purchases will only mark the bead as "found" and require manual socketing.
   */
  private _migrateSlayerBeads(): void {
    const migrate = (upgradeId: string, slotId: 'gold-1' | 'gold-2') => {
      if (this.upgrades.level(upgradeId) >= 1) {
        this.ensureBeadState('slayer');
        const slot = this.beadState['slayer']![slotId];
        if (!slot.found) {
          // Pre-existing purchase: auto-socket for backward compatibility
          slot.found = true;
          slot.socketed = true;
        }
      }
    };
    migrate('SLAYER_GOLD_BEAD_1', 'gold-1');
    migrate('SLAYER_GOLD_BEAD_2', 'gold-2');
    this.beadState = { ...this.beadState };
  }

  // ── Per-second display rates ───────────────────────────────────

  /** Keep SLOW_BLADE's effective max in sync with Sharper Swords level.
   *  Max = (sharperSwords + 1) - 5 = sharperSwords - 4 (minimum 0). */
  private updateSlowBladeMax(): void {
    const sharperSwords = this.upgrades.level('SHARPER_SWORDS');
    this.upgrades.setMaxOverride('SLOW_BLADE', Math.max(0, sharperSwords - 4));
  }

  private updateAllPerSecond(): void {
    const ctx = {
      upgrades:                this.upgrades,
      jacksAllocations:        this.jacksAllocations,
      jackStarved:             this.jackStarved,
      isThiefStunned:          this.isThiefStunned,
      isArtisanTimerActive:    this.isArtisanTimerActive,
      wholesaleSpicesEnabled:  this.wholesaleSpicesEnabled,
      fermentationVatsEnabled: this.fermentationVatsEnabled,
      relicLevels: {
        fighter:       this.upgrades.level('RELIC_FIGHTER'),
        ranger:        this.upgrades.level('RELIC_RANGER'),
        apothecary:    this.upgrades.level('RELIC_APOTHECARY'),
        culinarian:    this.upgrades.level('RELIC_CULINARIAN'),
        thief:         this.upgrades.level('RELIC_THIEF'),
        artisan:       this.upgrades.level('RELIC_ARTISAN'),
        necromancer:   this.upgrades.level('RELIC_NECROMANCER'),
        merchant:      this.upgrades.level('RELIC_MERCHANT'),
        artificer:     this.upgrades.level('RELIC_ARTIFICER'),
        chimeramancer: this.upgrades.level('RELIC_CHIMERAMANCER'),
      },
      necromancerActiveButton: this.necromancerActiveButton,
      familiarTimers: this.familiarTimers,
      jackdUpUnlocked: this.jackdUpUnlocked,
      familiarsPaused: this.familiarsPaused,
      familiarPausedKeys: { ...this.familiarPausedKeys },
      beadMultipliers: {
        fighter:     this.wallet.getBeadMultiplier('fighter'),
        ranger:      this.wallet.getBeadMultiplier('ranger'),
        apothecary:  this.wallet.getBeadMultiplier('apothecary'),
        culinarian:  this.wallet.getBeadMultiplier('culinarian'),
        thief:       this.wallet.getBeadMultiplier('thief'),
        artisan:     this.wallet.getBeadMultiplier('artisan'),
        necromancer: this.wallet.getBeadMultiplier('necromancer'),
        merchant:    this.wallet.getBeadMultiplier('merchant'),
        artificer:   this.wallet.getBeadMultiplier('artificer'),
        chimeramancer: this.wallet.getBeadMultiplier('chimeramancer'),
      },
      merchantAutoBuyers: this.merchantAutoBuyerInfo,
      artificerActiveButton: this.artificerActiveButton,
      artificerInsight: this.artificerInsight,
      selectedKoboldLevel: this.selectedKoboldLevel,
      chimeramancerRelicEnabled: this.chimeramancerRelicEnabled,
      slayerUnlocked:    this.slayerUnlocked,
      slayerChimeraDead: this.slayerHp <= 0,
      slayerBead1Socketed: this.slayerBead1Socketed,
      slayerBead2Socketed: this.slayerBead2Socketed,
      activeCondemnStacks: this.activeCondemnStacks,
    };
    const rates = calculatePerSecondRates(ctx);
    this.wallet.batchUpdate(() => {
      this.wallet.setPerSecond('gold',            rates.gold);
      this.wallet.setPerSecond('xp',              rates.xp);
      this.wallet.setPerSecond('herb',            rates.herb);
      this.wallet.setPerSecond('beast',           rates.beast);
      this.wallet.setPerSecond('potion',          rates.potion);
      this.wallet.setPerSecond('spice',           rates.spice);
      this.wallet.setPerSecond('dossier',         rates.dossier);
      this.wallet.setPerSecond('treasure',        rates.treasure);
      this.wallet.setPerSecond('precious-metal',  rates['precious-metal']);
      this.wallet.setPerSecond('gemstone',        rates.gemstone);
      this.wallet.setPerSecond('jewelry',         rates.jewelry);
      this.wallet.setPerSecond('bone',            rates.bone);
      this.wallet.setPerSecond('brimstone',       rates.brimstone);
      this.wallet.setPerSecond('illicit-goods',   rates['illicit-goods']);
      this.wallet.setPerSecond('mana',             rates.mana);
      this.wallet.setPerSecond('construct',        rates.construct);
      this.wallet.setPerSecond('concentrated-potion', rates['concentrated-potion']);
      this.wallet.setPerSecond('pixie-dust',       rates['pixie-dust']);
      this.wallet.setPerSecond('hearty-meal',      rates['hearty-meal']);
      this.wallet.setPerSecond('soul-stone',       rates['soul-stone']);
      this.wallet.setPerSecond('synaptical-potion', rates['synaptical-potion']);
      this.wallet.setPerSecond('kobold-ear',        rates['kobold-ear']);
      this.wallet.setPerSecond('kobold-tongue',     rates['kobold-tongue']);
      this.wallet.setPerSecond('kobold-hair',       rates['kobold-hair']);
      this.wallet.setPerSecond('kobold-fang',       rates['kobold-fang']);
      this.wallet.setPerSecond('kobold-brain',      rates['kobold-brain']);
      this.wallet.setPerSecond('kobold-feather',    rates['kobold-feather']);
      this.wallet.setPerSecond('kobold-pebble',     rates['kobold-pebble']);
      this.wallet.setPerSecond('kobold-heart',      rates['kobold-heart']);
      this.wallet.setPerSecond('monster-trophy',    rates['monster-trophy']);
      this.wallet.setPerSecond('forbidden-tome',    rates['forbidden-tome']);
      this.wallet.setPerSecond('magical-implement', rates['magical-implement']);
      this.wallet.setPerSecond('life-thread',       rates['life-thread']);
      this.wallet.setPerSecond('ichor',              rates.ichor);
      this.wallet.setPerSecondBreakdown(calculatePerSecondBreakdown(ctx));
    });
  }

  /**
   * Recompute all cached template bindings (jack costs, hero stats,
   * visible upgrades, etc.). Called after any state change that might
   * affect the template.
   */
  private _refreshDerived(): void {
    // Jack costs & affordability
    this.jackCurrentCosts = calculateJackCosts(this.jacksOwned);
    this.canAffordJack = canAffordJackCosts(this.jackCurrentCosts, (c, a) => this.wallet.canAfford(c, a));

    // Active character info
    this.activeCharacterInfo = this.unlockedCharacters.find(c => c.id === this.activeCharacterId);

    // Hero stats
    this.heroStats = buildHeroStats(this.activeCharacterId, {
      upgrades:               this.upgrades,
      wallet:                 this.wallet,
      minigameUnlocked:       this.minigameUnlocked,
      wholesaleSpicesEnabled: this.wholesaleSpicesEnabled,
      jacksAllocations:       this.jacksAllocations,
      isThiefStunned:         this.isThiefStunned,
      relicLifetimeCount:     this.statsService.current.lifetimeCurrency['relic'] ?? 0,
      necromancerActiveButton:     this.necromancerActiveButton,
      necromancerClicksRemaining:  this.necromancerClicksRemaining,
      artificerActiveButton:       this.artificerActiveButton,
      artificerInsight:            this.artificerInsight,
      slayerHp:                    this.slayerHp,
      slayerDamageDone:            this.slayerDamageDone,
      condemnStacks:               this.activeCondemnStacks,
      slayerBead1Socketed:         this.slayerBead1Socketed,
      slayerBead2Socketed:         this.slayerBead2Socketed,
      vorpalBladeSocketed:         this.vorpalBladeSocketed,
    });

    // Visible upgrades (per category)
    this._visibleUpgradesCache = {
      standard: this._computeVisibleUpgrades('standard'),
      minigame: this._computeVisibleUpgrades('minigame'),
      relic:    this._computeVisibleUpgrades('relic'),
    };

    // Relic unpurchased flag
    this.anyRelicUnpurchased = (this._visibleUpgradesCache['relic'] ?? []).some(id => !this.upgrades.isMaxed(id));

    // Relic crown slots
    this.relicSlots = (this._visibleUpgradesCache['relic'] ?? []).map(id => ({
      id,
      name: this.getUpgradeFlavor(id).name,
      purchased: this.upgrades.isMaxed(id),
    }));

    // Bead + relic crown items for the active character
    this.beadCrownItems = this._buildBeadCrownItems();
    this.anyBeadUnsocketed = this.beadCrownItems.some(
      item => item.kind === 'bead' && item.beadState === 'found'
    );
  }

  /** Compute visible upgrade IDs for a category (used by _refreshDerived). */
  private _computeVisibleUpgrades(category: UpgradeCategory): string[] {
    return this.upgrades.getUpgradesFor(this.activeCharacterId, category)
      .filter(id => {
        if (!this.isUpgradeVisible(id)) return false;
        if (category === 'relic') return true;
        return this.shouldShowUpgrade(this.upgrades.isMaxed(id));
      });
  }

  /**
   * Check all unlocked non-active characters for newly visible upgrades.
   * If a character gained new visible upgrades, shine it.
   */
  private _checkUpgradeVisibilityShines(): void {
    for (const char of this.unlockedCharacters) {
      const standard = this.upgrades.getUpgradesFor(char.id, 'standard').filter(id => this.isUpgradeVisible(id));
      const minigame = this.upgrades.getUpgradesFor(char.id, 'minigame').filter(id => this.isUpgradeVisible(id));
      const currentIds = new Set([...standard, ...minigame]);

      const prevIds = this._prevVisibleUpgradeIdsByChar[char.id];
      if (prevIds) {
        for (const id of currentIds) {
          if (!prevIds.has(id)) {
            this.addCharShine(char.id);
            break;
          }
        }
      }
      this._prevVisibleUpgradeIdsByChar[char.id] = currentIds;
    }
  }

  /** Initialize the visible-upgrade cache for all characters (call after save load). */
  private _initVisibleUpgradeCache(): void {
    this._prevVisibleUpgradeIdsByChar = {};
    for (const char of this.unlockedCharacters) {
      const standard = this.upgrades.getUpgradesFor(char.id, 'standard').filter(id => this.isUpgradeVisible(id));
      const minigame = this.upgrades.getUpgradesFor(char.id, 'minigame').filter(id => this.isUpgradeVisible(id));
      this._prevVisibleUpgradeIdsByChar[char.id] = new Set([...standard, ...minigame]);
    }
  }

  /** Build the combined bead + relic crown display items for the active character. */
  private _buildBeadCrownItems(): { kind: 'bead' | 'relic'; slotId?: string; beadType?: BeadType; beadState?: 'locked' | 'found' | 'socketed'; relicId?: string; relicPurchased?: boolean; relicFound?: boolean; relicName?: string }[] {
    if (!this.minigameUnlocked) return [];

    const charId = this.activeCharacterId;
    const items: { kind: 'bead' | 'relic'; slotId?: string; beadType?: BeadType; beadState?: 'locked' | 'found' | 'socketed'; relicId?: string; relicPurchased?: boolean; relicFound?: boolean; relicName?: string }[] = [];

    // Left beads: blue-1, gold-1
    items.push(this._makeBeadItem(charId, 'blue-1', 'blue'));
    items.push(this._makeBeadItem(charId, 'gold-1', 'gold'));

    // Center: active character's relic
    if (charId === 'slayer') {
      // Slayer Vorpal Blade: purchased from sidequest, then socketed separately in the crown
      const vorpalPurchased = this.upgrades.level('RELIC_SLAYER') >= 1;
      items.push({
        kind: 'relic',
        relicId: 'RELIC_SLAYER',
        relicPurchased: this.vorpalBladeSocketed,
        relicFound: vorpalPurchased && !this.vorpalBladeSocketed,
        relicName: 'Vorpal Blade',
      });
    } else {
      const relicId = `RELIC_${charId.toUpperCase()}`;
      const relicSlot = this.relicSlots.find(s => s.id === relicId);
      if (relicSlot) {
        items.push({
          kind: 'relic',
          relicId: relicSlot.id,
          relicPurchased: relicSlot.purchased,
          relicName: relicSlot.name,
        });
      }
    }

    // Right beads: gold-2, blue-2
    items.push(this._makeBeadItem(charId, 'gold-2', 'gold'));
    items.push(this._makeBeadItem(charId, 'blue-2', 'blue'));

    return items;
  }

  /** Create a single bead crown item. */
  private _makeBeadItem(charId: string, slotId: string, type: BeadType): { kind: 'bead'; slotId: string; beadType: BeadType; beadState: 'locked' | 'found' | 'socketed' } {
    const s = this.getBeadSlot(charId, slotId);
    let state: 'locked' | 'found' | 'socketed' = 'locked';
    if (s.socketed) state = 'socketed';
    else if (s.found) state = 'found';
    return { kind: 'bead', slotId, beadType: type, beadState: state };
  }

  /**
   * Set the dynamic max for Relic Hunter = number of currently unlocked characters.
   * Called whenever the characters list changes.
   */
  private updateRelicHunterMax(chars: { unlocked: boolean }[]): void {
    const count = chars.filter(c => c.unlocked).length;
    this.upgrades.setMaxOverride('RELIC_HUNTER', count);
  }

  // ── Hero click actions ─────────────────────────────────────────

  heroPressAnim = false;
  private heroPressTimeout?: ReturnType<typeof setTimeout>;
  readonly heroPulseColor = HERO_PRESS_PULSE_COLOR;

  clickHero(): void {
    // Trigger border pulse animation
    this.heroPressAnim = false;
    clearTimeout(this.heroPressTimeout);
    // Force a reflow so re-adding the class restarts the animation
    requestAnimationFrame(() => {
      this.heroPressAnim = true;
      this.heroPressTimeout = setTimeout(() => this.heroPressAnim = false, 300);
    });

    dispatchHeroClick(this.activeCharacterId, this.buildHeroActionCtx());
    if (this.activeCharacterId === 'necromancer') {
      this._refreshDerived();
      this.updateAllPerSecond();
    }
    if (this.activeCharacterId === 'artificer') {
      this._refreshDerived();
      this.updateAllPerSecond();
    }
  }

  // ── Hold-to-auto-click hero button ────────────────────────────
  private heroHoldInterval: ReturnType<typeof setInterval> | null = null;
  heroHolding = false;

  heroHoldStart(): void {
    this.heroHoldStop();
    this.heroHolding = true;
    this.heroHoldInterval = setInterval(() => {
      if (this.isHeroDisabled) return;
      this.clickHero();
    }, 200);
  }

  heroHoldStop(): void {
    this.heroHolding = false;
    if (this.heroHoldInterval) {
      clearInterval(this.heroHoldInterval);
      this.heroHoldInterval = null;
    }
  }


  toggleWholesaleSpices(): void {
    this.wholesaleSpicesEnabled = !this.wholesaleSpicesEnabled;
    this.updateAllPerSecond();
  }

  toggleFermentationVats(): void {
    this.fermentationVatsEnabled = !this.fermentationVatsEnabled;
    this.updateAllPerSecond();
  }

  toggleChimeramancerRelic(): void {
    this.chimeramancerRelicEnabled = !this.chimeramancerRelicEnabled;
    this.updateAllPerSecond();
  }

  // ── Thief stun management ──────────────────────────────────────

  /**
   * Apply the thief stun: set the expiry timestamp, lock in the animation style,
   * immediately recalculate per-second rates (→ 0 while stunned), then schedule
   * another recalculation the moment the stun expires so the display restores.
   *
   * **Guard**: if the stun-until timestamp is already in the future the call is
   * a no-op — this ensures the timer can never be extended or reset.
   */
  private applyThiefStun(): void {
    if (this.thiefStunUntil > Date.now()) return;
    if (this.thiefStunTimeoutId !== null) {
      clearTimeout(this.thiefStunTimeoutId);
      this.thiefStunTimeoutId = null;
    }
    this.thiefStunUntil = Date.now() + YIELDS.THIEF_STUN_DURATION_MS;
    this.thiefStunAnimStyle = {
      'animation-duration': `${YIELDS.THIEF_STUN_DURATION_MS / 1000}s`,
      'animation-delay':    '0s',
    };
    this.updateAllPerSecond();
    this.thiefStunTimeoutId = setTimeout(() => {
      this.thiefStunTimeoutId = null;
      this.updateAllPerSecond();
    }, YIELDS.THIEF_STUN_DURATION_MS + 50);
  }

  /**
   * Recompute the stun-bar animation style mid-stun (e.g. when the player
   * switches back to the thief panel while a stun is already in progress).
   */
  private refreshThiefStunAnimStyle(): void {
    if (!this.isThiefStunned) return;
    const total   = YIELDS.THIEF_STUN_DURATION_MS;
    const elapsed = total - Math.max(0, this.thiefStunUntil - Date.now());
    this.thiefStunAnimStyle = {
      'animation-duration': `${total / 1000}s`,
      'animation-delay':    `-${elapsed / 1000}s`,
    };
  }

  // ── Artisan timer management ───────────────────────────────────

  /**
   * Start the artisan appraisal timer.
   * @param batchSize 1 for a manual click; jackCount for a jack batch.
   */
  private startArtisanTimer(batchSize: number, isJack: boolean = false): void {
    if (this.isArtisanTimerActive) return;

    const duration = calcArtisanTimerMs(this.upgrades.level('FASTER_APPRAISING'));
    this.artisanTimerUntil       = Date.now() + duration;
    this.artisanTimerBatchSize   = batchSize;
    this.artisanTimerIsJackBatch = isJack;
    this.artisanTimerAnimStyle = {
      'animation-duration': `${duration / 1000}s`,
      'animation-delay':    '0s',
    };
    this.updateAllPerSecond();
    this.scheduleArtisanTimerCompletion(duration);
  }

  /** Schedule the completion callback for the artisan timer. */
  private scheduleArtisanTimerCompletion(delayMs: number): void {
    if (this.artisanTimerTimeoutId !== null) {
      clearTimeout(this.artisanTimerTimeoutId);
    }
    this.artisanTimerTimeoutId = setTimeout(() => {
      this.artisanTimerTimeoutId = null;
      this.completeArtisanTimer();
    }, Math.max(0, delayMs) + 50);
  }

  /** Award yields when the artisan timer completes. */
  private completeArtisanTimer(): void {
    const batchSize = this.artisanTimerBatchSize;
    if (batchSize <= 0) return;

    const catsPawLevel = this.upgrades.level('POTION_CATS_PAW');
    const isJack       = this.artisanTimerIsJackBatch;
    const hasRelic     = isJack && this.upgrades.level('RELIC_ARTISAN') >= 1;
    const artisanMult  = this.wallet.getBeadMultiplier('artisan');
    let totalGemstones = 0;
    let totalMetals    = 0;
    for (let i = 0; i < batchSize; i++) {
      totalGemstones += hasRelic ? calcArtisanGemstoneYieldJack(catsPawLevel, true) : calcArtisanGemstoneYield(catsPawLevel);
      totalMetals    += hasRelic ? calcArtisanMetalYieldJack(catsPawLevel, true) : calcArtisanMetalYield(catsPawLevel);
    }
    totalGemstones = totalGemstones * artisanMult;
    totalMetals    = totalMetals * artisanMult;
    const xpAwarded = batchSize * artisanMult;

    this.wallet.add('gemstone', totalGemstones);
    this.wallet.add('precious-metal', totalMetals);
    this.wallet.add('xp', xpAwarded);
    this.statsService.trackCurrencyGain('gemstone', totalGemstones);
    this.statsService.trackCurrencyGain('precious-metal', totalMetals);
    this.statsService.trackCurrencyGain('xp', xpAwarded);
    this.statsService.trackArtisanAppraisal(batchSize);

    if (!isJack) {
      this.log.log(
        LOG_MSG.SYSTEM.APPRAISAL_COMPLETE(cur('gemstone', totalGemstones), cur('precious-metal', totalMetals), cur('xp', xpAwarded)),
        'success',
      );
    }

    // Reset timer state
    this.artisanTimerBatchSize   = 0;
    this.artisanTimerIsJackBatch = false;
    this.updateAllPerSecond();
  }

  /** Recompute the artisan timer animation style mid-timer (e.g. when switching to the artisan tab). */
  private refreshArtisanTimerAnimStyle(): void {
    if (!this.isArtisanTimerActive) return;
    const total   = calcArtisanTimerMs(this.upgrades.level('FASTER_APPRAISING'));
    const elapsed = total - Math.max(0, this.artisanTimerUntil - Date.now());
    this.artisanTimerAnimStyle = {
      'animation-duration': `${total / 1000}s`,
      'animation-delay':    `-${elapsed / 1000}s`,
    };
  }

  /**
   * Handle artisan jack batch: all allocated jacks share one timer.
   * Called once per second from the jack auto-click loop.
   */
  private handleArtisanJackBatch(jackCount: number): void {
    if (this.isArtisanTimerActive) return;

    const treasureCost = calcArtisanTreasureCost() * jackCount;
    if (!this.wallet.canAfford('treasure', treasureCost)) {
      if (!this.jackStarved['artisan']) {
        this.jackStarved = { ...this.jackStarved, artisan: true };
        this.updateAllPerSecond();
      }
      return;
    }
    if (this.jackStarved['artisan']) {
      this.jackStarved = { ...this.jackStarved, artisan: false };
    }

    this.wallet.remove('treasure', treasureCost);
    // Track jack presses for statistics
    for (let i = 0; i < jackCount; i++) {
      this.statsService.trackJackHeroPress('artisan');
    }
    this.startArtisanTimer(jackCount, true);
  }

  // ── Necromancer button switching ──────────────────────────────

  /**
   * Decrement the necromancer click counter. If it reaches 0,
   * switch the active button and roll a new threshold.
   * Returns true if the button was switched.
   */
  private necromancerDecrementClick(): boolean {
    this.necromancerClicksRemaining--;
    if (this.necromancerClicksRemaining <= 0) {
      this.switchNecromancerButton();
      return true;
    }
    return false;
  }

  /** Switch the active necromancer button and roll a new click threshold. */
  private switchNecromancerButton(): void {
    this.necromancerActiveButton = this.necromancerActiveButton === 'defile' ? 'ward' : 'defile';
    this.necromancerClicksRemaining = rollNecromancerSwitchClicks(this.upgrades.level('EXTENDED_RITUAL'));
    // Stop any active hold only if the player is currently on necromancer —
    // their held button just became disabled. If they're on a different character,
    // a jack triggered this switch and we must not cancel their hold.
    if (this.activeCharacterId === 'necromancer') {
      this.heroHoldStop();
    }
    this.updateAllPerSecond();
    this._refreshDerived();
  }

  /** Get the label for a specific necromancer button. */
  get necromancerDefileLabel(): string { return CHARACTER_FLAVOR.NECROMANCER.questBtnExhume; }
  get necromancerWardLabel(): string { return CHARACTER_FLAVOR.NECROMANCER.questBtnWard; }

  // ── Jack actions ───────────────────────────────────────────────

  buyJack(): void {
    if (this.jacksToPurchase <= 0) return;
    if (!this.canAffordJack) {
      this.log.log(LOG_MSG.SYSTEM.JACK_CANT_AFFORD, 'warn');
      return;
    }
    for (const c of this.jackCurrentCosts) {
      this.wallet.remove(c.currency, c.amount);
    }
    this.jacksOwned++;
    this.log.log(LOG_MSG.SYSTEM.JACK_HIRED(this.jacksOwned), 'success');
  }

  allocateJack(charId: string): void {
    if (this.jacksPoolFree <= 0) return;
    this.jacksAllocations = { ...this.jacksAllocations, [charId]: (this.jacksAllocations[charId] ?? 0) + 1 };
    this.updateAllPerSecond();
  }

  deallocateJack(charId: string): void {
    const current = this.jacksAllocations[charId] ?? 0;
    if (current <= 0) return;
    this.jacksAllocations = { ...this.jacksAllocations, [charId]: current - 1 };
    this.updateAllPerSecond();
  }

  /** Assign all free jacks to the current character. Requires ≥5 jacks owned. */
  allocateAllJacks(charId: string): void {
    if (this.jacksPoolFree <= 0) return;
    this.jacksAllocations = {
      ...this.jacksAllocations,
      [charId]: (this.jacksAllocations[charId] ?? 0) + this.jacksPoolFree,
    };
    this.updateAllPerSecond();
  }

  /** Remove all jacks assigned to the current character. Requires ≥5 jacks owned. */
  deallocateAllJacks(charId: string): void {
    if ((this.jacksAllocations[charId] ?? 0) <= 0) return;
    this.jacksAllocations = { ...this.jacksAllocations, [charId]: 0 };
    this.updateAllPerSecond();
  }

  /** Remove all jacks from every character. */
  unassignAllJacks(): void {
    this.jacksAllocations = {};
    this.updateAllPerSecond();
  }

  // ── Familiar actions ───────────────────────────────────────────

  /** Toggle the paused state of all familiars. */
  toggleFamiliarsPaused(): void {
    const now = Date.now();
    if (!this.familiarsPaused) {
      // Pausing globally — record pause time for all active, non-individually-paused timers
      this.familiarsPaused = true;
      this.familiarsPausedAt = now;
    } else {
      // Unpausing globally — extend all timers that were frozen by this global pause
      if (this.familiarsPausedAt !== null) {
        const elapsed = now - this.familiarsPausedAt;
        const extended: Record<string, number> = {};
        for (const [k, v] of Object.entries(this.familiarTimers)) {
          // Only extend timers not individually paused (they have their own pausedAt)
          extended[k] = !!this.familiarPausedKeys[k] ? v : v + elapsed;
        }
        this.familiarTimers = extended;
      }
      this.familiarsPaused = false;
      this.familiarsPausedAt = null;
    }
    this.updateAllPerSecond();
  }

  /** Toggle the paused state for a specific familiar key. */
  toggleFamiliarKeyPaused(key: string): void {
    const now = Date.now();
    const currentlyPaused = !!this.familiarPausedKeys[key];
    if (!currentlyPaused) {
      // Pausing this key — record when it was paused
      this.familiarPausedKeys = { ...this.familiarPausedKeys, [key]: true };
      this.familiarPausedAt = { ...this.familiarPausedAt, [key]: now };
    } else {
      // Unpausing this key — extend the timer by the time it was paused
      const pausedAt = this.familiarPausedAt[key] ?? now;
      const elapsed = now - pausedAt;
      if (this.familiarTimers[key] !== undefined) {
        this.familiarTimers = { ...this.familiarTimers, [key]: this.familiarTimers[key] + elapsed };
      }
      const updatedPausedKeys = { ...this.familiarPausedKeys };
      delete updatedPausedKeys[key];
      this.familiarPausedKeys = updatedPausedKeys;
      const updatedPausedAt = { ...this.familiarPausedAt };
      delete updatedPausedAt[key];
      this.familiarPausedAt = updatedPausedAt;
    }
    this.updateAllPerSecond();
  }

  /** Whether a specific familiar key is paused (individually or globally). */
  isFamiliarKeyPaused(key: string): boolean {
    return this.familiarsPaused || !!this.familiarPausedKeys[key];
  }

  /** Whether the Find Familiar upgrade is purchased. */
  get familiarUnlocked(): boolean {
    return this.upgrades.level('FIND_FAMILIAR') >= 1;
  }

  /**
   * Effective seconds added per Soul Stone fed to a familiar.
   * Base (FAMILIAR.TIME_PER_STONE_SEC) + Concentrated Souls bonus per level.
   */
  get familiarTimePerStoneSec(): number {
    return FAMILIAR.TIME_PER_STONE_SEC
      + this.upgrades.level('CONCENTRATED_SOULS') * FAMILIAR.CONCENTRATED_SOULS_BONUS_SEC;
  }

  /**
   * Effective maximum familiar time in seconds.
   * Base (FAMILIAR.MAX_TIME_SEC) + Vault of Souls bonus per level.
   */
  get familiarMaxTimeSec(): number {
    return FAMILIAR.MAX_TIME_SEC
      + this.upgrades.level('VAULT_OF_SOULS') * FAMILIAR.VAULT_OF_SOULS_BONUS_SEC;
  }

  /**
   * Returns the jack allocation keys that should show a familiar box.
   * This is every key that would appear if the character is the active one.
   * For necromancer it's 'necromancer-defile' and 'necromancer-ward'.
   */
  get familiarKeys(): string[] {
    if (!this.activeCharacterInfo) return [];
    const charId = this.activeCharacterInfo.id;
    if (charId === 'necromancer') return ['necromancer-defile', 'necromancer-ward'];
    if (charId === 'artificer') return ['artificer-study', 'artificer-reflect'];
    return [charId];
  }

  /** Friendly label for a familiar key. */
  familiarLabel(key: string): string {
    if (key === 'necromancer-defile') return 'Exhume';
    if (key === 'necromancer-ward')   return 'Ward';
    if (key === 'artificer-study')    return 'Study';
    if (key === 'artificer-reflect')  return 'Reflect';
    return 'Familiar';
  }

  /** Whether the familiar timer for a given key is currently active. */
  isFamiliarActive(key: string): boolean {
    return (this.familiarTimers[key] ?? 0) > Date.now();
  }

  /** Remaining familiar seconds for a given key. */
  getFamiliarRemainingSec(key: string): number {
    return Math.max(0, Math.ceil(((this.familiarTimers[key] ?? 0) - Date.now()) / 1000));
  }

  /** Remaining familiar time as a percentage of current max cap (for progress bar). */
  getFamiliarPct(key: string): number {
    const remaining = this.getFamiliarRemainingSec(key);
    return Math.min(100, Math.round((remaining / this.familiarMaxTimeSec) * 100));
  }

  /** Format remaining time as M:SS. */
  formatFamiliarTime(key: string): string {
    const sec = this.getFamiliarRemainingSec(key);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  /** Feed a single soul stone to a familiar, adding familiarTimePerStoneSec. */
  feedFamiliar(key: string): void {
    if (!this.familiarUnlocked) return;
    if (!this.wallet.canAfford('soul-stone', 1)) return;

    const now    = Date.now();
    const curEnd = Math.max(now, this.familiarTimers[key] ?? 0);
    const maxEnd = now + this.familiarMaxTimeSec * 1000;
    if (curEnd >= maxEnd) return; // already at max

    this.wallet.remove('soul-stone', 1);
    const newEnd = Math.min(curEnd + this.familiarTimePerStoneSec * 1000, maxEnd);
    this.familiarTimers = { ...this.familiarTimers, [key]: newEnd };
    this.updateAllPerSecond();
  }

  /** Feed as many soul stones as needed (and affordable) to fill the familiar to max. */
  feedFamiliarMax(key: string): void {
    if (!this.familiarUnlocked) return;

    const now    = Date.now();
    const curEnd = Math.max(now, this.familiarTimers[key] ?? 0);
    const maxEnd = now + this.familiarMaxTimeSec * 1000;
    if (curEnd >= maxEnd) return; // already at max

    const msNeeded      = maxEnd - curEnd;
    const stonesNeeded  = Math.ceil(msNeeded / (this.familiarTimePerStoneSec * 1000));
    const stonesHave    = Math.floor(this.wallet.get('soul-stone'));
    const stonesToSpend = Math.min(stonesNeeded, stonesHave);
    if (stonesToSpend <= 0) return;

    this.wallet.remove('soul-stone', stonesToSpend);
    const newEnd = Math.min(curEnd + stonesToSpend * this.familiarTimePerStoneSec * 1000, maxEnd);
    this.familiarTimers = { ...this.familiarTimers, [key]: newEnd };
    this.updateAllPerSecond();
  }

  /** Whether the familiar for this key can accept more time (not full and has soul stones). */
  canFeedFamiliar(key: string): boolean {
    if (!this.familiarUnlocked) return false;
    if (!this.wallet.canAfford('soul-stone', 1)) return false;
    const now    = Date.now();
    const curEnd = Math.max(now, this.familiarTimers[key] ?? 0);
    const maxEnd = now + this.familiarMaxTimeSec * 1000;
    return curEnd < maxEnd;
  }

  // ── Spreading Soul — Summon All ──────────────────────────────

  /** Whether the Spreading Soul upgrade is purchased. */
  get spreadingSoulUnlocked(): boolean {
    return this.upgrades.level('SPREADING_SOUL') >= 1;
  }

  /**
   * All jack allocation keys across all unlocked characters.
   * Used by Summon All to fill all familiar bars.
   */
  private get allFamiliarKeys(): string[] {
    const keys: string[] = [];
    for (const char of this.unlockedCharacters) {
      if (char.id === 'necromancer') {
        keys.push('necromancer-defile', 'necromancer-ward');
      } else if (char.id === 'artificer') {
        keys.push('artificer-study', 'artificer-reflect');
      } else {
        keys.push(char.id);
      }
    }
    return keys;
  }

  /** Whether SUMMON ALL can be used — has upgrade, familiar unlocked, has stones, and at least one familiar not maxed. */
  get canSummonAll(): boolean {
    if (!this.familiarUnlocked || !this.spreadingSoulUnlocked) return false;
    if (!this.wallet.canAfford('soul-stone', 1)) return false;
    const now = Date.now();
    const maxEndMs = this.familiarMaxTimeSec * 1000;
    return this.allFamiliarKeys.some(key => {
      const curEnd = Math.max(now, this.familiarTimers[key] ?? 0);
      return curEnd < now + maxEndMs;
    });
  }

  /**
   * Distribute soul stones across all familiar bars, prioritizing
   * the ones with the lowest remaining time to keep them balanced.
   * Spends one stone at a time to the neediest familiar until
   * all are full or stones run out.
   */
  summonAll(): void {
    if (!this.familiarUnlocked || !this.spreadingSoulUnlocked) return;

    const now = Date.now();
    const maxEndMs = now + this.familiarMaxTimeSec * 1000;
    const timePerStoneMs = this.familiarTimePerStoneSec * 1000;

    // Build a working copy of familiar end times
    const keys = this.allFamiliarKeys;
    const endTimes: Record<string, number> = {};
    for (const key of keys) {
      endTimes[key] = Math.max(now, this.familiarTimers[key] ?? 0);
    }

    let stonesAvailable = Math.floor(this.wallet.get('soul-stone'));
    let stonesSpent = 0;

    while (stonesAvailable > 0) {
      // Find the familiar with the lowest remaining time that isn't full
      let lowestKey: string | null = null;
      let lowestEnd = Infinity;
      for (const key of keys) {
        if (endTimes[key] < maxEndMs && endTimes[key] < lowestEnd) {
          lowestEnd = endTimes[key];
          lowestKey = key;
        }
      }
      if (!lowestKey) break; // all familiars are full

      // Feed one stone to the neediest familiar
      endTimes[lowestKey] = Math.min(endTimes[lowestKey] + timePerStoneMs, maxEndMs);
      stonesAvailable--;
      stonesSpent++;
    }

    if (stonesSpent > 0) {
      this.wallet.remove('soul-stone', stonesSpent);
      this.familiarTimers = { ...endTimes };
      this.updateAllPerSecond();
    }
  }

  // ── Minigame unlock ────────────────────────────────────────────

  buyMinigameUnlock(): void {
    if (this.minigameUnlocked) return;
    const costs = this.minigameCosts;
    if (!costs.every(c => this.wallet.canAfford(c.currency, c.amount))) {
      const missing = costs
        .filter(c => !this.wallet.canAfford(c.currency, c.amount))
        .map(c => cur(c.currency, c.amount, ''))
        .join(', ');
      this.log.log(LOG_MSG.SYSTEM.MINIGAME_CANT_AFFORD(missing), 'warn');
      return;
    }
    for (const c of costs) this.wallet.remove(c.currency, c.amount);
    this.minigameUnlocked = true;
    // Shine all unlocked characters since they each gain a new sidequest
    for (const c of this.unlockedCharacters) this.addCharShine(c.id);
    this.log.log(LOG_MSG.SYSTEM.MINIGAME_UNLOCKED, 'rare');
    this.statsService.recordMilestone('minigame_unlocked', 'Sidequests Unlocked');
  }

  buyJackdUp(): void {
    if (this.jackdUpUnlocked) return;
    const costs = this.jackdUpCosts;
    if (!costs.every(c => this.wallet.canAfford(c.currency, c.amount))) {
      const missing = costs
        .filter(c => !this.wallet.canAfford(c.currency, c.amount))
        .map(c => cur(c.currency, c.amount, ''))
        .join(', ');
      this.log.log(LOG_MSG.SYSTEM.JACKDUP_CANT_AFFORD(missing), 'warn');
      return;
    }
    for (const c of costs) this.wallet.remove(c.currency, c.amount);
    this.jackdUpUnlocked = true;
    this.updateAllPerSecond();
    this.log.log(LOG_MSG.SYSTEM.JACKDUP_UNLOCKED, 'rare');
    this.statsService.recordMilestone('jackdup_unlocked', "Jack'd Up Unlocked");
  }

  // ── Slayer endgame logic ─────────────────────────────────────

  /** Slayer ASCII art — displayed in precious-metal silver to the left of the
   *  Chimera once the Slayer character is unlocked. */
  readonly SLAYER_ART: string[] = [
    '                   _.--.    .--._',
    '                 ."  ."      ".  ".',
    '                ;  ."    /\\    ".  ;',
    '                ;  \'._,-/  \\-,_.`  ;',
    '                \\  ,`  / /\\ \\  `,  /',
    '                 \\/    \\/  \\/    \\/',
    '                 ,=_    \\/\\/    _=,',
    '                 |  "_   \\/   _"  |',
    '                 |_   \'\"-..-\"\'   _|',
    '                 | "-.        .-" |',
    '                 |    "\\    /"    |',
    '                 |      |  |      |',
    '         ___     |      |  |      |     ___',
    '     _,-",  ",   \'_     |  |     _\'   ,"  ,"-,_',
    '   _(  \\  \\   \\"=--"-.  |  |  .-"--="/   /  /  )_',
    ' ,"  \\  \\  \\   \\      "-\'--\'-"      /   /  /  /  ".',
    '!     \\  \\  \\   \\                  /   /  /  /     !',
    ':      \\  \\  \\   \\                /   /  /  /      :',
  ];

  /** Pre-joined slayer art string for use inside a &lt;pre&gt; tag. */
  get slayerArtText(): string { return this.SLAYER_ART.join('\n'); }

  /** The chimera ASCII art (same as in the chimeramancer minigame). */
  readonly CHIMERA_ART: string[] = [
    '                                             ,--,  ,.-.',
    '               ,                   \\,       \'-,-`,\'-.\' | ._',
    '              /|           \\    ,   |\\         }  )/  / `-,\',',
    '              [ ,          |\\  /|   | |        /  \\|  |/`  ,`',
    '              | |       ,.`  `,` `, | |  _,...(   (      .\',',
    '              \\  \\  __ ,-` `  ,  , `/ |,\'      Y     (   /_L\\',
    '               \\  \\_\\,``,   ` , ,  /  |         )         _,/',
    '                \\  \'  `  ,_ _`_,-,<._.<        /         /',
    '                 \', `>.,`  `  `   ,., |_      |         /',
    '                   \\/`  `,   `   ,`  | /__,.-`    _,   `\\',
    '               -,-..\\  _  \\  `  /  ,  / `._) _,-\\`       \\',
    '                \\_,,.) /\\    ` /  / ) (-,, ``    ,        |',
    '               ,` )  | \\_\\       \'-`  |  `(               \\',
    '              /  /```(   , --, ,\' \\   |`<`    ,            |',
    '             /  /_,--`\\   <\\  V /> ,` )<_/)  | \\      _____)',
    '       ,-, ,`   `   (_,\\ \\    |   /) / __/  /   `----`',
    '      (-, \\           ) \\ (\'_.-._)/ /,`    /',
    '      | /  `          `/ \\\\ V   V, /`     /',
    '   ,--\\(        ,     <_/`\\\\     ||      /',
    '  (   ,``-     \\/|         \\-A.A-`|     /',
    ' ,>,_ )_,..(    )\\          -,,_-`  _--`',
    '(_ \\|`   _,/_  /  \\_            ,--`',
    ' \\( `   <.,../`     `-.._   _,-`',
  ];

  /** Pre-joined chimera art string for use inside a &lt;pre&gt; tag. */
  get chimeraArtText(): string { return this.CHIMERA_ART.join('\n'); }

  /** Chimera health percentage for the progress bar. */
  get slayerHpPct(): number {
    return Math.max(0, (this.slayerHp / SLAYER.MAX_HP) * 100);
  }

  /**
   * Chimera damage tier for visual effects:
   *  0 = above 70%, 1 = below 70%, 2 = below 50%, 3 = below 25%.
   */
  get chimeraDamageTier(): number {
    const pct = this.slayerHpPct;
    if (pct <= 0)  return 0;          // dead — no blink
    if (pct < 25)  return 3;
    if (pct < 50)  return 2;
    if (pct < 70)  return 1;
    return 0;
  }

  /**
   * Slayer glow tier based on socketed beads:
   *  0 = nothing, 1 = bead 1 socketed, 2 = both beads socketed, 3 = both + relic (max).
   */
  get slayerGlowTier(): number {
    let tier = 0;
    if (this.slayerBead1Socketed) tier++;
    if (this.slayerBead2Socketed) tier++;
    if (this.vorpalBladeSocketed) tier++;
    // blue beads (from the regular bead system) add extra glow
    if (tier >= 3) tier = 4;  // all three → max tier
    return tier;
  }

  /** Whether the slayer upgrade is available (50 damage dealt). */
  get slayerUpgradeAvailable(): boolean {
    return this.slayerDamageDone >= SLAYER.UPGRADE_THRESHOLD;
  }

  /**
   * Called when the chimera reaches 100% completion.
   * Triggers the screen shake, death sequence, and boss fight.
   * The Slayer character unlock appears later at 50 damage dealt.
   */
  onChimeraCompleted(): void {
    if (this.slayerMode) return; // already triggered
    if (this.trueResurrected) return; // End Times permanently disabled after resurrection
    this.slayerMode = true;
    this.slayerDeathSequencePlaying = true;

    // Log the chimera attacking
    this.log.log(LOG_MSG.SLAYER.CHIMERA_ATTACKS, 'rare');

    // Death sequence: kill characters one by one from the right side
    const killOrder = this.unlockedCharacters
      .filter(c => c.id !== 'slayer')
      .map(c => c.id)
      .reverse(); // kill from the bottom/right

    killOrder.forEach((charId, index) => {
      setTimeout(() => {
        // Screen shake on each character death
        document.body.classList.remove('screen-shake');
        // Force reflow so re-adding the class restarts the animation
        void document.body.offsetWidth;
        document.body.classList.add('screen-shake');

        this.charService.kill(charId);
        this.deadCharacters = [...this.deadCharacters, charId];

        // Remove jacks for this character
        const keysToRemove = Object.keys(this.jacksAllocations).filter(k =>
          k === charId || k.startsWith(charId + '-')
        );
        for (const key of keysToRemove) {
          this.jacksAllocations = { ...this.jacksAllocations, [key]: 0 };
        }

        const charName = this.unlockedCharacters.find(c => c.id === charId)?.name ?? charId;
        this.log.log(LOG_MSG.SLAYER.CHARACTER_SLAIN(charName), 'warn');

        // After last character dies, finalize
        if (index === killOrder.length - 1) {
          setTimeout(() => {
            // Stop screen shake once all characters are dead
            document.body.classList.remove('screen-shake');

            // Destroy all jacks
            this.jacksAllocations = {};
            this.log.log(LOG_MSG.SLAYER.JACKS_DESTROYED, 'warn');

            // Deselect all characters — no one is active yet
            this.charService.clearActive();

            // Start the boss fight button cycling (player fights without slayer unlocked)
            this.startSlayerButtonCycle();
            this.slayerDeathSequencePlaying = false;
            this.updateAllPerSecond();
          }, SLAYER.DEATH_DELAY_MS);
        }
      }, SLAYER.DEATH_DELAY_MS * (index + 1));
    });
  }

  /**
   * Called when the player purchases the Slayer character from the global upgrades panel.
   */
  onSlayerUnlocked(): void {
    this.charService.setActive('slayer');
    this.slayerUnlocked = true;
    this.log.log(LOG_MSG.SLAYER.SLAYER_RISES, 'rare');
    this.statsService.recordMilestone('slayer_unlocked', 'The Slayer Rises');
    this._startSlayerAutoAttack();
  }

  /**
   * Handle purchase of the Scroll of True Resurrection.
   * Deducts ALL current ichor, banishes the Slayer, revives all characters,
   * and returns the game to its pre-End-Times state.
   * The chimeramancer sidequest remains at 100% with no way to re-trigger the boss fight.
   */
  performTrueResurrection(): void {
    if (this.upgrades.level('SCROLL_OF_TRUE_RESURRECTION') >= 1) return;
    const ichor = Math.floor(this.wallet.get('ichor'));
    if (ichor < 1) {
      this.log.log('You need at least 1 Ichor to use the Scroll of True Resurrection.', 'warn');
      return;
    }

    // Deduct ALL ichor
    this.wallet.remove('ichor', ichor);
    // Mark the upgrade as purchased
    this.upgrades.forceLevel('SCROLL_OF_TRUE_RESURRECTION', 1);

    // ── Stop all slayer systems ──────────────────────────────────
    this._stopSlayerAutoAttack();
    this.stopSlayerButtonCycle();

    // ── Reset slayer endgame visual/logic state ──────────────────
    this.slayerMode              = false;
    this.chimeraSlain            = false;
    this.slayerFrozen            = false;
    this.slayerChargeAnimPlaying = false;
    this.slayerDeathSequencePlaying = false;
    this.victoryModalOpen        = false;
    this.slayerHp                = SLAYER.MAX_HP;
    this.slayerDamageDone        = 0;
    this.slayerButtons           = new Array(SLAYER.BUTTON_COUNT).fill(false);
    this.condemnStacks           = [];

    // ── Revive all characters ────────────────────────────────────
    this.deadCharacters = [];
    this.charService.reviveAll();

    // ── Banish the Slayer (lock, deselect) ──────────────────────
    this.charService.lock('slayer');
    this.slayerUnlocked = false;

    // ── Restore active character (select first non-slayer unlocked character) ──
    const firstAlive = this.charService.getCharacters().find(c => c.id !== 'slayer' && c.unlocked && !c.dead);
    if (firstAlive) this.charService.setActive(firstAlive.id);
    else            this.charService.clearActive();

    // ── Mark as resurrected — prevents End Times from re-triggering ──
    this.trueResurrected = true;

    this.log.log('The Scroll crumbles to dust. The fallen stir… and rise. The Slayer fades from memory.', 'rare');
    this.statsService.recordMilestone('true_resurrection', 'True Resurrection');
    this.updateAllPerSecond();
  }
  private _calcSlayerDamage(): number {
    let dmg = SLAYER.DAMAGE_PER_CLICK + this.upgrades.level('KNOW_NO_FEAR') * SLAYER.KNOW_NO_FEAR_DAMAGE;
    // Condemn: +level damage per active stack
    const condemnLevel = this.upgrades.level('CONDEMN');
    const activeStacks = this.activeCondemnStacks;
    if (condemnLevel > 0 && activeStacks > 0) {
      dmg += condemnLevel * SLAYER.CONDEMN_DAMAGE_PER_LEVEL * activeStacks;
    }
    // Banishment: ×2 when at max Condemn stacks
    if (this.upgrades.level('BANISHMENT') > 0 && activeStacks >= SLAYER.CONDEMN_MAX_STACKS) {
      dmg *= SLAYER.BANISHMENT_DAMAGE_MULTIPLIER;
    }
    if (this.slayerBead1Socketed) dmg *= 2;
    if (this.slayerBead2Socketed) dmg *= 2;
    return dmg;
  }

  /** Compute auto-attack interval in ms (base – Bloodlust, clamped to floor). */
  private _calcSlayerAttackInterval(): number {
    return Math.max(
      SLAYER.AUTO_ATTACK_MIN_MS,
      SLAYER.AUTO_ATTACK_BASE_MS - this.upgrades.level('BLOODLUST') * SLAYER.BLOODLUST_REDUCTION_MS,
    );
  }

  /**
   * Roll for a Windfury extra attack. Each Windfury level adds 10% chance.
   * If Thunderfury is purchased, a successful proc can chain again (up to THUNDERFURY_MAX_CHAIN times).
   * If Sunfury is purchased, each chained attack deals double the damage of the previous attack.
   * At the top level, logs a single summary message for all chained hits.
   * @param chainDepth    Current chain depth (0 = first proc after an original attack).
   * @param previousDamage Damage dealt by the triggering attack (used by Sunfury to double).
   * @param _acc          Internal accumulator — do not pass; used by recursive calls.
   */
  private _rollWindfury(chainDepth: number = 0, previousDamage?: number, _acc?: { attacks: number; totalDmg: number }): void {
    const isTopLevel = _acc === undefined;
    const acc = isTopLevel ? { attacks: 0, totalDmg: 0 } : _acc;

    const windfuryLevel = this.upgrades.level('WINDFURY');
    if (windfuryLevel <= 0 || this.slayerHp <= 0) {
      if (isTopLevel && acc.attacks > 0) {
        this.log.log(LOG_MSG.SLAYER.WINDFURY_PROC(acc.attacks, acc.totalDmg), 'default');
      }
      return;
    }
    const chance = windfuryLevel * SLAYER.WINDFURY_CHANCE_PER_LEVEL;
    if (Math.random() < chance) {
      let dmg: number;
      if (this.upgrades.level('SUNFURY') > 0 && previousDamage !== undefined) {
        // Sunfury: each Thunderfury chain attack doubles the previous attack's damage
        dmg = previousDamage * 2;
      } else {
        dmg = this._calcSlayerDamage();
      }
      this._dealSlayerDamage(dmg, true, true); // skipLog — summary emitted below
      acc.attacks++;
      acc.totalDmg += dmg;
      // Thunderfury: allow the chain to continue (up to max chain depth)
      if (this.upgrades.level('THUNDERFURY') > 0 && chainDepth < SLAYER.THUNDERFURY_MAX_CHAIN - 1) {
        this._rollWindfury(chainDepth + 1, dmg, acc);
      }
    }

    if (isTopLevel && acc.attacks > 0) {
      this.log.log(LOG_MSG.SLAYER.WINDFURY_PROC(acc.attacks, acc.totalDmg), 'default');
    }
  }

  /** Apply damage to the chimera, respecting Vorpal Blade rule, and award ichor. */
  private _dealSlayerDamage(dmg: number, isAuto: boolean, skipLog = false): void {
    if (this.slayerHp <= 0) return;

    // Award ichor = damage × blue bead multiplier (blue beads double ichor yield)
    const ichorMult = this.wallet.getBeadMultiplier('slayer');
    const ichor = dmg * ichorMult;
    this.wallet.add('ichor', ichor);
    this.statsService.trackCurrencyGain('ichor', ichor);

    // Apply HP damage (not affected by blue bead yield multiplier)
    this.slayerHp -= dmg;
    this.slayerDamageDone += dmg;

    // Vorpal Blade check: chimera cannot die without it socketed in the crown
    const hasVorpal = this.vorpalBladeSocketed;
    if (!hasVorpal && this.slayerHp <= 0) {
      this.slayerHp = 1;
    }

    // Log
    if (!skipLog) {
      if (isAuto) {
        this.log.log(LOG_MSG.SLAYER.CHIMERA_AUTO_HIT(dmg, ichor), 'default');
      } else {
        this.log.log(LOG_MSG.SLAYER.CHIMERA_HIT(dmg, ichor), 'default');
      }
    }

    // Check for chimera death
    if (this.slayerHp <= 0) {
      this.slayerHp = 0;
      this.stopSlayerButtonCycle();
      this._stopSlayerAutoAttack();
      this._stopCondemnCleanup();
      this.condemnStacks = [];
      this.slayerButtons = new Array(SLAYER.BUTTON_COUNT).fill(false);
      this.log.log(LOG_MSG.SLAYER.CHIMERA_DEFEATED, 'rare');
      this.statsService.recordMilestone('chimera_defeated', 'The Chimera Is Slain!');

      // Close any open popups
      this.relicPopupId = null;
      this.beadPopupInfo = null;

      // Step 1: Freeze slayer (stop fighting animation) — 400ms pause
      this.slayerFrozen = true;

      setTimeout(() => {
        // Step 2: Slayer charges right across the screen — 800ms
        this.slayerChargeAnimPlaying = true;

        setTimeout(() => {
          // Step 3: Chimera disappears — 600ms fade
          this.chimeraSlain = true;

          setTimeout(() => {
            // Step 4: Show victory modal
            this.slayerChargeAnimPlaying = false;
            this.victoryPlaytime = this._formatPlaytime(this.statsService.current.playtimeSeconds ?? 0);
            this.victoryModalOpen = true;
          }, 800);
        }, 700);
      }, 400);
    }
  }

  /** Start the Slayer auto-attack timer. */
  private _startSlayerAutoAttack(): void {
    this._stopSlayerAutoAttack();
    if (!this.slayerUnlocked || this.slayerHp <= 0) return;
    const interval = this._calcSlayerAttackInterval();
    this.slayerAutoAttackTimer = setInterval(() => this._slayerAutoAttackTick(), interval);
  }

  /** Stop the Slayer auto-attack timer. */
  private _stopSlayerAutoAttack(): void {
    if (this.slayerAutoAttackTimer) {
      clearInterval(this.slayerAutoAttackTimer);
      this.slayerAutoAttackTimer = null;
    }
  }

  /** Number of currently-active (non-expired) Condemn stacks. */
  get activeCondemnStacks(): number {
    const now = Date.now();
    return this.condemnStacks.filter(t => t > now).length;
  }

  /** Add a Condemn stack. Duration is extended by Consecrate. Caps at CONDEMN_MAX_STACKS; the soonest-to-expire stack is refreshed if full. */
  private _addCondemnStack(): void {
    const duration = SLAYER.CONDEMN_DURATION_MS
      + this.upgrades.level('CONSECRATE') * SLAYER.CONSECRATE_DURATION_BONUS_MS;
    const expiry = Date.now() + duration;
    // Prune expired stacks first
    this._pruneCondemnStacks();
    if (this.condemnStacks.length >= SLAYER.CONDEMN_MAX_STACKS) {
      // Refresh the soonest-to-expire (lowest remaining timer) stack
      const minIdx = this.condemnStacks.reduce(
        (mi, t, i, arr) => t < arr[mi] ? i : mi, 0
      );
      const newStacks = [...this.condemnStacks];
      newStacks[minIdx] = expiry;
      this.condemnStacks = newStacks;
    } else {
      this.condemnStacks = [...this.condemnStacks, expiry];
    }
    this._startCondemnCleanup();
    // Recalculate ichor/s since active stack count (and thus DPS) just changed
    this.updateAllPerSecond();
  }

  /** Remove expired stacks from the array. */
  private _pruneCondemnStacks(): void {
    const now = Date.now();
    const before = this.condemnStacks.length;
    this.condemnStacks = this.condemnStacks.filter(t => t > now);
    if (this.condemnStacks.length === 0) {
      this._stopCondemnCleanup();
    }
    // Only recalculate if stacks actually expired (active count decreased)
    if (this.condemnStacks.length < before) {
      this.updateAllPerSecond();
    }
  }

  /** Start the periodic cleanup timer that prunes expired stacks (keeps UI in sync). */
  private _startCondemnCleanup(): void {
    if (this.condemnCleanupTimer) return;
    this.condemnCleanupTimer = setInterval(() => this._pruneCondemnStacks(), 500);
  }

  /** Stop the cleanup timer. */
  private _stopCondemnCleanup(): void {
    if (this.condemnCleanupTimer) {
      clearInterval(this.condemnCleanupTimer);
      this.condemnCleanupTimer = null;
    }
  }

  /**
   * Number of nonagram lines to draw based on active Condemn stacks.
   * 0 stacks = 0 lines, 7 stacks = all 9 lines.
   * Progression: each stack reveals ~1.3 more lines.
   */
  get condemnStarLines(): number {
    const stacks = this.activeCondemnStacks;
    if (stacks <= 0) return 0;
    // Map 1–7 stacks → 1–9 lines
    return Math.min(9, Math.ceil(stacks * (9 / SLAYER.CONDEMN_MAX_STACKS)));
  }

  /**
   * Get the (x, y) coordinates of vertex `i` on the 9-point ring.
   * The ring matches the button layout: 80px radius centered at (100, 100)
   * in the 200×200 SVG viewBox, starting from 12 o'clock (-90°).
   */
  condemnStarPt(i: number): { x: number; y: number } {
    const angle = (i * 2 * Math.PI / 9) - Math.PI / 2;
    return {
      x: 100 + 80 * Math.cos(angle),
      y: 100 + 80 * Math.sin(angle),
    };
  }

  /** One tick of the Slayer auto-attack. */
  private _slayerAutoAttackTick(): void {
    if (this.slayerHp <= 0) { this._stopSlayerAutoAttack(); return; }
    const dmg = this._calcSlayerDamage();
    this._dealSlayerDamage(dmg, true);
    this._rollWindfury(0, dmg);
    // Roll for blue-2 bead (auto-attack hit) — slayer must be unlocked
    if (this.slayerUnlocked && this.hasUnfoundJackBead('slayer') && Math.random() < SLAYER.BLUE_BEAD_AUTO_CHANCE) {
      this.findJackBead('slayer');
    }
  }

  /** Start the rapid button cycling for the boss fight. */
  private startSlayerButtonCycle(): void {
    if (this.slayerCycleTimer) return;
    // Initialize: randomly activate 2 buttons
    this._randomizeSlayerButtons();
    this.slayerCycleTimer = setInterval(() => {
      this._randomizeSlayerButtons();
    }, SLAYER.BUTTON_CYCLE_MS);
  }

  /** Stop the button cycling. */
  private stopSlayerButtonCycle(): void {
    if (this.slayerCycleTimer) {
      clearInterval(this.slayerCycleTimer);
      this.slayerCycleTimer = null;
    }
  }

  /** Randomly enable weak spots; count = base 3 + Sunder Armor level (capped at 9). */
  private _randomizeSlayerButtons(): void {
    const sunderLevel = this.upgrades.level('SUNDER_ARMOR');
    const baseSpots = SLAYER.BASE_ACTIVE_SPOTS + sunderLevel * SLAYER.SUNDER_ARMOR_SPOTS_PER_LEVEL;
    const spotCount = Math.min(SLAYER.BUTTON_COUNT, baseSpots);

    // If all spots are active, just enable everything
    if (spotCount >= SLAYER.BUTTON_COUNT) {
      this.slayerButtons = new Array(SLAYER.BUTTON_COUNT).fill(true);
      return;
    }

    const newState = new Array(SLAYER.BUTTON_COUNT).fill(false);
    const indices = new Set<number>();
    while (indices.size < spotCount) {
      indices.add(Math.floor(Math.random() * SLAYER.BUTTON_COUNT));
    }
    for (const i of indices) newState[i] = true;
    this.slayerButtons = newState;
  }

  /** Handle clicking one of the 9 boss-fight buttons. */
  slayerAttack(index: number): void {
    if (!this.slayerButtons[index]) return; // button wasn't active
    if (this.slayerHp <= 0) return; // chimera already dead

    // Immediately disable the clicked weak spot
    this.slayerButtons = this.slayerButtons.map((v, i) => i === index ? false : v);

    // Condemn: add a stack (if upgrade is purchased)
    const condemnLevel = this.upgrades.level('CONDEMN');
    if (condemnLevel > 0) {
      this._addCondemnStack();
    }

    const dmg = this._calcSlayerDamage();
    this._dealSlayerDamage(dmg, false);
    this._rollWindfury(0, dmg);

    // Roll for blue-1 bead (manual weak-spot click) — only after slayer is unlocked
    if (this.slayerUnlocked && this.hasUnfoundBlueBead('slayer') && Math.random() < SLAYER.BLUE_BEAD_CLICK_CHANCE) {
      this.findBlueBead('slayer');
    }
  }

  // ── Dev tools ──────────────────────────────────────────────────

  devMenuOpen = false;
  get devToolsEnabled(): boolean { return this.saveService.enableDevTools; }

  devGrant(): void {
    for (const c of this.wallet.currencies) {
      if (c.id === 'ichor') continue;
      this.wallet.add(c.id, 1_000_000);
    }
    this.log.log(LOG_MSG.DEV.GRANT, 'warn');
  }

  devZero(): void {
    for (const c of this.wallet.currencies) this.wallet.set(c.id, 0);
    this.log.log(LOG_MSG.DEV.ZERO, 'warn');
  }

  devMaxXp(): void {
    this.wallet.set('xp', 2_000_000_000);
    this.log.log(LOG_MSG.DEV.MAX_XP, 'warn');
  }

  devHalfMaxUpgrades(): void {
    this.upgrades.setAllToHalfMax();
    this.updateAllPerSecond();
    this.log.log(LOG_MSG.DEV.HALF_MAX, 'warn');
  }

  devZeroUpgrades(): void {
    this.upgrades.setAllToZero();

    // Unsocket all beads (keep found status, just remove socketed)
    for (const charId of Object.keys(this.beadState)) {
      for (const slotId of BEAD_SLOT_ORDER) {
        if (this.beadState[charId]?.[slotId]) {
          this.beadState[charId]![slotId].socketed = false;
        }
      }
    }
    this.beadState = { ...this.beadState };
    this.syncBeadMultipliers();
    this._refreshDerived();

    this.updateAllPerSecond();
    this.log.log(LOG_MSG.DEV.ZERO_UPGRADES, 'warn');
  }

  devMaxUpgrades(): void {
    this.upgrades.setAllToMax();
    this.updateAllPerSecond();
    this.log.log(LOG_MSG.DEV.MAX_UPGRADES, 'warn');
  }

  devClearSave(): void {
    this.saveService.suppressNextSave();
    this.saveService.deleteSave();
    document.body.classList.add('screen-shake');
    setTimeout(() => window.location.reload(), 800);
  }

  devUnlockAll(): void {
    // Unlock all characters
    for (const char of this.charService.getCharacters()) {
      if (!char.unlocked) this.charService.unlock(char.id);
    }

    // Unlock all manually-gated currencies
    for (const currency of this.wallet.currencies) {
      if (currency.manualUnlock) this.wallet.unlockCurrency(currency.id);
    }

    // Unlock the minigame system
    this.minigameUnlocked = true;

    // Unlock Jack'd Up
    this.jackdUpUnlocked = true;

    // Max out all jacks
    this.jacksOwned = getJacksMax();

    // Find all beads (but don't socket — let the player do that)
    for (const char of this.charService.getCharacters()) {
      this.ensureBeadState(char.id);
      for (const slotId of BEAD_SLOT_ORDER) {
        this.beadState[char.id]![slotId].found = true;
      }
    }
    this.beadState = { ...this.beadState };
    this._refreshDerived();

    this.updateAllPerSecond();

    this.log.log(LOG_MSG.DEV.UNLOCK_ALL, 'warn');
  }

  // ── Private context builders ───────────────────────────────────

  /** Build the context object used by hero click handlers. */
  private buildHeroActionCtx(): HeroActionContext {
    return {
      wallet:                 this.wallet,
      log:                    this.log,
      upgrades:               this.upgrades,
      stats:                  this.statsService,
      wholesaleSpicesEnabled: this.wholesaleSpicesEnabled,
      isThiefStunned:         this.isThiefStunned,
      applyThiefStun:         () => this.applyThiefStun(),
      isArtisanTimerActive:   this.isArtisanTimerActive,
      startArtisanTimer:      (batchSize) => this.startArtisanTimer(batchSize),
      necromancerActiveButton: this.necromancerActiveButton,
      necromancerDecrementClick: () => this.necromancerDecrementClick(),
      artificerActiveButton: this.artificerActiveButton,
      artificerInsight: this.artificerInsight,
      setArtificerInsight: (v: number) => { this.artificerInsight = v; },
      beadMultiplier: (charId: string) => this.wallet.getBeadMultiplier(charId),
      hasUnfoundBlueBead: (charId: string) => this.minigameUnlocked && this.hasUnfoundBlueBead(charId),
      onBlueBeadFound: (charId: string) => this.findBlueBead(charId),
    };
  }

  /**
   * Build the context object used by jack auto-click handlers.
   * Uses function-based getters for mutable state that can change
   * within a single tick (e.g. thief stun, starvation flags).
   */
  private buildJackAutoClickCtx(): JackAutoClickContext {
    return {
      wallet:                 this.wallet,
      upgrades:               this.upgrades,
      stats:                  this.statsService,
      wholesaleSpicesEnabled: this.wholesaleSpicesEnabled,
      isThiefStunned:         () => this.isThiefStunned,
      applyThiefStun:         () => this.applyThiefStun(),
      isJackStarved:          (charId) => !!this.jackStarved[charId],
      setJackStarved:         (charId, starved) => {
        this.jackStarved = { ...this.jackStarved, [charId]: starved };
      },
      onPerSecondUpdate:      () => this.updateAllPerSecond(),
      isArtisanTimerActive:   () => this.isArtisanTimerActive,
      startArtisanTimer:      (batchSize) => this.startArtisanTimer(batchSize),
      relicLevel:             (charId) => this.upgrades.level(`RELIC_${charId.toUpperCase()}`),
      necromancerActiveButton: () => this.necromancerActiveButton,
      necromancerDecrementClick: () => this.necromancerDecrementClick(),
      artificerActiveButton: () => this.artificerActiveButton,
      artificerInsight: () => this.artificerInsight,
      setArtificerInsight: (v: number) => { this.artificerInsight = v; },
      selectedKoboldLevel: () => this.selectedKoboldLevel,
      beadMultiplier: (charId: string) => this.wallet.getBeadMultiplier(charId),
      hasUnfoundJackBead: (charId: string) => this.minigameUnlocked && this.hasUnfoundJackBead(charId),
      onJackBeadFound: (charId: string) => this.findJackBead(charId),
    };
  }
}
