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
import { OptionsMenuComponent } from './save/options-menu.component';
import { SaveService, UpgradeState } from './save/save.service';
import { XP_THRESHOLDS, BASE_COSTS, COST_SCALE, YIELDS, UPGRADE_MAX, UNLOCK_COSTS, JACK_XP_THRESHOLDS, JACK_COSTS } from './game-config';
import { UPGRADE_FLAVOR, HERO_STATS_FLAVOR, CHARACTER_FLAVOR, CURRENCY_FLAVOR, JACK_FLAVOR } from './flavor-text';

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
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'RPG Clicker';

  // Synced from wallet
  gold    = 0;
  xp      = 0;
  potions = 0;
  beast   = 0;

  readonly minigameXpThreshold = XP_THRESHOLDS.MINIGAME_UNLOCK;

  /** True once the player has purchased the Minigame unlock upgrade. */
  minigameUnlocked = false;

  get minigameShown(): boolean {
    return this.minigameUnlocked;
  }

  // ── Jack of All Trades ─────────────────────────────────────────
  readonly jackFlavor      = JACK_FLAVOR;
  readonly jackCosts       = JACK_COSTS;
  readonly jackThresholds  = JACK_XP_THRESHOLDS;

  /** Number of Jacks the player has actually hired (purchased). */
  jacksOwned = 0;
  /** Map of characterId → number of Jacks currently allocated to that character. */
  jacksAllocations: Record<string, number> = {};

  /**
   * Tracks which characters currently have Jacks that are starved of resources
   * (i.e. tried to auto-click but couldn't complete the action).
   * Cleared automatically when the Jack succeeds.
   */
  jackStarved: Record<string, boolean> = {};

  /** Unlocked characters (used for the Jack allocation panel). */
  unlockedCharacters: { id: string; name: string; color: string }[] = [];

  /** How many Jacks can be hired based on current XP (i.e. how many thresholds passed). */
  get jacksUnlockedCount(): number {
    return JACK_XP_THRESHOLDS.filter(t => this.xp >= t).length;
  }

  /** How many additional Jacks can still be purchased right now. */
  get jacksToPurchase(): number {
    return Math.max(0, this.jacksUnlockedCount - this.jacksOwned);
  }

  /** Jacks that have been hired but not yet assigned to any character. */
  get jacksPoolFree(): number {
    const allocated = Object.values(this.jacksAllocations).reduce((a, b) => a + b, 0);
    return this.jacksOwned - allocated;
  }

  /** Whether the Jack panel should be visible (first threshold has been reached OR a Jack is owned). */
  get jacksVisible(): boolean {
    return this.xp >= JACK_XP_THRESHOLDS[0] || this.jacksOwned > 0;
  }

  /** XP needed to unlock the next Jack slot, or null if all are unlocked. */
  get nextJackThreshold(): number | null {
    return JACK_XP_THRESHOLDS.find(t => t > this.xp) ?? null;
  }

  /** Whether the player can currently afford to hire a Jack. */
  get canAffordJack(): boolean {
    if (!this.wallet.canAfford('gold',   this.jackCurrentGoldCost))   return false;
    if (!this.wallet.canAfford('beast',  this.jackCurrentBeastCost))  return false;
    if (!this.wallet.canAfford('potion', this.jackCurrentPotionCost)) return false;
    if (this.jacksOwned >= JACK_COSTS.RARE_THRESHOLD) {
      if (!this.wallet.canAfford('kobold-ear', this.jackCurrentKoboldEarCost)) return false;
      if (!this.wallet.canAfford('pixie-dust', this.jackCurrentPixieDustCost)) return false;
    }
    return true;
  }

  // Scaled hire costs — each is floor(BASE × SCALE^jacksOwned)
  get jackCurrentGoldCost(): number {
    return Math.floor(JACK_COSTS.GOLD * Math.pow(JACK_COSTS.SCALE, this.jacksOwned));
  }
  get jackCurrentBeastCost(): number {
    return Math.floor(JACK_COSTS.BEAST * Math.pow(JACK_COSTS.SCALE, this.jacksOwned));
  }
  get jackCurrentPotionCost(): number {
    return Math.floor(JACK_COSTS.POTIONS * Math.pow(JACK_COSTS.SCALE, this.jacksOwned));
  }
  /** Kobold Ear cost — 0 until RARE_THRESHOLD Jacks are owned, then scales from there. */
  get jackCurrentKoboldEarCost(): number {
    if (this.jacksOwned < JACK_COSTS.RARE_THRESHOLD) return 0;
    return Math.floor(JACK_COSTS.KOBOLD_EARS_BASE
      * Math.pow(JACK_COSTS.SCALE, this.jacksOwned - JACK_COSTS.RARE_THRESHOLD));
  }
  /** Pixie Dust cost — 0 until RARE_THRESHOLD Jacks are owned, then scales from there. */
  get jackCurrentPixieDustCost(): number {
    if (this.jacksOwned < JACK_COSTS.RARE_THRESHOLD) return 0;
    return Math.floor(JACK_COSTS.PIXIE_DUST_BASE
      * Math.pow(JACK_COSTS.SCALE, this.jacksOwned - JACK_COSTS.RARE_THRESHOLD));
  }

  /** Returns how many Jacks are assigned to the given character. */
  getJackCount(charId: string): number {
    return this.jacksAllocations[charId] ?? 0;
  }

  /** The currently-active character's info for the Jack allocation row. */
  get activeCharacterInfo(): { id: string; name: string; color: string } | undefined {
    return this.unlockedCharacters.find(c => c.id === this.activeCharacterId);
  }

  /** True when the active character has at least one Jack assigned but they are all starved. */
  get activeCharJackStarved(): boolean {
    return this.getJackCount(this.activeCharacterId) > 0
      && this.jackStarved[this.activeCharacterId] === true;
  }

  /** Human-readable reason the Jack is idle for the active character. */
  get activeCharJackStarvedMsg(): string {
    if (this.activeCharacterId === 'apothecary') {
      const need = YIELDS.APOTHECARY_BREW_HERB_COST;
      const have = Math.floor(this.wallet.get('herb'));
      return `⚠ Jack idle — need ${need} herbs (have ${have})`;
    }
    return '⚠ Jack idle — insufficient resources';
  }

  /** Hire a new Jack (deduct cost, increment owned). */
  buyJack(): void {
    if (this.jacksToPurchase <= 0) return;
    if (!this.canAffordJack) {
      this.log.log(`Not enough resources to hire a Jack.`, 'warn');
      return;
    }
    this.wallet.remove('gold',   this.jackCurrentGoldCost);
    this.wallet.remove('beast',  this.jackCurrentBeastCost);
    this.wallet.remove('potion', this.jackCurrentPotionCost);
    if (this.jacksOwned >= JACK_COSTS.RARE_THRESHOLD) {
      this.wallet.remove('kobold-ear', this.jackCurrentKoboldEarCost);
      this.wallet.remove('pixie-dust', this.jackCurrentPixieDustCost);
    }
    this.jacksOwned++;
    this.log.log(`A Jack of All Trades has been hired! (Total: ${this.jacksOwned})`, 'success');
  }

  /** Move one Jack from the free pool to the given character. */
  allocateJack(charId: string): void {
    if (this.jacksPoolFree <= 0) return;
    this.jacksAllocations = {
      ...this.jacksAllocations,
      [charId]: (this.jacksAllocations[charId] ?? 0) + 1,
    };
    this.updateAllPerSecond();
  }

  /** Remove one Jack from the given character back to the free pool. */
  deallocateJack(charId: string): void {
    const current = this.jacksAllocations[charId] ?? 0;
    if (current <= 0) return;
    this.jacksAllocations = {
      ...this.jacksAllocations,
      [charId]: current - 1,
    };
    this.updateAllPerSecond();
  }

  /**
   * Silent version of hero click used by Jack auto-clicks.
   * Produces the same resources/XP as the manual click but never writes to the log.
   */
  private jackAutoClick(charId: string): void {
    if (charId === 'fighter') {
      this.wallet.add('gold', this.goldPerClick);
      this.wallet.add('xp', 1);
      if (this.jackStarved[charId]) {
        this.jackStarved = { ...this.jackStarved, [charId]: false };
      }
    } else if (charId === 'ranger') {
      this.wallet.add('xp', 1);
      const targetHerb = Math.random() < 0.5;
      if (targetHerb) {
        const herbs = this.computeHerbYield();
        this.wallet.add('herb', herbs);
      } else {
        if (Math.random() < this.beastFindChance / 100) {
          this.wallet.add('beast', 1);
        }
      }
      if (this.jackStarved[charId]) {
        this.jackStarved = { ...this.jackStarved, [charId]: false };
      }
    } else if (charId === 'apothecary') {
      const herbCost = YIELDS.APOTHECARY_BREW_HERB_COST;
      if (!this.wallet.canAfford('herb', herbCost)) {
        if (!this.jackStarved[charId]) {
          this.jackStarved = { ...this.jackStarved, [charId]: true };
        }
        return;
      }
      if (this.jackStarved[charId]) {
        this.jackStarved = { ...this.jackStarved, [charId]: false };
      }
      this.wallet.remove('herb', herbCost);
      this.wallet.add('potion', 1);
      this.wallet.add('xp', 1);
      if (this.herbSaveChance > 0 && Math.random() * 100 < this.herbSaveChance) {
        this.wallet.add('herb', 1);
      }
    }
  }

  get questBtnLabel(): string {
    const map: Record<string, string> = {
      fighter:    CHARACTER_FLAVOR.FIGHTER.questBtn,
      ranger:     CHARACTER_FLAVOR.RANGER.questBtn,
      apothecary: CHARACTER_FLAVOR.APOTHECARY.questBtn,
    };
    return map[this.activeCharacterId] ?? CHARACTER_FLAVOR.FIGHTER.questBtn;
  }

  /** Shows the minigame unlock purchase card once XP threshold is met. */
  get minigameUnlockAvailable(): boolean {
    return this.xp >= XP_THRESHOLDS.MINIGAME_UNLOCK && !this.minigameUnlocked;
  }

  readonly minigameUnlockCosts = UNLOCK_COSTS;

  // Active character (synced from CharacterService)
  activeCharacterId = 'fighter';

  // ── Fighter upgrades ──────────────────────
  goldPerClick: number      = YIELDS.FIGHTER_GOLD_PER_CLICK;
  clickUpgradeCost: number  = BASE_COSTS.BETTER_BOUNTIES;
  clickUpgradeLevel         = 0;

  autoUpgradeCost: number   = BASE_COSTS.CONTRACTED_HIRELINGS;
  autoUpgradeLevel          = 0;

  /** Derived — 1 gold/sec per Contracted Hirelings level. Never stored directly. */
  get autoGoldPerSecond(): number { return this.autoUpgradeLevel; }

  /** Shown only once the Apothecary is unlocked (potion currency available). */
  apothecaryUnlocked         = false;
  potionChuggingLevel        = 0;
  potionChuggingCost: number = BASE_COSTS.POTION_CHUGGING;

  /** Minigame upgrade — each level adds +1 attack damage in the fighter minigame. */
  sharperSwordsLevel        = 0;
  sharperSwordsCost: number = BASE_COSTS.SHARPER_SWORDS;

  /** Total attack power fed into the fighter minigame: click bonus + sword sharpness. */
  get fighterAttackPower(): number { return this.goldPerClick + this.sharperSwordsLevel; }

  // ── Ranger upgrades ───────────────────────
  /** Total doubling-chance percentage. Each level = +1%.
   *  ≥100% guarantees at least one doubling; every full 100 = one more guaranteed. */
  moreHerbsCost: number = BASE_COSTS.MORE_HERBS;
  moreHerbsLevel        = 0;

  /** Compute the herb yield for one ranger forage using the doubling formula. */
  private computeHerbYield(): number {
    const base = YIELDS.RANGER_BASE_HERBS;
    const guaranteedDoublings = Math.floor(this.moreHerbsLevel / 100);
    const remainder           = this.moreHerbsLevel % 100;
    const extraDoubling       = Math.random() * 100 < remainder ? 1 : 0;
    return base * Math.pow(2, guaranteedDoublings + extraDoubling);
  }

  /** Display string for hero stats – e.g. "3× + 25%" */
  get herbDoublingDisplay(): string {
    const guaranteed = Math.floor(this.moreHerbsLevel / 100);
    const remainder  = this.moreHerbsLevel % 100;
    if (guaranteed === 0) return `${remainder}% chance`;
    if (remainder  === 0) return `${guaranteed}× (guaranteed)`;
    return `${guaranteed}× + ${remainder}% again`;
  }

  betterTrackingLevel       = 0;
  betterTrackingCost: number = BASE_COSTS.BETTER_TRACKING;

  /** Minigame upgrade — each level gives +1% chance a blank cell yields a prize. */
  bountifulLandsLevel        = 0;
  bountifulLandsCost: number = BASE_COSTS.BOUNTIFUL_LANDS;

  get beastFindChance(): number {
    return Math.min(YIELDS.RANGER_BEAST_CHANCE_CAP, YIELDS.RANGER_BASE_BEAST_CHANCE + this.betterTrackingLevel);
  }

  // ── Apothecary upgrades ───────────────────
  /** Percentage chance (0-100) to save 1 herb when brewing. */
  herbSaveChance              = 0;
  potionTitrationCost: number = BASE_COSTS.POTION_TITRATION;
  potionTitrationLevel        = 0;

  potionMarketingCost: number = BASE_COSTS.POTION_MARKETING;
  potionMarketingLevel        = 0;

  /** Derived — 1 gold/sec per Potion Marketing level. Never stored directly. */
  get potionAutoGoldPerSecond(): number { return this.potionMarketingLevel; }

  // ── Upgrade max levels (sourced from game-config) ─────────────
  readonly upgradeMax    = UPGRADE_MAX;
  readonly upgradeFlavor = UPGRADE_FLAVOR;
  readonly currencyFlavor = CURRENCY_FLAVOR;

  get betterBountiesMaxed():    boolean { return this.clickUpgradeLevel    >= UPGRADE_MAX.BETTER_BOUNTIES;    }
  get contractedHirelingsMaxed(): boolean { return this.autoUpgradeLevel     >= UPGRADE_MAX.CONTRACTED_HIRELINGS; }
  get potionChuggingMaxed():  boolean { return this.potionChuggingLevel  >= UPGRADE_MAX.POTION_CHUGGING;  }
  get sharperSwordsMaxed():   boolean { return this.sharperSwordsLevel   >= UPGRADE_MAX.SHARPER_SWORDS;   }
  get moreHerbsMaxed():       boolean { return this.moreHerbsLevel       >= UPGRADE_MAX.MORE_HERBS;       }
  get betterTrackingMaxed():  boolean { return this.betterTrackingLevel  >= UPGRADE_MAX.BETTER_TRACKING;  }
  get bountifulLandsMaxed():  boolean { return this.bountifulLandsLevel  >= UPGRADE_MAX.BOUNTIFUL_LANDS;  }
  get potionTitrationMaxed(): boolean { return this.potionTitrationLevel >= UPGRADE_MAX.POTION_TITRATION; }
  get potionMarketingMaxed(): boolean { return this.potionMarketingLevel >= UPGRADE_MAX.POTION_MARKETING; }

  // ── Hero Stats (feeds character sidebar) ──
  get heroStats(): HeroStat[] {
    if (this.activeCharacterId === 'ranger') {
      return [
        { label: HERO_STATS_FLAVOR.RANGER.HERB_CHANCE,  value: `50%`                           },
        { label: HERO_STATS_FLAVOR.RANGER.BEAST_CHANCE, value: `${this.beastFindChance}%`      },
        { label: HERO_STATS_FLAVOR.RANGER.HERB_DOUBLE,  value: this.herbDoublingDisplay        },
      ];
    }
    if (this.activeCharacterId === 'apothecary') {
      return [
        { label: HERO_STATS_FLAVOR.APOTHECARY.HERBS_BREW,  value: '5'                                     },
        { label: HERO_STATS_FLAVOR.APOTHECARY.SAVE_CHANCE, value: `${this.herbSaveChance}%`               },
        { label: HERO_STATS_FLAVOR.APOTHECARY.SELL_RATE,   value: `${this.potionAutoGoldPerSecond}g/s`    },
      ];
    }
    return [
      { label: HERO_STATS_FLAVOR.FIGHTER.PER_CLICK,  value: `${this.goldPerClick}`      },
      { label: HERO_STATS_FLAVOR.FIGHTER.PER_SECOND, value: `${this.autoGoldPerSecond}` },
    ];
  }

  private log        = inject(ActivityLogService);
  private wallet     = inject(WalletService);
  private charService = inject(CharacterService);
  private saveService = inject(SaveService);

  constructor() {
    this.wallet.state$.subscribe(state => {
      this.gold    = Math.floor(state['gold']?.amount   ?? 0);
      this.xp      = Math.floor(state['xp']?.amount     ?? 0);
      this.potions = Math.floor(state['potion']?.amount ?? 0);
      this.beast   = Math.floor(state['beast']?.amount  ?? 0);
    });
    this.charService.activeId$.subscribe(id => {
      this.activeCharacterId = id;
    });
    this.charService.characters$.subscribe(chars => {
      this.apothecaryUnlocked = chars.find(c => c.id === 'apothecary')?.unlocked ?? false;
      this.unlockedCharacters = chars
        .filter(c => c.unlocked)
        .map(c => ({ id: c.id, name: c.name, color: c.color }));
    });
    setInterval(() => {
      const total = this.autoGoldPerSecond + this.potionAutoGoldPerSecond;
      if (total > 0) {
        this.wallet.add('gold', total);
      }
    }, 1000);
    // Jack auto-click: each allocated Jack fires once per second per assigned character
    setInterval(() => {
      for (const [charId, count] of Object.entries(this.jacksAllocations)) {
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            this.jackAutoClick(charId);
          }
        }
      }
    }, 1000);
  }

  ngOnInit(): void {
    // Register upgrade-state getter/setter so SaveService can snapshot them.
    this.saveService.registerUpgradeHandlers(
      () => this.getUpgradeState(),
      (s) => this.setUpgradeState(s),
    );
    // Auto-load from localStorage if a save exists.
    if (this.saveService.hasSave()) {
      this.saveService.loadFromLocalStorage();
    }
    // Begin auto-saving every 5 minutes.
    this.saveService.startAutoSave();
  }

  ngOnDestroy(): void {
    this.saveService.stopAutoSave();
  }

  /** Save synchronously whenever the tab is closed or the page is navigated away from. */
  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    // Skip if a dev action explicitly suppressed the next save (e.g. clear-save + reload).
    if (!this.saveService.consumeSuppression()) {
      this.saveService.saveToLocalStorage();
    }
  }
  getUpgradeState(): UpgradeState {
    return {
      goldPerClick:             this.goldPerClick,
      clickUpgradeCost:         this.clickUpgradeCost,
      clickUpgradeLevel:        this.clickUpgradeLevel,
      autoUpgradeCost:          this.autoUpgradeCost,
      autoUpgradeLevel:         this.autoUpgradeLevel,
      potionChuggingLevel:      this.potionChuggingLevel,
      potionChuggingCost:       this.potionChuggingCost,
      sharperSwordsLevel:       this.sharperSwordsLevel,
      sharperSwordsCost:        this.sharperSwordsCost,
      moreHerbsCost:            this.moreHerbsCost,
      moreHerbsLevel:           this.moreHerbsLevel,
      betterTrackingLevel:      this.betterTrackingLevel,
      betterTrackingCost:       this.betterTrackingCost,
      bountifulLandsLevel:      this.bountifulLandsLevel,
      bountifulLandsCost:       this.bountifulLandsCost,
      herbSaveChance:           this.herbSaveChance,
      potionTitrationCost:      this.potionTitrationCost,
      potionTitrationLevel:     this.potionTitrationLevel,
      potionMarketingCost:      this.potionMarketingCost,
      potionMarketingLevel:     this.potionMarketingLevel,
      minigameUnlocked:         this.minigameUnlocked,
      jacksOwned:               this.jacksOwned,
      jacksAllocations:         { ...this.jacksAllocations },
    };
  }

  setUpgradeState(s: UpgradeState): void {
    this.goldPerClick            = s.goldPerClick;
    this.clickUpgradeCost        = s.clickUpgradeCost;
    this.clickUpgradeLevel       = s.clickUpgradeLevel;
    this.autoUpgradeCost         = s.autoUpgradeCost;
    this.autoUpgradeLevel        = s.autoUpgradeLevel;
    this.potionChuggingLevel     = s.potionChuggingLevel;
    this.potionChuggingCost      = s.potionChuggingCost;
    this.sharperSwordsLevel      = s.sharperSwordsLevel  ?? 0;
    this.sharperSwordsCost       = s.sharperSwordsCost   ?? BASE_COSTS.SHARPER_SWORDS;
    // herbsPerFind is no longer stored — yield is computed from moreHerbsLevel
    this.moreHerbsCost           = s.moreHerbsCost;
    this.moreHerbsLevel          = s.moreHerbsLevel;
    this.betterTrackingLevel     = s.betterTrackingLevel;
    this.betterTrackingCost      = s.betterTrackingCost;
    this.bountifulLandsLevel     = s.bountifulLandsLevel ?? 0;
    this.bountifulLandsCost      = s.bountifulLandsCost  ?? BASE_COSTS.BOUNTIFUL_LANDS;
    this.herbSaveChance          = s.herbSaveChance;
    this.potionTitrationCost     = s.potionTitrationCost;
    this.potionTitrationLevel    = s.potionTitrationLevel;
    this.potionMarketingCost     = s.potionMarketingCost;
    this.potionMarketingLevel    = s.potionMarketingLevel;
    this.minigameUnlocked        = s.minigameUnlocked ?? false;
    this.jacksOwned              = s.jacksOwned ?? 0;
    this.jacksAllocations        = s.jacksAllocations ? { ...s.jacksAllocations } : {};
    this.updateAllPerSecond();
  }

  /**
   * Expected herb yield per single Ranger click (before the 50/50 herb-vs-beast split).
   * Used both in the actual click logic and for per-second rate display.
   */
  private expectedHerbPerRangerClick(): number {
    const base        = YIELDS.RANGER_BASE_HERBS;
    const guaranteed  = Math.floor(this.moreHerbsLevel / 100);
    const remainder   = this.moreHerbsLevel % 100;
    // Each guaranteed 100 levels = one certain doubling; remainder% = one probabilistic doubling
    return base * Math.pow(2, guaranteed) * (1 + remainder / 100);
  }

  /**
   * Recompute and push per-second display rates for every currency.
   * Called after any upgrade purchase or Jack allocation change.
   */
  private updateAllPerSecond(): void {
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const fighterJacks    = this.jacksAllocations['fighter']    ?? 0;
    const rangerJacks     = this.jacksAllocations['ranger']     ?? 0;
    const apothecaryJacks = this.jacksAllocations['apothecary'] ?? 0;
    const totalJacks      = fighterJacks + rangerJacks + apothecaryJacks;

    // Gold: passive upgrades (Contracted Hirelings + Potion Marketing) + Fighter Jacks (1 click/s × goldPerClick)
    this.wallet.setPerSecond('gold',
      round2(this.autoGoldPerSecond + this.potionAutoGoldPerSecond + fighterJacks * this.goldPerClick)
    );

    // XP: every Jack click awards 1 XP regardless of character
    this.wallet.setPerSecond('xp', round2(totalJacks));

    // Herb: Ranger Jacks produce (50% herb-target × expected yield per forage);
    //        Apothecary Jacks consume (brewCost herbs − expected herb-save)
    const herbProduced = rangerJacks * 0.5 * this.expectedHerbPerRangerClick();
    const herbConsumed = apothecaryJacks * (YIELDS.APOTHECARY_BREW_HERB_COST - this.herbSaveChance / 100);
    this.wallet.setPerSecond('herb', round2(herbProduced - herbConsumed));

    // Beast: Ranger Jacks × 50% beast-target × beastFindChance%
    this.wallet.setPerSecond('beast',
      round2(rangerJacks * 0.5 * (this.beastFindChance / 100))
    );

    // Potion: Apothecary Jacks brew one potion per click
    this.wallet.setPerSecond('potion', round2(apothecaryJacks));
  }

  // ── Adventure click ───────────────────────

  clickHero(): void {
    if (this.activeCharacterId === 'ranger') {
      this.clickRanger();
    } else if (this.activeCharacterId === 'apothecary') {
      this.clickApothecary();
    } else {
      this.clickFighter();
    }
  }

  private clickFighter(): void {
    this.wallet.add('gold', this.goldPerClick);
    this.wallet.add('xp', 1);
    this.log.log(`You ventured forth and found ${this.goldPerClick} gold.`);
  }

  private clickRanger(): void {
    this.wallet.add('xp', 1);

    // First roll: 50/50 determines the target — herb or beast
    const targetHerb = Math.random() < 0.5;

    if (targetHerb) {
      // Apply the More Herbs doubling formula
      const herbs = this.computeHerbYield();
      this.wallet.add('herb', herbs);
      this.log.log(
        `You targeted herbs and foraged ${herbs} herb(s). (+1 XP)`
      );
    } else {
      // Second roll: beastFindChance% to successfully bring down a beast
      const gotBeast = Math.random() < this.beastFindChance / 100;
      if (gotBeast) {
        this.wallet.add('beast', 1);
        this.log.log(`You tracked a beast and claimed its meat. (+1 XP)`);
      } else {
        this.log.log(`You targeted a beast but it escaped. (+1 XP)`);
      }
    }
  }

  private clickApothecary(): void {
    const herbCost = YIELDS.APOTHECARY_BREW_HERB_COST;
    if (!this.wallet.canAfford('herb', herbCost)) {
      const have = Math.floor(this.wallet.get('herb'));
      this.log.log(
        `Not enough herbs to brew. Need ${herbCost}, have ${have}.`,
        'warn'
      );
      return;
    }

    this.wallet.remove('herb', herbCost);
    this.wallet.add('potion', 1);
    this.wallet.add('xp', 1);

    // Herb-save roll (Potion Titration upgrade)
    if (this.herbSaveChance > 0 && Math.random() * 100 < this.herbSaveChance) {
      this.wallet.add('herb', 1);
      this.log.log(
        `You brewed a potion and recovered a herb! (+1 XP)`,
        'success'
      );
    } else {
      this.log.log(`You brewed a potion from ${herbCost} herbs. (+1 XP)`);
    }
  }

  // ── DEV ──────────────────────────────────

  devMenuOpen = false;

  devGrant(): void {
    for (const c of this.wallet.currencies) {
      this.wallet.add(c.id, 250);
    }
    this.log.log('[DEV] +250 granted to all resources.', 'warn');
  }

  devZero(): void {
    for (const c of this.wallet.currencies) {
      this.wallet.set(c.id, 0);
    }
    this.log.log('[DEV] All resources set to 0.', 'warn');
  }

  devMaxXp(): void {
    this.wallet.set('xp', 2_000_000_000);
    this.log.log('[DEV] XP set to 2,000,000,000.', 'warn');
  }

  devClearSave(): void {
    this.saveService.suppressNextSave();
    this.saveService.deleteSave();
    document.body.classList.add('screen-shake');
    setTimeout(() => window.location.reload(), 800);
  }

  // ── Minigame unlock ───────────────────────

  buyMinigameUnlock(): void {
    if (this.minigameUnlocked) { return; }
    const goldCost   = UNLOCK_COSTS.MINIGAME_GOLD;
    const potionCost = UNLOCK_COSTS.MINIGAME_POTIONS;
    const beastCost  = UNLOCK_COSTS.MINIGAME_BEAST;

    if (!this.wallet.canAfford('gold',   goldCost)   ||
        !this.wallet.canAfford('potion', potionCost) ||
        !this.wallet.canAfford('beast',  beastCost)) {
      this.log.log(
        `Not enough resources to unlock Minigames. Need ${goldCost}g, ${potionCost}pt, ${beastCost} beast meat.`,
        'warn'
      );
      return;
    }

    this.wallet.remove('gold',   goldCost);
    this.wallet.remove('potion', potionCost);
    this.wallet.remove('beast',  beastCost);
    this.minigameUnlocked = true;
    this.log.log(
      '★ MINIGAMES UNLOCKED! Character-specific challenges are now available.',
      'rare'
    );
  }

  buyClickUpgrade(): void {
    if (this.betterBountiesMaxed) { return; }
    if (this.wallet.canAfford('gold', this.clickUpgradeCost)) {
      this.wallet.remove('gold', this.clickUpgradeCost);
      this.clickUpgradeLevel++;
      this.goldPerClick++;
      this.clickUpgradeCost = Math.floor(this.clickUpgradeCost * COST_SCALE.BETTER_BOUNTIES);
      this.log.log(
        `Better Bounties upgraded to Lv.${this.clickUpgradeLevel}. Now earning ${this.goldPerClick}g per click.`,
        'success'
      );
    } else {
      this.log.log(
        `Not enough gold for Better Bounties. Need ${this.clickUpgradeCost}g, have ${this.gold}g.`,
        'warn'
      );
    }
  }

  buyAutoUpgrade(): void {
    if (this.contractedHirelingsMaxed) { return; }
    if (this.wallet.canAfford('gold', this.autoUpgradeCost)) {
      this.wallet.remove('gold', this.autoUpgradeCost);
      this.autoUpgradeLevel++;
      this.autoUpgradeCost = Math.floor(this.autoUpgradeCost * COST_SCALE.CONTRACTED_HIRELINGS);
      this.updateAllPerSecond();
      this.log.log(
        `Contracted Hirelings upgraded to Lv.${this.autoUpgradeLevel}. Now earning ${this.autoGoldPerSecond}g/sec.`,
        'success'
      );
    } else {
      this.log.log(
        `Not enough gold for Contracted Hirelings. Need ${this.autoUpgradeCost}g, have ${this.gold}g.`,
        'warn'
      );
    }
  }

  buyPotionChugging(): void {
    if (this.potionChuggingMaxed) { return; }
    if (this.wallet.canAfford('potion', this.potionChuggingCost)) {
      this.wallet.remove('potion', this.potionChuggingCost);
      this.potionChuggingLevel++;
      this.potionChuggingCost = Math.ceil(this.potionChuggingCost * COST_SCALE.POTION_CHUGGING);
      this.log.log(
        `Potion Chugging upgraded to Lv.${this.potionChuggingLevel}. The Fighter feels stronger...`,
        'success'
      );
    } else {
      this.log.log(
        `Not enough potions for Potion Chugging. Need ${this.potionChuggingCost}pt, have ${this.potions}pt.`,
        'warn'
      );
    }
  }

  buySharperSwords(): void {
    if (this.sharperSwordsMaxed) { return; }
    if (this.wallet.canAfford('gold', this.sharperSwordsCost)) {
      this.wallet.remove('gold', this.sharperSwordsCost);
      this.sharperSwordsLevel++;
      this.sharperSwordsCost = Math.floor(this.sharperSwordsCost * COST_SCALE.SHARPER_SWORDS);
      this.log.log(
        `Sharper Swords upgraded to Lv.${this.sharperSwordsLevel}. Attack damage is now ${this.fighterAttackPower}.`,
        'success'
      );
    } else {
      this.log.log(
        `Not enough gold for Sharper Swords. Need ${this.sharperSwordsCost}g, have ${this.gold}g.`,
        'warn'
      );
    }
  }

  // ── Ranger upgrade methods ────────────────

  buyMoreHerbs(): void {
    if (this.moreHerbsMaxed) { return; }
    if (this.wallet.canAfford('gold', this.moreHerbsCost)) {
      this.wallet.remove('gold', this.moreHerbsCost);
      this.moreHerbsLevel++;
      this.moreHerbsCost = Math.floor(this.moreHerbsCost * COST_SCALE.MORE_HERBS);
      this.log.log(
        `More Herbs upgraded to Lv.${this.moreHerbsLevel}. Doubling chance now ${this.moreHerbsLevel}%.`,
        'success'
      );
    } else {
      this.log.log(
        `Not enough gold for More Herbs. Need ${this.moreHerbsCost}g, have ${this.gold}g.`,
        'warn'
      );
    }
  }

  buyBetterTracking(): void {
    if (this.betterTrackingMaxed) { return; }
    if (this.wallet.canAfford('gold', this.betterTrackingCost)) {
      this.wallet.remove('gold', this.betterTrackingCost);
      this.betterTrackingLevel++;
      this.betterTrackingCost = Math.floor(this.betterTrackingCost * COST_SCALE.BETTER_TRACKING);
      this.log.log(
        `Better Tracking upgraded to Lv.${this.betterTrackingLevel}. Beast find chance now ${this.beastFindChance}%.`,
        'success'
      );
    } else {
      this.log.log(
        `Not enough gold for Better Tracking. Need ${this.betterTrackingCost}g, have ${this.gold}g.`,
        'warn'
      );
    }
  }

  buyBountifulLands(): void {
    if (this.bountifulLandsMaxed) { return; }
    if (this.wallet.canAfford('gold', this.bountifulLandsCost)) {
      this.wallet.remove('gold', this.bountifulLandsCost);
      this.bountifulLandsLevel++;
      this.bountifulLandsCost = Math.floor(this.bountifulLandsCost * COST_SCALE.BOUNTIFUL_LANDS);
      this.log.log(
        `Bountiful Lands upgraded to Lv.${this.bountifulLandsLevel}. Blank cell prize chance now ${this.bountifulLandsLevel}%.`,
        'success'
      );
    } else {
      this.log.log(
        `Not enough gold for Bountiful Lands. Need ${this.bountifulLandsCost}g, have ${this.gold}g.`,
        'warn'
      );
    }
  }

  // ── Apothecary upgrade methods ────────────

  buyPotionTitration(): void {
    if (this.potionTitrationMaxed) { return; }
    if (this.wallet.canAfford('gold', this.potionTitrationCost)) {
      this.wallet.remove('gold', this.potionTitrationCost);
      this.potionTitrationLevel++;
      this.herbSaveChance++;   // +1% per level
      this.potionTitrationCost = Math.floor(this.potionTitrationCost * COST_SCALE.POTION_TITRATION);
      this.log.log(
        `Potion Titration upgraded to Lv.${this.potionTitrationLevel}. Herb save chance now ${this.herbSaveChance}%.`,
        'success'
      );
    } else {
      this.log.log(
        `Not enough gold for Potion Titration. Need ${this.potionTitrationCost}g, have ${this.gold}g.`,
        'warn'
      );
    }
  }

  buyPotionMarketing(): void {
    if (this.potionMarketingMaxed) { return; }
    if (this.wallet.canAfford('gold', this.potionMarketingCost)) {
      this.wallet.remove('gold', this.potionMarketingCost);
      this.potionMarketingLevel++;
      this.potionMarketingCost = Math.floor(this.potionMarketingCost * COST_SCALE.POTION_MARKETING);
      this.updateAllPerSecond();
      this.log.log(
        `Potion Marketing upgraded to Lv.${this.potionMarketingLevel}. Now passively earning ${this.potionAutoGoldPerSecond}g/sec from sales.`,
        'success'
      );
    } else {
      this.log.log(
        `Not enough gold for Potion Marketing. Need ${this.potionMarketingCost}g, have ${this.gold}g.`,
        'warn'
      );
    }
  }
}
