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
import { XP_THRESHOLDS, YIELDS, UNLOCK_COSTS } from './game-config';
import { UPGRADE_FLAVOR, CURRENCY_FLAVOR, UPGRADE_COLORS, cur } from './flavor-text';
import { fmtNumber, clamp } from './utils/mathUtils';

// ── Extracted hero helpers ─────────────────────────────────────
import { calcAutoGoldPerSecond, calcBeastFindChance, calcCulinarianGoldCost } from './hero/yield-helpers';
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
  readonly minigameUnlockCosts = UNLOCK_COSTS;

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
  unlockedCharacters: { id: string; name: string; color: string }[] = [];

  // ── Minigame state ─────────────────────────────────────────────
  minigameUnlocked = false;

  get minigameShown():           boolean { return this.minigameUnlocked; }
  get minigameUnlockAvailable(): boolean {
    return this.highestXp >= XP_THRESHOLDS.MINIGAME_UNLOCK && !this.minigameUnlocked;
  }

  // ── Kobold level selector ──────────────────────────────────────
  selectedKoboldLevel = 1;

  // ── Fighter combat state ───────────────────────────────────────
  fighterCombatState: FighterCombatState | null = null;

  // ── UI toggles ─────────────────────────────────────────────────
  shortRestEnabled        = false;
  dilutionEnabled         = false;
  hideMaxedUpgrades       = false;
  hideMinigameUpgrades    = false;
  blandMode               = false;
  wholesaleSpicesEnabled  = true;
  fermentationVatsEnabled = true;

  // ── Relic popup state ─────────────────────────────────────────
  /** ID of the relic upgrade whose popup is currently shown, or null. */
  relicPopupId: string | null = null;

  /** The currency symbol used for the compact relic icon (from CURRENCY_FLAVOR). */
  readonly relicSymbol = CURRENCY_FLAVOR.relic.symbol;

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
    return this.activeCharacterId === 'thief' && this.isThiefStunned;
  }

  // ── Jack of All Trades state ───────────────────────────────────
  jacksOwned       = 0;
  jacksAllocations: Record<string, number> = {};
  jackStarved:      Record<string, boolean> = {};

  // ── Jack computed getters (delegated to jack-calculator) ───────

  get jacksVisible():    boolean { return isJacksVisible(this.highestXp, this.jacksOwned); }
  get jacksToPurchase(): number  { return getJacksToPurchase(this.highestXp, this.jacksOwned); }
  get jacksPoolFree():   number  { return getJacksPoolFree(this.jacksOwned, this.jacksAllocations); }

  get jackCurrentCosts(): JackCostEntry[] {
    return calculateJackCosts(this.jacksOwned);
  }

  get canAffordJack(): boolean {
    return canAffordJackCosts(this.jackCurrentCosts, (c, a) => this.wallet.canAfford(c, a));
  }

  get activeCharacterInfo(): { id: string; name: string; color: string } | undefined {
    return this.unlockedCharacters.find(c => c.id === this.activeCharacterId);
  }

  get activeCharJackStarved(): boolean {
    return isActiveCharJackStarved(
      this.activeCharacterId, this.isThiefStunned,
      this.jacksAllocations, this.jackStarved,
    );
  }

  get activeCharJackStarvedMsg(): string {
    const culGoldCost = calcCulinarianGoldCost(
      this.wholesaleSpicesEnabled,
      this.upgrades.level('WHOLESALE_SPICES'),
      this.upgrades.level('POTION_GLIBNESS'),
    );
    return getJackStarvedMessage(this.activeCharacterId, culGoldCost, id => this.wallet.get(id));
  }

  getJackCount(charId: string): number { return this.jacksAllocations[charId] ?? 0; }

  // ── Minigame-panel prop (thin delegation) ──────────────────────

  /** Fighter minigame attack power. */
  get fighterAttackPower(): number { return this.upgrades.level('SHARPER_SWORDS'); }

  // ── Hero display getters (delegated to hero-stats) ─────────────

  get questBtnLabel(): string {
    return getQuestBtnLabel(this.activeCharacterId);
  }

  get heroStats(): HeroStat[] {
    return buildHeroStats(this.activeCharacterId, {
      upgrades:               this.upgrades,
      wallet:                 this.wallet,
      minigameUnlocked:       this.minigameUnlocked,
      wholesaleSpicesEnabled: this.wholesaleSpicesEnabled,
      jacksAllocations:       this.jacksAllocations,
      isThiefStunned:         this.isThiefStunned,
    });
  }

  // ── Upgrade display helpers ────────────────────────────────────

  shouldShowUpgrade(isMaxed: boolean): boolean {
    return !this.hideMaxedUpgrades || !isMaxed;
  }

  /** Returns visible upgrade IDs for the active character in the given column. */
  getVisibleUpgrades(category: UpgradeCategory): string[] {
    return this.upgrades.getUpgradesFor(this.activeCharacterId, category)
      .filter(id => {
        if (!this.isUpgradeVisible(id)) return false;
        // Relic upgrades are always shown (they collapse to an icon when maxed).
        if (category === 'relic') return true;
        return this.shouldShowUpgrade(this.upgrades.isMaxed(id));
      });
  }

  /** Checks gate conditions for an upgrade. */
  isUpgradeVisible(id: string): boolean {
    const gates = this.upgrades.getGates(id);
    if (!gates) return true;
    if (gates.requiresApothecary    && !this.apothecaryUnlocked)                     return false;
    if (gates.requiresCulinarian    && !this.culinarianUnlocked)                     return false;
    if (gates.requiresThief         && !this.thiefUnlocked)                          return false;
    if (gates.requiresRelic         && !this.wallet.isCurrencyUnlocked('relic'))     return false;
    if (gates.requiresFang          && !this.wallet.isCurrencyUnlocked('kobold-fang')) return false;
    if (gates.requiresDossier       && !this.wallet.isCurrencyUnlocked('dossier'))   return false;
    if (gates.requiresBubblingBrew  && this.upgrades.level('BUBBLING_BREW') < 1)     return false;
    if (gates.requiresPotionDilution && this.upgrades.level('POTION_DILUTION') < 1)  return false;
    if (gates.requiresLockedIn      && this.upgrades.level('LOCKED_IN') < 1)         return false;
    if (gates.xpMin != null && this.highestXp < gates.xpMin) return false;
    if (gates.requiresSharperSwordsMin != null && this.upgrades.level('SHARPER_SWORDS') < gates.requiresSharperSwordsMin) return false;
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
    if (this.upgrades.category(id) === 'relic') return UPGRADE_COLORS.relic;
    if (this.upgrades.maxLevel(id) === 1 || this.upgrades.isMaxed(id)) return UPGRADE_COLORS.rare;
    return UPGRADE_COLORS.standard;
  }

  /** Format large numbers as shorthand. */
  formatNumber(num: number): string {
    return fmtNumber(num);
  }

  // ── Relic popup ────────────────────────────────────────────────

  openRelicPopup(id: string): void { this.relicPopupId = id; }
  closeRelicPopup(): void          { this.relicPopupId = null; }

  /** True if the active character has at least one relic upgrade not yet purchased. */
  get anyRelicUnpurchased(): boolean {
    return this.getVisibleUpgrades('relic').some(id => !this.upgrades.isMaxed(id));
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
    });
    this.charService.characters$.subscribe(chars => {
      this.apothecaryUnlocked = chars.find(c => c.id === 'apothecary')?.unlocked ?? false;
      this.culinarianUnlocked = chars.find(c => c.id === 'culinarian')?.unlocked ?? false;
      this.thiefUnlocked      = chars.find(c => c.id === 'thief')?.unlocked      ?? false;
      this.unlockedCharacters = chars.filter(c => c.unlocked).map(c => ({ id: c.id, name: c.name, color: c.color }));
      // Track character unlock milestones
      for (const c of chars) {
        if (c.unlocked && c.id !== 'fighter') {
          this.statsService.recordMilestone(`char_${c.id}`, `${c.name} Unlocked`);
        }
      }
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
    });

    // Passive gold income (Contracted Hirelings only)
    setInterval(() => {
      const autoGold = calcAutoGoldPerSecond(
        this.upgrades.level('CONTRACTED_HIRELINGS'),
        this.upgrades.level('HIRELINGS_HIRELINGS'),
      );
      if (autoGold > 0) {
        this.wallet.add('gold', autoGold);
        this.statsService.trackCurrencyGain('gold', autoGold);
      }
    }, 1000);

    // Passive ranger income: Baited Traps (beast) + Hovel Garden (herb) — every 5 seconds
    setInterval(() => {
      const beastYield = this.upgrades.level('BAITED_TRAPS');
      if (beastYield > 0) {
        this.wallet.add('beast', beastYield);
        this.statsService.trackCurrencyGain('beast', beastYield);
      }
      const herbYield = this.upgrades.level('HOVEL_GARDEN');
      if (herbYield > 0) {
        this.wallet.add('herb', herbYield);
        this.statsService.trackCurrencyGain('herb', herbYield);
      }
    }, 5000);

    // Fermentation Vats: convert herbs → potions every 10 seconds (when enabled)
    setInterval(() => {
      const vatLevel = this.upgrades.level('FERMENTATION_VATS');
      if (vatLevel > 0 && this.fermentationVatsEnabled) {
        if (this.wallet.canAfford('herb', vatLevel)) {
          this.wallet.remove('herb', vatLevel);
          this.wallet.add('potion', vatLevel);
          this.statsService.trackCurrencyGain('potion', vatLevel);
        }
      }
    }, 10000);

    // Jack auto-clicks: each allocated Jack fires once per second
    setInterval(() => {
      const ctx = this.buildJackAutoClickCtx();
      for (const [charId, count] of Object.entries(this.jacksAllocations)) {
        for (let i = 0; i < count; i++) performJackAutoClick(charId, ctx);
      }
    }, 1000);
  }

  ngOnInit(): void {
    this.saveService.registerUpgradeHandlers(
      () => this.getUpgradeState(),
      (s) => this.setUpgradeState(s),
    );
    this.saveService.hideMaxedUpgrades$.subscribe(v    => this.hideMaxedUpgrades    = v);
    this.saveService.hideMinigameUpgrades$.subscribe(v => this.hideMinigameUpgrades = v);
    this.saveService.blandMode$.subscribe(v            => this.blandMode            = v);

    // Keep --log-height in sync so sidebars shrink when the log is expanded.
    this.log.minimized$.subscribe(minimized => {
      const px = minimized ? 30 : 210;
      document.documentElement.style.setProperty('--log-height', `${px}px`);
    });

    if (this.saveService.hasSave()) this.saveService.loadFromLocalStorage();
    this.saveService.startAutoSave();
  }

  ngOnDestroy(): void {
    this.saveService.stopAutoSave();
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
      jacksOwned:              this.jacksOwned,
      jacksAllocations:        { ...this.jacksAllocations },
      fighterCombatState:      this.fighterCombatState ?? undefined,
      shortRestEnabled:        this.shortRestEnabled,
      wholesaleSpicesEnabled:  this.wholesaleSpicesEnabled,
      dilutionEnabled:         this.dilutionEnabled,
      fermentationVatsEnabled: this.fermentationVatsEnabled,
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
    this.jacksOwned              = s.jacksOwned              ?? 0;
    this.jacksAllocations        = s.jacksAllocations ? { ...s.jacksAllocations } : {};
    this.fighterCombatState      = s.fighterCombatState      ?? null;
    this.shortRestEnabled        = s.shortRestEnabled        ?? false;
    this.wholesaleSpicesEnabled  = s.wholesaleSpicesEnabled  ?? true;
    this.dilutionEnabled         = s.dilutionEnabled         ?? false;
    this.fermentationVatsEnabled = s.fermentationVatsEnabled ?? true;
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
      wholesaleSpicesEnabled:  this.wholesaleSpicesEnabled,
      fermentationVatsEnabled: this.fermentationVatsEnabled,
    };
    const rates = calculatePerSecondRates(ctx);
    this.wallet.setPerSecond('gold',    rates.gold);
    this.wallet.setPerSecond('xp',      rates.xp);
    this.wallet.setPerSecond('herb',    rates.herb);
    this.wallet.setPerSecond('beast',   rates.beast);
    this.wallet.setPerSecond('potion',  rates.potion);
    this.wallet.setPerSecond('spice',   rates.spice);
    this.wallet.setPerSecond('dossier', rates.dossier);
    this.wallet.setPerSecondBreakdown(calculatePerSecondBreakdown(ctx));
  }

  // ── Hero click actions ─────────────────────────────────────────

  clickHero(): void {
    dispatchHeroClick(this.activeCharacterId, this.buildHeroActionCtx());
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

  // ── Minigame unlock ────────────────────────────────────────────

  buyMinigameUnlock(): void {
    if (this.minigameUnlocked) return;
    const { MINIGAME_GOLD: goldCost, MINIGAME_POTIONS: potionCost, MINIGAME_BEAST: beastCost } = UNLOCK_COSTS;
    if (!this.wallet.canAfford('gold',   goldCost)   ||
        !this.wallet.canAfford('potion', potionCost) ||
        !this.wallet.canAfford('beast',  beastCost)) {
      this.log.log(`Not enough resources to unlock Minigames. Need ${cur('gold', goldCost, '')}, ${cur('potion', potionCost, '')}, ${cur('beast', beastCost, '')}.`, 'warn');
      return;
    }
    this.wallet.remove('gold',   goldCost);
    this.wallet.remove('potion', potionCost);
    this.wallet.remove('beast',  beastCost);
    this.minigameUnlocked = true;
    this.log.log('★ MINIGAMES UNLOCKED! Character-specific challenges are now available.', 'rare');
    this.statsService.recordMilestone('minigame_unlocked', 'Minigames Unlocked');
  }

  // ── Dev tools ──────────────────────────────────────────────────

  devMenuOpen = false;
  get devToolsEnabled(): boolean { return this.saveService.enableDevTools; }

  devGrant(): void {
    for (const c of this.wallet.currencies) this.wallet.add(c.id, 1000);
    this.log.log('[DEV] +1k granted to all resources.', 'warn');
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
    this.updateAllPerSecond();
    this.log.log('[DEV] All upgrades set to level 0.', 'warn');
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

    // Max out all jacks
    this.jacksOwned = getJacksMax();

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
    };
  }
}
