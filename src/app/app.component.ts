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
import { SaveService, UpgradeState, FighterCombatState } from './save/save.service';
import { UpgradeService, UpgradeCategory } from './upgrade/upgrade.service';
import { XP_THRESHOLDS, YIELDS, UPGRADE_MAX, UNLOCK_COSTS, JACK_XP_THRESHOLDS, JACK_COSTS } from './game-config';
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
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'RPG Clicker';

  // ── Services ──────────────────────────────────────────────────
  private readonly log         = inject(ActivityLogService);
  private readonly wallet      = inject(WalletService);
  private readonly charService = inject(CharacterService);
  private readonly saveService = inject(SaveService);
  /** Exposed publicly so the template can call upgrade methods directly. */
  readonly upgrades            = inject(UpgradeService);

  // ── Readonly template refs ─────────────────────────────────────
  readonly upgradeMax     = UPGRADE_MAX;
  readonly upgradeFlavor  = UPGRADE_FLAVOR;
  readonly currencyFlavor = CURRENCY_FLAVOR;
  readonly jackFlavor     = JACK_FLAVOR;
  readonly jackCosts      = JACK_COSTS;
  readonly jackThresholds = JACK_XP_THRESHOLDS;

  // ── Wallet state ───────────────────────────────────────────────
  gold                = 0;
  xp                  = 0;
  potions             = 0;
  beast               = 0;
  koboldEars          = 0;
  pixieDust           = 0;
  concentratedPotions = 0;

  // ── Character state ────────────────────────────────────────────
  activeCharacterId  = 'fighter';
  apothecaryUnlocked = false;
  unlockedCharacters: { id: string; name: string; color: string }[] = [];

  // ── Minigame ───────────────────────────────────────────────────
  minigameUnlocked           = false;
  readonly minigameXpThreshold = XP_THRESHOLDS.MINIGAME_UNLOCK;
  readonly minigameUnlockCosts = UNLOCK_COSTS;

  get minigameShown():           boolean { return this.minigameUnlocked; }
  get minigameUnlockAvailable(): boolean {
    return this.xp >= XP_THRESHOLDS.MINIGAME_UNLOCK && !this.minigameUnlocked;
  }

  // ── Kobold level selector ──────────────────────────────────────
  selectedKoboldLevel = 1;

  // ── Fighter combat state ───────────────────────────────────────
  fighterCombatState: FighterCombatState | null = null;

  // ── UI preference flags ────────────────────────────────────────
  hideMaxedUpgrades    = false;
  hideMinigameUpgrades = false;

  // ── Jack of All Trades ─────────────────────────────────────────
  jacksOwned      = 0;
  jacksAllocations: Record<string, number> = {};
  jackStarved:     Record<string, boolean> = {};

  // ── Upgrade-derived computed getters ──────────────────────────

  /** Gold earned per fighter hero-button click. */
  get goldPerClick(): number {
    return YIELDS.FIGHTER_GOLD_PER_CLICK + this.upgrades.level('BETTER_BOUNTIES');
  }
  /** Passive gold/sec from Contracted Hirelings. */
  get autoGoldPerSecond(): number { return this.upgrades.level('CONTRACTED_HIRELINGS'); }
  /** Passive gold/sec from Potion Marketing. */
  get potionAutoGoldPerSecond(): number { return this.upgrades.level('POTION_MARKETING'); }
  /** XP awarded per fighter bounty click. */
  get xpPerBounty(): number { return 1 + this.upgrades.level('INSIGHTFUL_CONTRACTS'); }
  /** Fighter minigame attack power. */
  get fighterAttackPower(): number { return this.goldPerClick + this.upgrades.level('SHARPER_SWORDS'); }
  /** Current beast-find percentage (capped). */
  get beastFindChance(): number {
    return Math.min(YIELDS.RANGER_BEAST_CHANCE_CAP,
      YIELDS.RANGER_BASE_BEAST_CHANCE + this.upgrades.level('BETTER_TRACKING'));
  }
  /** Herb save chance in % — equals Potion Titration level. */
  get herbSaveChance(): number { return this.upgrades.level('POTION_TITRATION'); }

  // ── Jack computed getters ──────────────────────────────────────
  get jacksUnlockedCount(): number { return JACK_XP_THRESHOLDS.filter(t => this.xp >= t).length; }
  get jacksToPurchase():    number { return Math.max(0, this.jacksUnlockedCount - this.jacksOwned); }
  get jacksPoolFree():      number {
    const allocated = Object.values(this.jacksAllocations).reduce((a, b) => a + b, 0);
    return this.jacksOwned - allocated;
  }
  get jacksVisible():       boolean { return this.xp >= JACK_XP_THRESHOLDS[0] || this.jacksOwned > 0; }
  get nextJackThreshold():  number | null { return JACK_XP_THRESHOLDS.find(t => t > this.xp) ?? null; }

  get activeCharacterInfo(): { id: string; name: string; color: string } | undefined {
    return this.unlockedCharacters.find(c => c.id === this.activeCharacterId);
  }
  get activeCharJackStarved(): boolean {
    return this.getJackCount(this.activeCharacterId) > 0 && !!this.jackStarved[this.activeCharacterId];
  }
  get activeCharJackStarvedMsg(): string {
    if (this.activeCharacterId === 'apothecary') {
      const need = YIELDS.APOTHECARY_BREW_HERB_COST;
      const have = Math.floor(this.wallet.get('herb'));
      return `⚠ Jack idle — need ${need} herbs (have ${have})`;
    }
    return '⚠ Jack idle — insufficient resources';
  }

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
  get jackCurrentGoldCost():     number { return Math.floor(JACK_COSTS.GOLD    * Math.pow(JACK_COSTS.SCALE, this.jacksOwned)); }
  get jackCurrentBeastCost():    number { return Math.floor(JACK_COSTS.BEAST   * Math.pow(JACK_COSTS.SCALE, this.jacksOwned)); }
  get jackCurrentPotionCost():   number { return Math.floor(JACK_COSTS.POTIONS * Math.pow(JACK_COSTS.SCALE, this.jacksOwned)); }
  get jackCurrentKoboldEarCost(): number {
    if (this.jacksOwned < JACK_COSTS.RARE_THRESHOLD) return 0;
    return Math.floor(JACK_COSTS.KOBOLD_EARS_BASE * Math.pow(JACK_COSTS.SCALE, this.jacksOwned - JACK_COSTS.RARE_THRESHOLD));
  }
  get jackCurrentPixieDustCost(): number {
    if (this.jacksOwned < JACK_COSTS.RARE_THRESHOLD) return 0;
    return Math.floor(JACK_COSTS.PIXIE_DUST_BASE * Math.pow(JACK_COSTS.SCALE, this.jacksOwned - JACK_COSTS.RARE_THRESHOLD));
  }

  getJackCount(charId: string): number { return this.jacksAllocations[charId] ?? 0; }

  // ── Display helpers ────────────────────────────────────────────

  get questBtnLabel(): string {
    const map: Record<string, string> = {
      fighter:    CHARACTER_FLAVOR.FIGHTER.questBtn,
      ranger:     CHARACTER_FLAVOR.RANGER.questBtn,
      apothecary: CHARACTER_FLAVOR.APOTHECARY.questBtn,
    };
    return map[this.activeCharacterId] ?? CHARACTER_FLAVOR.FIGHTER.questBtn;
  }

  /** Display string for herb doubling — e.g. "3× + 25%" */
  get herbDoublingDisplay(): string {
    const level      = this.upgrades.level('MORE_HERBS');
    const guaranteed = Math.floor(level / 100);
    const remainder  = level % 100;
    if (guaranteed === 0) return `${remainder}% chance`;
    if (remainder  === 0) return `${guaranteed}× (guaranteed)`;
    return `${guaranteed}× + ${remainder}% again`;
  }

  get heroStats(): HeroStat[] {
    if (this.activeCharacterId === 'ranger') {
      return [
        { label: HERO_STATS_FLAVOR.RANGER.HERB_CHANCE,  value: '50%'                      },
        { label: HERO_STATS_FLAVOR.RANGER.BEAST_CHANCE, value: `${this.beastFindChance}%` },
        { label: HERO_STATS_FLAVOR.RANGER.HERB_DOUBLE,  value: this.herbDoublingDisplay   },
        ...(this.upgrades.level('POTION_CATS_EYE') > 0
          ? [{ label: HERO_STATS_FLAVOR.RANGER.CATS_EYE, value: `${this.upgrades.level('POTION_CATS_EYE')}%` }]
          : []),
        ...(this.upgrades.level('BIGGER_GAME') > 0
          ? [{ label: HERO_STATS_FLAVOR.RANGER.MAX_MEAT, value: `1-${this.upgrades.level('BIGGER_GAME') + 1}` }]
          : []),
      ];
    }
    if (this.activeCharacterId === 'apothecary') {
      return [
        { label: HERO_STATS_FLAVOR.APOTHECARY.HERBS_BREW,  value: `${YIELDS.APOTHECARY_BREW_HERB_COST}` },
        { label: HERO_STATS_FLAVOR.APOTHECARY.SAVE_CHANCE, value: `${this.herbSaveChance}%`              },
        { label: HERO_STATS_FLAVOR.APOTHECARY.SELL_RATE,   value: `${this.potionAutoGoldPerSecond}g/s`   },
      ];
    }
    // Fighter
    return [
      { label: HERO_STATS_FLAVOR.FIGHTER.PER_CLICK,  value: `${this.goldPerClick}`      },
      { label: HERO_STATS_FLAVOR.FIGHTER.PER_SECOND, value: `${this.autoGoldPerSecond}` },
      ...(this.upgrades.level('INSIGHTFUL_CONTRACTS') > 0
        ? [{ label: HERO_STATS_FLAVOR.FIGHTER.XP_PER_CLICK, value: `${this.xpPerBounty}` }]
        : []),
    ];
  }

  shouldShowUpgrade(isMaxed: boolean): boolean {
    return !this.hideMaxedUpgrades || !isMaxed;
  }

  // ── Dynamic upgrade helpers ────────────────────────────────────

  /** Returns visible upgrade IDs for the active character in the given column. */
  getVisibleUpgrades(category: UpgradeCategory): string[] {
    return this.upgrades.getUpgradesFor(this.activeCharacterId, category)
      .filter(id => this.isUpgradeVisible(id) && this.shouldShowUpgrade(this.upgrades.isMaxed(id)));
  }

  /** Checks gate conditions (apothecary unlock, XP threshold) for an upgrade. */
  isUpgradeVisible(id: string): boolean {
    const gates = this.upgrades.getGates(id);
    if (!gates) return true;
    if (gates.requiresApothecary && !this.apothecaryUnlocked) return false;
    if (gates.xpMin != null && this.xp < gates.xpMin) return false;
    return true;
  }

  /** Returns a live description suffix for upgrades that show current values. */
  upgradeDescSuffix(id: string): string {
    switch (id) {
      case 'BETTER_TRACKING': return ` (now ${this.beastFindChance}%)`;
      case 'BIGGER_GAME':     return ` (now 1-${this.upgrades.level('BIGGER_GAME') + 1})`;
      default:                return '';
    }
  }

  /** Safe accessor for currency flavor by dynamic key. */
  getCurrencyFlavor(currency: string): { symbol: string; color: string } {
    return (CURRENCY_FLAVOR as Record<string, { symbol: string; color: string }>)[currency]
      ?? { symbol: '?', color: '#ccc' };
  }

  /** Safe accessor for upgrade flavor by dynamic key. */
  getUpgradeFlavor(id: string): { name: string; desc: string } {
    return (UPGRADE_FLAVOR as Record<string, { name: string; desc: string }>)[id]
      ?? { name: id, desc: '' };
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
    });

    this.charService.activeId$.subscribe(id => { this.activeCharacterId = id; });
    this.charService.characters$.subscribe(chars => {
      this.apothecaryUnlocked = chars.find(c => c.id === 'apothecary')?.unlocked ?? false;
      this.unlockedCharacters = chars.filter(c => c.unlocked).map(c => ({ id: c.id, name: c.name, color: c.color }));
    });

    // Reactively update per-second display rates whenever any upgrade changes
    this.upgrades.changed$.subscribe(() => this.updateAllPerSecond());

    // Passive gold income (Contracted Hirelings + Potion Marketing)
    setInterval(() => {
      const total = this.autoGoldPerSecond + this.potionAutoGoldPerSecond;
      if (total > 0) this.wallet.add('gold', total);
    }, 1000);

    // Jack auto-clicks: each allocated Jack fires once per second
    setInterval(() => {
      for (const [charId, count] of Object.entries(this.jacksAllocations)) {
        for (let i = 0; i < count; i++) this.jackAutoClick(charId);
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
      ...this.upgrades.snapshotToLegacy(),
      selectedKoboldLevel: this.selectedKoboldLevel,
      minigameUnlocked:    this.minigameUnlocked,
      jacksOwned:          this.jacksOwned,
      jacksAllocations:    { ...this.jacksAllocations },
      fighterCombatState:  this.fighterCombatState ?? undefined,
    };
  }

  setUpgradeState(s: UpgradeState): void {
    this.upgrades.restoreFromLegacy(s);
    this.selectedKoboldLevel = Math.max(1, Math.min(
      s.selectedKoboldLevel ?? 1,
      this.upgrades.level('STRONGER_KOBOLDS') + 1,
    ));
    this.minigameUnlocked   = s.minigameUnlocked   ?? false;
    this.jacksOwned         = s.jacksOwned         ?? 0;
    this.jacksAllocations   = s.jacksAllocations ? { ...s.jacksAllocations } : {};
    this.fighterCombatState = s.fighterCombatState ?? null;
    this.updateAllPerSecond();
  }

  // ── Per-second display rates ───────────────────────────────────

  private updateAllPerSecond(): void {
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const fighterJacks    = this.jacksAllocations['fighter']    ?? 0;
    const rangerJacks     = this.jacksAllocations['ranger']     ?? 0;
    const apothecaryJacks = this.jacksAllocations['apothecary'] ?? 0;
    const totalJacks      = fighterJacks + rangerJacks + apothecaryJacks;

    this.wallet.setPerSecond('gold',
      round2(this.autoGoldPerSecond + this.potionAutoGoldPerSecond + fighterJacks * this.goldPerClick));

    this.wallet.setPerSecond('xp', round2(totalJacks));

    const herbProduced = rangerJacks * 0.5 * this.expectedHerbPerRangerClick();
    const herbConsumed = apothecaryJacks * (YIELDS.APOTHECARY_BREW_HERB_COST - this.herbSaveChance / 100);
    this.wallet.setPerSecond('herb', round2(herbProduced - herbConsumed));

    const expectedMeatYield = (this.upgrades.level('BIGGER_GAME') + 2) / 2;
    this.wallet.setPerSecond('beast',
      round2(rangerJacks * 0.5 * (this.beastFindChance / 100) * expectedMeatYield));

    this.wallet.setPerSecond('potion', round2(apothecaryJacks));
  }

  /**
   * Expected herb yield per single Ranger click (before the 50/50 herb-vs-beast split).
   * Used for per-second rate display.
   */
  private expectedHerbPerRangerClick(): number {
    const level      = this.upgrades.level('MORE_HERBS');
    const guaranteed = Math.floor(level / 100);
    const remainder  = level % 100;
    return YIELDS.RANGER_BASE_HERBS * Math.pow(2, guaranteed) * (1 + remainder / 100);
  }

  // ── Hero click actions ─────────────────────────────────────────

  clickHero(): void {
    if      (this.activeCharacterId === 'ranger')     this.clickRanger();
    else if (this.activeCharacterId === 'apothecary') this.clickApothecary();
    else                                               this.clickFighter();
  }

  private clickFighter(): void {
    this.wallet.add('gold', this.goldPerClick);
    this.wallet.add('xp',   this.xpPerBounty);
    this.log.log(`You ventured forth and found ${this.goldPerClick} gold.`);
  }

  private clickRanger(): void {
    this.wallet.add('xp', 1);
    const catsEyeLevel = this.upgrades.level('POTION_CATS_EYE');
    const catsEyeProcs = catsEyeLevel > 0 && Math.random() * 100 < catsEyeLevel;

    if (catsEyeProcs) {
      const herbs    = this.computeHerbYield();
      const gotBeast = Math.random() < this.beastFindChance / 100;
      this.wallet.add('herb', herbs);
      if (gotBeast) {
        const meat = this.computeMeatYield();
        this.wallet.add('beast', meat);
        this.log.log(`Cat's Eye! You foraged ${herbs} herb(s) AND hunted a beast! (+${meat} meat, +1 XP)`, 'success');
      } else {
        this.log.log(`Cat's Eye! You foraged ${herbs} herb(s), but the beast escaped. (+1 XP)`, 'success');
      }
    } else {
      const targetHerb = Math.random() < 0.5;
      if (targetHerb) {
        const herbs = this.computeHerbYield();
        this.wallet.add('herb', herbs);
        this.log.log(`You targeted herbs and foraged ${herbs} herb(s). (+1 XP)`);
      } else {
        const gotBeast = Math.random() < this.beastFindChance / 100;
        if (gotBeast) {
          const meat = this.computeMeatYield();
          this.wallet.add('beast', meat);
          this.log.log(`You tracked a beast and claimed its meat. (+${meat} meat, +1 XP)`);
        } else {
          this.log.log(`You targeted a beast but it escaped. (+1 XP)`);
        }
      }
    }
  }

  private clickApothecary(): void {
    const herbCost = YIELDS.APOTHECARY_BREW_HERB_COST;
    if (!this.wallet.canAfford('herb', herbCost)) {
      const have = Math.floor(this.wallet.get('herb'));
      this.log.log(`Not enough herbs to brew. Need ${herbCost}, have ${have}.`, 'warn');
      return;
    }
    this.wallet.remove('herb', herbCost);
    this.wallet.add('potion', 1);
    this.wallet.add('xp', 1);
    if (this.herbSaveChance > 0 && Math.random() * 100 < this.herbSaveChance) {
      this.wallet.add('herb', 1);
      this.log.log(`You brewed a potion and recovered a herb! (+1 XP)`, 'success');
    } else {
      this.log.log(`You brewed a potion from ${herbCost} herbs. (+1 XP)`);
    }
  }

  // ── Yield helpers ──────────────────────────────────────────────

  private computeHerbYield(): number {
    const level      = this.upgrades.level('MORE_HERBS');
    const guaranteed = Math.floor(level / 100);
    const remainder  = level % 100;
    const extra      = Math.random() * 100 < remainder ? 1 : 0;
    return YIELDS.RANGER_BASE_HERBS * Math.pow(2, guaranteed + extra);
  }

  private computeMeatYield(): number {
    return Math.floor(Math.random() * (this.upgrades.level('BIGGER_GAME') + 1)) + 1;
  }

  // ── Jack methods ───────────────────────────────────────────────

  buyJack(): void {
    if (this.jacksToPurchase <= 0) return;
    if (!this.canAffordJack) {
      this.log.log('Not enough resources to hire a Jack.', 'warn');
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

  private jackAutoClick(charId: string): void {
    if (charId === 'fighter') {
      this.wallet.add('gold', this.goldPerClick);
      this.wallet.add('xp',   this.xpPerBounty);
      if (this.jackStarved[charId]) this.jackStarved = { ...this.jackStarved, [charId]: false };

    } else if (charId === 'ranger') {
      this.wallet.add('xp', 1);
      const catsEyeLevel = this.upgrades.level('POTION_CATS_EYE');
      const catsEyeProcs = catsEyeLevel > 0 && Math.random() * 100 < catsEyeLevel;
      if (catsEyeProcs) {
        this.wallet.add('herb', this.computeHerbYield());
        if (Math.random() < this.beastFindChance / 100) this.wallet.add('beast', this.computeMeatYield());
      } else {
        const targetHerb = Math.random() < 0.5;
        if (targetHerb) {
          this.wallet.add('herb', this.computeHerbYield());
        } else if (Math.random() < this.beastFindChance / 100) {
          this.wallet.add('beast', this.computeMeatYield());
        }
      }
      if (this.jackStarved[charId]) this.jackStarved = { ...this.jackStarved, [charId]: false };

    } else if (charId === 'apothecary') {
      const herbCost = YIELDS.APOTHECARY_BREW_HERB_COST;
      if (!this.wallet.canAfford('herb', herbCost)) {
        if (!this.jackStarved[charId]) this.jackStarved = { ...this.jackStarved, [charId]: true };
        return;
      }
      if (this.jackStarved[charId]) this.jackStarved = { ...this.jackStarved, [charId]: false };
      this.wallet.remove('herb', herbCost);
      this.wallet.add('potion', 1);
      this.wallet.add('xp', 1);
      if (this.herbSaveChance > 0 && Math.random() * 100 < this.herbSaveChance) this.wallet.add('herb', 1);
    }
  }

  // ── Minigame unlock ────────────────────────────────────────────

  buyMinigameUnlock(): void {
    if (this.minigameUnlocked) return;
    const { MINIGAME_GOLD: goldCost, MINIGAME_POTIONS: potionCost, MINIGAME_BEAST: beastCost } = UNLOCK_COSTS;
    if (!this.wallet.canAfford('gold',   goldCost)   ||
        !this.wallet.canAfford('potion', potionCost) ||
        !this.wallet.canAfford('beast',  beastCost)) {
      this.log.log(`Not enough resources to unlock Minigames. Need ${goldCost}g, ${potionCost}pt, ${beastCost}Ꮻ.`, 'warn');
      return;
    }
    this.wallet.remove('gold',   goldCost);
    this.wallet.remove('potion', potionCost);
    this.wallet.remove('beast',  beastCost);
    this.minigameUnlocked = true;
    this.log.log('★ MINIGAMES UNLOCKED! Character-specific challenges are now available.', 'rare');
  }

  // ── Dev tools ──────────────────────────────────────────────────

  devMenuOpen = false;

  devGrant(): void {
    for (const c of this.wallet.currencies) this.wallet.add(c.id, 250);
    this.log.log('[DEV] +250 granted to all resources.', 'warn');
  }

  devZero(): void {
    for (const c of this.wallet.currencies) this.wallet.set(c.id, 0);
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
}
