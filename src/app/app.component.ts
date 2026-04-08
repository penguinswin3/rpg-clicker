import { Component, HostListener, inject, OnInit, OnDestroy } from '@angular/core';
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
import { XP_THRESHOLDS, YIELDS, GLOBAL_PURCHASE_DEFS, getActiveCosts, getGlobalDef, FAMILIAR, JACKD_UP_SPEED_MULT, BEADS, BEAD_SLOT_ORDER, BeadSlotState, BeadType, GOLD2_CONDITIONS, GOOD_AUTO_SOLVE } from './game-config';
import { UPGRADE_FLAVOR, CURRENCY_FLAVOR, UPGRADE_COLORS, cur, CHARACTER_FLAVOR, BEAD_FLAVOR, BEAD_COLORS, BEAD_SYMBOL, HERO_PRESS_PULSE_COLOR } from './flavor-text';
import { fmtNumber, clamp } from './utils/mathUtils';

// ── Extracted hero helpers ─────────────────────────────────────
import { calcAutoGoldPerSecond, calcBeastFindChance, calcCulinarianGoldCost, calcBaitedTrapsBeastPerTick, calcHovelGardenHerbPerTick, calcArtisanTreasureCost, calcArtisanTimerMs, calcArtisanGemstoneYield, calcArtisanMetalYield, calcArtisanGemstoneYieldJack, calcArtisanMetalYieldJack, rollNecromancerSwitchClicks } from './hero/yield-helpers';
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
  unlockedCharacters: { id: string; name: string; color: string }[] = [];

  // ── Necromancer state ────────────────────────────────────────────
  /** Which necromancer ability is currently enabled. */
  necromancerActiveButton: 'defile' | 'ward' = 'defile';
  /** How many clicks remain before the active ability switches. */
  necromancerClicksRemaining = 10;

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
  beadState: Record<string, Record<string, { found: boolean; socketed: boolean }>> = {};

  /** Info about the bead popup currently open, or null. */
  beadPopupInfo: { charId: string; slotId: string; type: BeadType } | null = null;

  /** Pre-computed bead crown display items — refreshed by _refreshDerived(). */
  beadCrownItems: { kind: 'bead' | 'relic'; slotId?: string; beadType?: BeadType; beadState?: 'locked' | 'found' | 'socketed'; relicId?: string; relicPurchased?: boolean; relicName?: string }[] = [];

  /** Whether any bead for the active character is found but not yet socketed. */
  anyBeadUnsocketed = false;

  // ── Auto-solve state ──────────────────────────────────────────
  /** Per-character auto-solve toggle state. */
  autoSolveEnabled: Record<string, boolean> = {};

  /** Per-character gold-2 bead unlock progress (shape varies per character). */
  gold2Progress: Record<string, unknown> = {};

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
    return !this.beadState[charId]['gold-1'].found;
  }

  /** Award the first gold bead (gold-1) for a character via minigame success. */
  findMinigameGoldBead(charId: string): void {
    this.ensureBeadState(charId);
    if (this.beadState[charId]['gold-1'].found) return;
    this.beadState[charId]['gold-1'].found = true;
    this.beadState = { ...this.beadState };
    this._refreshDerived();
    const charName = this.unlockedCharacters.find(c => c.id === charId)?.name ?? charId;
    this.log.log(`★ ${charName} discovered a golden bead from their sidequest! Check the crown above.`, 'rare');
    this.statsService.recordMilestone(`bead_gold_mg_${charId}`, `${charName}: Gold Bead Found (Sidequest)`);
  }

  /** Award the gold-2 bead for a character via the deterministic unlock challenge. */
  findGold2Bead(charId: string): void {
    this.ensureBeadState(charId);
    if (this.beadState[charId]['gold-2'].found) return;
    this.beadState[charId]['gold-2'].found = true;
    this.beadState = { ...this.beadState };
    this._refreshDerived();
    const charName = this.unlockedCharacters.find(c => c.id === charId)?.name ?? charId;
    this.log.log(`★ ${charName} unlocked a golden bead of mastery! Check the crown above.`, 'rare');
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
    if (gates.xpMin != null && this.highestXp < gates.xpMin) return false;
    if (gates.requiresSharperSwordsMin != null && this.upgrades.level('SHARPER_SWORDS') < gates.requiresSharperSwordsMin) return false;
    if (gates.requiresTreasureChestMin != null && this.upgrades.level('TREASURE_CHEST') < gates.requiresTreasureChestMin) return false;
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
    if (this.upgrades.category(id) === 'relic' || id === 'RELIC_HUNTER') return UPGRADE_COLORS.relic;
    if (this.upgrades.maxLevel(id) === 1 || this.upgrades.isMaxed(id)) return UPGRADE_COLORS.rare;
    return UPGRADE_COLORS.standard;
  }

  /** Format large numbers as shorthand. */
  formatNumber(num: number): string {
    return fmtNumber(num);
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

  // ── Bead helpers ────────────────────────────────────────────────

  /** Ensure bead state exists for a character, initializing all 4 slots. */
  private ensureBeadState(charId: string): void {
    if (!this.beadState[charId]) {
      this.beadState[charId] = {};
    }
    for (const slotId of BEAD_SLOT_ORDER) {
      if (!this.beadState[charId][slotId]) {
        this.beadState[charId][slotId] = { found: false, socketed: false };
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
    return !this.beadState[charId]['blue-1'].found;
  }

  /** Whether the character's RIGHT blue bead (blue-2, awarded by jacks) is undiscovered. */
  hasUnfoundJackBead(charId: string): boolean {
    this.ensureBeadState(charId);
    return !this.beadState[charId]['blue-2'].found;
  }

  /** Award the left blue bead (blue-1) for a character via manual clicks. */
  findBlueBead(charId: string): void {
    this.ensureBeadState(charId);
    if (this.beadState[charId]['blue-1'].found) return;
    this.beadState[charId]['blue-1'].found = true;
    this.beadState = { ...this.beadState };
    this._refreshDerived();
    const charName = this.unlockedCharacters.find(c => c.id === charId)?.name ?? charId;
    this.log.log(`★ ${charName} discovered a mysterious bead! Check the crown above.`, 'rare');
    this.statsService.recordMilestone(`bead_blue_${charId}`, `${charName}: Blue Bead Found`);
  }

  /** Award the right blue bead (blue-2) for a character via jack/familiar auto-clicks. */
  findJackBead(charId: string): void {
    this.ensureBeadState(charId);
    if (this.beadState[charId]['blue-2'].found) return;
    this.beadState[charId]['blue-2'].found = true;
    this.beadState = { ...this.beadState };
    this._refreshDerived();
    const charName = this.unlockedCharacters.find(c => c.id === charId)?.name ?? charId;
    this.log.log(`★ ${charName}'s Jacks discovered a mysterious bead! Check the crown above.`, 'rare');
    this.statsService.recordMilestone(`bead_jack_${charId}`, `${charName}: Jack Bead Found`);
  }

  /** Socket a bead from the popup. */
  socketBeadFromPopup(): void {
    if (!this.beadPopupInfo) return;
    const { charId, slotId, type } = this.beadPopupInfo;
    this.ensureBeadState(charId);
    const slot = this.beadState[charId][slotId];
    if (slot?.found && !slot?.socketed) {
      slot.socketed = true;
      this.beadState = { ...this.beadState };
      this.syncBeadMultipliers();
      this._refreshDerived();
      this.updateAllPerSecond();
      const charName = this.unlockedCharacters.find(c => c.id === charId)?.name ?? charId;
      const beadName = BEAD_FLAVOR[charId]?.[slotId]?.name ?? 'Bead';
      this.log.log(`★ ${beadName} socketed for ${charName}!${type === 'blue' ? ' Resource yields doubled!' : ''}`, 'rare');
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

  /** Get bead effect text for a character + slot. */
  getBeadEffect(charId: string, slotId: string): string {
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
    const allChars = ['fighter', 'ranger', 'apothecary', 'culinarian', 'thief', 'artisan', 'necromancer'];
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
      this.unlockedCharacters = chars.filter(c => c.unlocked).map(c => ({ id: c.id, name: c.name, color: c.color }));
      this.updateRelicHunterMax(chars);
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
      this._refreshDerived();
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

    // Jack auto-clicks: each allocated Jack fires once per second
    // Relic doubling: when a character's relic is active, each jack counts as two.
    // Jack'd Up: when purchased, jacks fire 50% faster (1.5× effective clicks per tick).
    setInterval(() => {
      const ctx = this.buildJackAutoClickCtx();
      const jackdUpMult = this.jackdUpUnlocked ? JACKD_UP_SPEED_MULT : 1;
      for (const [charId, count] of Object.entries(this.jacksAllocations)) {
        // Normalize compound keys (e.g. 'necromancer-defile' → 'necromancer') for relic lookup
        const baseCharId = charId.startsWith('necromancer') ? 'necromancer' : charId;
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

      // Familiar auto-clicks: each active familiar fires JACKS_PER_FAMILIAR additional clicks
      if (this.familiarUnlocked) {
        const now = Date.now();
        let anyExpired = false;
        for (const [key, expiry] of Object.entries(this.familiarTimers)) {
          if (expiry <= now) {
            // Timer just expired — mark for cleanup
            anyExpired = true;
            continue;
          }
          // Skip clicks when familiars are paused
          if (this.familiarsPaused) continue;

          const baseId = key.startsWith('necromancer') ? 'necromancer' : key;
          const relicMult = this.upgrades.level(`RELIC_${baseId.toUpperCase()}`) >= 1 ? 2 : 1;
          const famScaledRaw = FAMILIAR.JACKS_PER_FAMILIAR * relicMult * jackdUpMult;
          const clicks = Math.floor(famScaledRaw) + (Math.random() < (famScaledRaw % 1) ? 1 : 0);
          if (key === 'artisan') {
            this.handleArtisanJackBatch(clicks);
          } else {
            for (let i = 0; i < clicks; i++) performJackAutoClick(key, ctx);
          }
        }
        // Prune expired timers and recalc rates
        if (anyExpired) {
          const cleaned: Record<string, number> = {};
          for (const [k, v] of Object.entries(this.familiarTimers)) {
            if (v > now) cleaned[k] = v;
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
    this.sidequestCollapsed = this.saveService.sidequestCollapsed;
    this.saveService.startAutoSave();
  }

  ngOnDestroy(): void {
    this.saveService.stopAutoSave();
    this.heroHoldStop();
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
      artisanTimerUntil:       this.artisanTimerUntil,
      artisanTimerBatchSize:   this.artisanTimerBatchSize,
      necromancerActiveButton:     this.necromancerActiveButton,
      necromancerClicksRemaining:  this.necromancerClicksRemaining,
      familiarTimers:              { ...this.familiarTimers },
      familiarsPaused:             this.familiarsPaused,
      beads:                       JSON.parse(JSON.stringify(this.beadState)),
      autoSolveEnabled:            { ...this.autoSolveEnabled },
      gold2Progress:               JSON.parse(JSON.stringify(this.gold2Progress)),
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
    // Restore necromancer state
    this.necromancerActiveButton     = s.necromancerActiveButton     ?? 'defile';
    this.necromancerClicksRemaining  = s.necromancerClicksRemaining  ?? 10;
    // Restore familiar timers — prune any that have expired while the game was closed
    const now = Date.now();
    const rawTimers = s.familiarTimers ?? {};
    const restoredTimers: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawTimers)) {
      if (v > now) restoredTimers[k] = v;
    }
    this.familiarTimers = restoredTimers;
    this.familiarsPaused = s.familiarsPaused ?? false;
    // Restore bead state
    this.beadState = s.beads ? JSON.parse(JSON.stringify(s.beads)) : {};
    this.syncBeadMultipliers();
    // Restore auto-solve toggle state
    this.autoSolveEnabled = s.autoSolveEnabled ? { ...s.autoSolveEnabled } : {};
    // Restore gold-2 progress state
    this.gold2Progress = s.gold2Progress ? JSON.parse(JSON.stringify(s.gold2Progress)) : {};
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
        fighter:    this.upgrades.level('RELIC_FIGHTER'),
        ranger:     this.upgrades.level('RELIC_RANGER'),
        apothecary: this.upgrades.level('RELIC_APOTHECARY'),
        culinarian: this.upgrades.level('RELIC_CULINARIAN'),
        thief:      this.upgrades.level('RELIC_THIEF'),
        artisan:    this.upgrades.level('RELIC_ARTISAN'),
        necromancer:this.upgrades.level('RELIC_NECROMANCER'),
      },
      necromancerActiveButton: this.necromancerActiveButton,
      familiarTimers: this.familiarTimers,
      jackdUpUnlocked: this.jackdUpUnlocked,
      familiarsPaused: this.familiarsPaused,
      beadMultipliers: {
        fighter:     this.wallet.getBeadMultiplier('fighter'),
        ranger:      this.wallet.getBeadMultiplier('ranger'),
        apothecary:  this.wallet.getBeadMultiplier('apothecary'),
        culinarian:  this.wallet.getBeadMultiplier('culinarian'),
        thief:       this.wallet.getBeadMultiplier('thief'),
        artisan:     this.wallet.getBeadMultiplier('artisan'),
        necromancer: this.wallet.getBeadMultiplier('necromancer'),
      },
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

  /** Build the combined bead + relic crown display items for the active character. */
  private _buildBeadCrownItems(): { kind: 'bead' | 'relic'; slotId?: string; beadType?: BeadType; beadState?: 'locked' | 'found' | 'socketed'; relicId?: string; relicPurchased?: boolean; relicName?: string }[] {
    if (!this.minigameUnlocked) return [];

    const charId = this.activeCharacterId;
    const items: { kind: 'bead' | 'relic'; slotId?: string; beadType?: BeadType; beadState?: 'locked' | 'found' | 'socketed'; relicId?: string; relicPurchased?: boolean; relicName?: string }[] = [];

    // Left beads: blue-1, gold-1
    items.push(this._makeBeadItem(charId, 'blue-1', 'blue'));
    items.push(this._makeBeadItem(charId, 'gold-1', 'gold'));

    // Center: active character's relic (if visible)
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
        `Appraisal complete! (${cur('gemstone', totalGemstones)}, ${cur('precious-metal', totalMetals)}, ${cur('xp', xpAwarded)})`,
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
      this.log.log('Not enough resources to hire a Jack.', 'warn');
      return;
    }
    for (const c of this.jackCurrentCosts) {
      this.wallet.remove(c.currency, c.amount);
    }
    this.jacksOwned++;
    this.log.log(`A Jack of All Trades has been hired! (Total: ${this.jacksOwned})`, 'success');
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
    this.familiarsPaused = !this.familiarsPaused;
    this.updateAllPerSecond();
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
    return [charId];
  }

  /** Friendly label for a familiar key. */
  familiarLabel(key: string): string {
    if (key === 'necromancer-defile') return 'Exhume';
    if (key === 'necromancer-ward')   return 'Ward';
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

  // ── Minigame unlock ────────────────────────────────────────────

  buyMinigameUnlock(): void {
    if (this.minigameUnlocked) return;
    const costs = this.minigameCosts;
    if (!costs.every(c => this.wallet.canAfford(c.currency, c.amount))) {
      const missing = costs
        .filter(c => !this.wallet.canAfford(c.currency, c.amount))
        .map(c => cur(c.currency, c.amount, ''))
        .join(', ');
      this.log.log(`Not enough resources to unlock Sidequests. Need ${missing}.`, 'warn');
      return;
    }
    for (const c of costs) this.wallet.remove(c.currency, c.amount);
    this.minigameUnlocked = true;
    this.log.log('★ SIDEQUESTS UNLOCKED! Character-specific challenges are now available.', 'rare');
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
      this.log.log(`Not enough resources for Jack'd Up. Need ${missing}.`, 'warn');
      return;
    }
    for (const c of costs) this.wallet.remove(c.currency, c.amount);
    this.jackdUpUnlocked = true;
    this.updateAllPerSecond();
    this.log.log("★ JACK'D UP! Your Jacks now click 50% faster!", 'rare');
    this.statsService.recordMilestone('jackdup_unlocked', "Jack'd Up Unlocked");
  }

  // ── Dev tools ──────────────────────────────────────────────────

  devMenuOpen = false;
  get devToolsEnabled(): boolean { return this.saveService.enableDevTools; }

  devGrant(): void {
    for (const c of this.wallet.currencies) this.wallet.add(c.id, 1_000_000);
    this.log.log('[DEV] +1M granted to all resources.', 'warn');
  }

  devZero(): void {
    for (const c of this.wallet.currencies) this.wallet.set(c.id, 0);
    this.log.log('[DEV] All resources set to 0.', 'warn');
  }

  devMaxXp(): void {
    this.wallet.set('xp', 2_000_000_000);
    this.log.log('[DEV] XP set to 2,000,000,000.', 'warn');
  }

  devHalfMaxUpgrades(): void {
    this.upgrades.setAllToHalfMax();
    this.updateAllPerSecond();
    this.log.log('[DEV] All upgrades set to half of their maximum level.', 'warn');
  }

  devZeroUpgrades(): void {
    this.upgrades.setAllToZero();

    // Unsocket all beads (keep found status, just remove socketed)
    for (const charId of Object.keys(this.beadState)) {
      for (const slotId of BEAD_SLOT_ORDER) {
        if (this.beadState[charId]?.[slotId]) {
          this.beadState[charId][slotId].socketed = false;
        }
      }
    }
    this.beadState = { ...this.beadState };
    this.syncBeadMultipliers();
    this._refreshDerived();

    this.updateAllPerSecond();
    this.log.log('[DEV] All upgrades set to level 0. All beads unsocketed.', 'warn');
  }

  devMaxUpgrades(): void {
    this.upgrades.setAllToMax();
    this.updateAllPerSecond();
    this.log.log('[DEV] All upgrades set to maximum level.', 'warn');
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
        this.beadState[char.id][slotId].found = true;
      }
    }
    this.beadState = { ...this.beadState };
    this._refreshDerived();

    this.updateAllPerSecond();

    this.log.log('[DEV] Everything unlocked.', 'warn');
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
      beadMultiplier: (charId: string) => this.wallet.getBeadMultiplier(charId),
      hasUnfoundJackBead: (charId: string) => this.minigameUnlocked && this.hasUnfoundJackBead(charId),
      onJackBeadFound: (charId: string) => this.findJackBead(charId),
    };
  }
}
