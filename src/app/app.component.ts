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
import { SaveService, UpgradeState, FighterCombatState } from './options/save.service';
import { UpgradeService, UpgradeCategory } from './upgrade/upgrade.service';
import { XP_THRESHOLDS, YIELDS, UNLOCK_COSTS, JACK_GOLD_COST, JACK_RESOURCE_PROGRESSION } from './game-config';
import { UPGRADE_FLAVOR, HERO_STATS_FLAVOR, CHARACTER_FLAVOR, CURRENCY_FLAVOR } from './flavor-text';
import { fmtNumber, clamp, scaledCost, randInt, rollChance, roundTo } from './utils/mathUtils';

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
  readonly minigameUnlockCosts = UNLOCK_COSTS;

  // ── Wallet state ───────────────────────────────────────────────
  gold                = 0;
  xp                  = 0;
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
  unlockedCharacters: { id: string; name: string; color: string }[] = [];

  // ── Minigame ───────────────────────────────────────────────────
  minigameUnlocked = false;

  get minigameShown():           boolean { return this.minigameUnlocked; }
  get minigameUnlockAvailable(): boolean {
    return this.xp >= XP_THRESHOLDS.MINIGAME_UNLOCK && !this.minigameUnlocked;
  }

  // ── Kobold level selector ──────────────────────────────────────
  selectedKoboldLevel = 1;

  // ── Fighter combat state ───────────────────────────────────────
  fighterCombatState: FighterCombatState | null = null;
  /** Whether the Short Rest auto-heal toggle is enabled in the fighter minigame. */
  shortRestEnabled = false;

  // ── UI preference flags ────────────────────────────────────────
  hideMaxedUpgrades    = false;
  hideMinigameUpgrades = false;
  blandMode            = false;

  // ── Culinarian toggles ─────────────────────────────────────────
  wholesaleSpicesEnabled = true;

  toggleWholesaleSpices(): void {
    this.wholesaleSpicesEnabled = !this.wholesaleSpicesEnabled;
    this.updateAllPerSecond();
  }

  // ── Jack of All Trades ─────────────────────────────────────────
  jacksOwned      = 0;
  jacksAllocations: Record<string, number> = {};
  jackStarved:     Record<string, boolean> = {};

  // ── Upgrade-derived computed getters ──────────────────────────

  /** Gold earned per fighter hero-button click. */
  get goldPerClick(): number {
    return YIELDS.FIGHTER_GOLD_PER_CLICK + this.upgrades.level('BETTER_BOUNTIES');
  }
  /** Passive gold/sec from Contracted Hirelings, multiplied by Hireling's Hirelings level. */
  get autoGoldPerSecond(): number {
    const base       = this.upgrades.level('CONTRACTED_HIRELINGS');
    const multiplier = this.upgrades.level('HIRELINGS_HIRELINGS');
    return base + (base * multiplier);
  }
  /** Gold earned per potion base brew from Potion Marketing (one per upgrade level). */
  get potionMarketingGoldPerBrew(): number { return this.upgrades.level('POTION_MARKETING'); }
  /** XP awarded per fighter bounty click. */
  get xpPerBounty(): number { return 1 + this.upgrades.level('INSIGHTFUL_CONTRACTS'); }
  /** Fighter minigame attack power. */
  get fighterAttackPower(): number { return this.goldPerClick + this.upgrades.level('SHARPER_SWORDS'); }
  /** Current beast-find percentage (capped). */
  get beastFindChance(): number {
    return clamp(YIELDS.RANGER_BASE_BEAST_CHANCE + this.upgrades.level('BETTER_TRACKING'), 0, YIELDS.RANGER_BEAST_CHANCE_CAP);
  }
  /** Herb save chance in % — equals Potion Titration level. */
  get herbSaveChance(): number { return this.upgrades.level('POTION_TITRATION'); }
  /** Spice gained per Culinarian hero-button click (base 1 + Wholesale Spices level, if enabled). */
  get spicePerClick(): number {
    return this.wholesaleSpicesEnabled ? 1 + this.upgrades.level('WHOLESALE_SPICES') : 1;
  }
  /** Gold cost per Culinarian hero-button click — rises by CULINARIAN_WHOLESALE_GOLD_PER_LEVEL per upgrade level. */
  get culinarianGoldCost(): number {
    const wsLevel  = this.wholesaleSpicesEnabled ? this.upgrades.level('WHOLESALE_SPICES') : 0;
    const baseCost = YIELDS.CULINARIAN_SPICE_COST
      + ((25 - wsLevel + 24) / 2) * wsLevel;
    const discount = 1 - this.upgrades.level('POTION_GLIBNESS') / 100;
    return Math.max(1, Math.floor(baseCost * discount));
  }

  // ── Jack computed getters ──────────────────────────────────────
  /** Maximum jacks that can ever be hired: 1 gold-only + one per progression entry. */
  private get jacksMax(): number { return 1 + JACK_RESOURCE_PROGRESSION.length; }
  get jacksVisible():       boolean { return this.xp >= XP_THRESHOLDS.JACKS_UNLOCK || this.jacksOwned > 0; }
  get jacksToPurchase():    number { return this.jacksVisible && this.jacksOwned < this.jacksMax ? 1 : 0; }
  get jacksPoolFree():      number {
    const allocated = Object.values(this.jacksAllocations).reduce((a, b) => a + b, 0);
    return this.jacksOwned - allocated;
  }

  /** Active costs for the next jack hire — scaled gold + one unscaled secondary resource. */
  get jackCurrentCosts(): Array<{ currency: string; amount: number }> {
    const costs: Array<{ currency: string; amount: number }> = [
      { currency: 'gold', amount: scaledCost(JACK_GOLD_COST.base, JACK_GOLD_COST.scale, this.jacksOwned) },
    ];
    const resourceIdx = this.jacksOwned - 1;   // Jack 1 = gold only, Jack 2 = index 0, etc.
    if (resourceIdx >= 0 && resourceIdx < JACK_RESOURCE_PROGRESSION.length) {
      const res = JACK_RESOURCE_PROGRESSION[resourceIdx];
      costs.push({ currency: res.currency, amount: res.base });
    }
    return costs;
  }

  get canAffordJack(): boolean {
    return this.jackCurrentCosts.every(c => this.wallet.canAfford(c.currency, c.amount));
  }

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
    if (this.activeCharacterId === 'culinarian') {
      const need = this.culinarianGoldCost;
      const have = Math.floor(this.wallet.get('gold'));
      return `⚠ Jack idle — need ${need} gold (have ${have})`;
    }
    return '⚠ Jack idle — insufficient resources';
  }


  getJackCount(charId: string): number { return this.jacksAllocations[charId] ?? 0; }

  // ── Display helpers ────────────────────────────────────────────

  get questBtnLabel(): string {
    const map: Record<string, string> = {
      fighter:    CHARACTER_FLAVOR.FIGHTER.questBtn,
      ranger:     CHARACTER_FLAVOR.RANGER.questBtn,
      apothecary: CHARACTER_FLAVOR.APOTHECARY.questBtn,
      culinarian: CHARACTER_FLAVOR.CULINARIAN.questBtn,
    };
    return map[this.activeCharacterId] ?? CHARACTER_FLAVOR.FIGHTER.questBtn;
  }

  /** Display string for herb doubling — e.g. "3× + 25%" */
  get herbDoublingDisplay(): string {
    const level      = this.upgrades.level('MORE_HERBS');
    const guaranteed = Math.floor(level / 100);
    const remainder  = level % 100;
    if (guaranteed === 0) return `${remainder}%`;
    if (remainder  === 0) return `${guaranteed}× (guaranteed)`;
    return `${guaranteed}× + ${remainder}% again`;
  }

  get heroStats(): HeroStat[] {
    if (this.activeCharacterId === 'ranger') {
      return [
        { label: HERO_STATS_FLAVOR.RANGER.BEAST_CHANCE, value: `${this.beastFindChance}%` },
        { label: HERO_STATS_FLAVOR.RANGER.HERB_DOUBLE,  value: this.herbDoublingDisplay   },
        { label: HERO_STATS_FLAVOR.RANGER.CATS_EYE,     value: `${this.upgrades.level('POTION_CATS_EYE')}%` },
        ...(this.upgrades.level('BIGGER_GAME') > 0
          ? [{ label: HERO_STATS_FLAVOR.RANGER.MAX_MEAT, value: `${this.upgrades.level('BIGGER_GAME') + 1}` }]
          : []),
      ];
    }
    if (this.activeCharacterId === 'apothecary') {
      const stats: HeroStat[] = [
        { label: HERO_STATS_FLAVOR.APOTHECARY.HERBS_BREW,   value: `${YIELDS.APOTHECARY_BREW_HERB_COST}`         },
        { label: HERO_STATS_FLAVOR.APOTHECARY.SAVE_CHANCE,  value: `${this.herbSaveChance}%`                     },
        { label: HERO_STATS_FLAVOR.APOTHECARY.GOLD_PER_BREW,value: `${this.potionMarketingGoldPerBrew}`          },
      ];
      if (this.upgrades.level('POTION_DILUTION') >= 1) {
        const successChance = Math.min(100, 50 + this.upgrades.level('SERIAL_DILUTION'));
        stats.push({
          label: HERO_STATS_FLAVOR.APOTHECARY.DILUTION_SUCCESS,
          value: `${successChance}%`,
        });
      }
      return stats;
    }
    if (this.activeCharacterId === 'culinarian') {
      const stats: HeroStat[] = [
        { label: HERO_STATS_FLAVOR.CULINARIAN.SPICE_PER_CLICK, value: `${this.spicePerClick}`      },
        { label: HERO_STATS_FLAVOR.CULINARIAN.GOLD_COST,        value: `${this.culinarianGoldCost}` },
      ];
      if (this.upgrades.level('POTION_GLIBNESS') > 0) {
        stats.push({
          label: HERO_STATS_FLAVOR.CULINARIAN.GOLD_DISCOUNT,
          value: `-${this.upgrades.level('POTION_GLIBNESS')}%`,
        });
      }
      return stats;
    }
    // Fighter
    return [
      { label: HERO_STATS_FLAVOR.FIGHTER.PER_CLICK,    value: `${this.goldPerClick}`      },
      { label: HERO_STATS_FLAVOR.FIGHTER.PER_SECOND,   value: `${this.autoGoldPerSecond}` },
      ...(this.minigameUnlocked
        ? [{ label: HERO_STATS_FLAVOR.FIGHTER.DAMAGE_RANGE, value: `1-${1 + this.upgrades.level('SHARPER_SWORDS')}` }]
        : []),
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

  /** Checks gate conditions (apothecary unlock, culinarian unlock, XP threshold) for an upgrade. */
  isUpgradeVisible(id: string): boolean {
    const gates = this.upgrades.getGates(id);
    if (!gates) return true;
    if (gates.requiresApothecary  && !this.apothecaryUnlocked)  return false;
    if (gates.requiresCulinarian  && !this.culinarianUnlocked)  return false;
    if (gates.requiresBubblingBrew && this.upgrades.level('BUBBLING_BREW') < 1) return false;
    if (gates.requiresPotionDilution && this.upgrades.level('POTION_DILUTION') < 1) return false;
    if (gates.xpMin != null && this.xp < gates.xpMin) return false;
    return true;
  }

  /** Returns a live description suffix for upgrades that show current values. */
  upgradeDescSuffix(id: string): string {
    switch (id) {
      case 'BETTER_TRACKING':  return ` (now ${this.beastFindChance}%)`;
      default:                 return '';
    }
  }

  /** Safe accessor for currency flavor by dynamic key. */
  getCurrencyFlavor(currency: string): { symbol: string; color: string } {
    return (CURRENCY_FLAVOR as Record<string, { symbol: string; color: string }>)[currency]
      ?? { symbol: '?', color: '#ccc' };
  }

  /** Whether the player can afford a specific currency amount (used for partial-cost highlighting). */
  canAffordCurrency(currency: string, amount: number): boolean {
    return this.wallet.canAfford(currency, amount);
  }

  /** Safe accessor for upgrade flavor by dynamic key. */
  getUpgradeFlavor(id: string): { name: string; desc: string } {
    return (UPGRADE_FLAVOR as Record<string, { name: string; desc: string }>)[id]
      ?? { name: id, desc: '' };
  }

  /** Format large numbers as shorthand: 11800 → "11.8k", 1200000 → "1.2M", etc. */
  formatNumber(num: number): string {
    return fmtNumber(num);
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

    this.charService.activeId$.subscribe(id => { this.activeCharacterId = id; });
    this.charService.characters$.subscribe(chars => {
      this.apothecaryUnlocked = chars.find(c => c.id === 'apothecary')?.unlocked ?? false;
      this.culinarianUnlocked = chars.find(c => c.id === 'culinarian')?.unlocked ?? false;
      this.unlockedCharacters = chars.filter(c => c.unlocked).map(c => ({ id: c.id, name: c.name, color: c.color }));
    });

    // Reactively update per-second display rates whenever any upgrade changes
    this.upgrades.changed$.subscribe(() => this.updateAllPerSecond());

    // Passive gold income (Contracted Hirelings only — Potion Marketing is per-brew, not per-second)
    setInterval(() => {
      if (this.autoGoldPerSecond > 0) this.wallet.add('gold', this.autoGoldPerSecond);
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
    this.saveService.blandMode$.subscribe(v            => this.blandMode            = v);
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
      upgradeLevels:          this.upgrades.snapshot(),
      selectedKoboldLevel:    this.selectedKoboldLevel,
      minigameUnlocked:       this.minigameUnlocked,
      jacksOwned:             this.jacksOwned,
      jacksAllocations:       { ...this.jacksAllocations },
      fighterCombatState:     this.fighterCombatState ?? undefined,
      shortRestEnabled:       this.shortRestEnabled,
      wholesaleSpicesEnabled: this.wholesaleSpicesEnabled,
    };
  }

  setUpgradeState(s: UpgradeState): void {
    this.upgrades.restore(s.upgradeLevels);
    this.selectedKoboldLevel = clamp(
      s.selectedKoboldLevel ?? 1,
      1,
      this.upgrades.level('STRONGER_KOBOLDS') + 1,
    );
    this.minigameUnlocked       = s.minigameUnlocked       ?? false;
    this.jacksOwned             = s.jacksOwned             ?? 0;
    this.jacksAllocations       = s.jacksAllocations ? { ...s.jacksAllocations } : {};
    this.fighterCombatState     = s.fighterCombatState     ?? null;
    this.shortRestEnabled       = s.shortRestEnabled       ?? false;
    this.wholesaleSpicesEnabled = s.wholesaleSpicesEnabled ?? true;
    this.updateAllPerSecond();
  }

  // ── Per-second display rates ───────────────────────────────────

  private updateAllPerSecond(): void {
    const fighterJacks    = this.jacksAllocations['fighter']    ?? 0;
    const rangerJacks     = this.jacksAllocations['ranger']     ?? 0;
    // Starved jacks produce nothing — exclude them from all display rates.
    const apothecaryJacks = this.jackStarved['apothecary'] ? 0 : (this.jacksAllocations['apothecary'] ?? 0);
    const culinarianJacks = this.jackStarved['culinarian'] ? 0 : (this.jacksAllocations['culinarian'] ?? 0);

    // Culinarian Jacks cost gold each tick; subtract from total gold income.
    // Apothecary Jacks generate gold per brew via Potion Marketing.
    this.wallet.setPerSecond('gold',
      roundTo(this.autoGoldPerSecond
        + apothecaryJacks * this.potionMarketingGoldPerBrew
        + fighterJacks * this.goldPerClick
        - culinarianJacks * this.culinarianGoldCost, 2));

    // Fighter jacks fire xpPerBounty per click; all other jacks give 1 XP each.
    this.wallet.setPerSecond('xp',
      roundTo(fighterJacks * this.xpPerBounty + rangerJacks + apothecaryJacks + culinarianJacks, 2));

    const herbProduced = rangerJacks * 0.5 * this.expectedHerbPerRangerClick();
    const herbConsumed = apothecaryJacks * (YIELDS.APOTHECARY_BREW_HERB_COST - this.herbSaveChance / 100);
    this.wallet.setPerSecond('herb', roundTo(herbProduced - herbConsumed, 2));

    const expectedMeatYield = (this.upgrades.level('BIGGER_GAME') + 2) / 2;
    this.wallet.setPerSecond('beast',
      roundTo(rangerJacks * 0.5 * (this.beastFindChance / 100) * expectedMeatYield, 2));

    this.wallet.setPerSecond('potion', roundTo(apothecaryJacks, 2));
    this.wallet.setPerSecond('spice',  roundTo(culinarianJacks * this.spicePerClick, 2));
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
    else if (this.activeCharacterId === 'culinarian') this.clickCulinarian();
    else                                               this.clickFighter();
  }

  private clickFighter(): void {
    this.wallet.add('gold', this.goldPerClick);
    this.wallet.add('xp',   this.xpPerBounty);
    this.log.log(`You ventured forth and found ${this.goldPerClick} gold. (+${this.xpPerBounty} XP)`);
  }

  private clickRanger(): void {
    this.wallet.add('xp', 1);
    const catsEyeLevel = this.upgrades.level('POTION_CATS_EYE');
    const catsEyeProcs = catsEyeLevel > 0 && rollChance(catsEyeLevel);

    if (catsEyeProcs) {
      const herbs    = this.computeHerbYield();
      const gotBeast = rollChance(this.beastFindChance);
      this.wallet.add('herb', herbs);
      if (gotBeast) {
        const meat = this.computeMeatYield();
        this.wallet.add('beast', meat);
        this.log.log(`Cat's Eye! You foraged ${herbs} herb(s) AND hunted a beast! (+${meat} meat, +1 XP)`, 'success');
      } else {
        this.log.log(`Cat's Eye! You foraged ${herbs} herb(s), but the beast escaped. (+1 XP)`, 'success');
      }
    } else {
      const targetHerb = rollChance(50);
      if (targetHerb) {
        const herbs = this.computeHerbYield();
        this.wallet.add('herb', herbs);
        this.log.log(`You targeted herbs and foraged ${herbs} herb(s). (+1 XP)`);
      } else {
        const gotBeast = rollChance(this.beastFindChance);
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
    if (this.potionMarketingGoldPerBrew > 0) this.wallet.add('gold', this.potionMarketingGoldPerBrew);
    if (this.herbSaveChance > 0 && rollChance(this.herbSaveChance)) {
      this.wallet.add('herb', 1);
      this.log.log(`You brewed a potion and recovered a herb! (+1 XP)`, 'success');
    } else {
      this.log.log(`You brewed a potion from ${herbCost} herbs. (+1 XP)`);
    }
  }

  private clickCulinarian(): void {
    const goldCost   = this.culinarianGoldCost;
    const spiceYield = this.spicePerClick;
    if (!this.wallet.canAfford('gold', goldCost)) {
      const have = Math.floor(this.wallet.get('gold'));
      this.log.log(`Not enough gold to gather spices. Need ${goldCost}g, have ${have}g.`, 'warn');
      return;
    }
    this.wallet.remove('gold', goldCost);
    this.wallet.add('spice', spiceYield);
    this.wallet.add('xp', 1);
    this.log.log(`You sourced exotic spices. (−${goldCost}g, +${spiceYield}${CURRENCY_FLAVOR.spice.symbol}, +1 XP)`);
  }

  // ── Yield helpers ──────────────────────────────────────────────

  private computeHerbYield(): number {
    const level      = this.upgrades.level('MORE_HERBS');
    const guaranteed = Math.floor(level / 100);
    const remainder  = level % 100;
    const extra      = rollChance(remainder) ? 1 : 0;
    return YIELDS.RANGER_BASE_HERBS * Math.pow(2, guaranteed + extra);
  }

  private computeMeatYield(): number {
    return randInt(1, this.upgrades.level('BIGGER_GAME') + 1);
  }

  // ── Jack methods ───────────────────────────────────────────────

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

  private jackAutoClick(charId: string): void {
    if (charId === 'fighter') {
      this.wallet.add('gold', this.goldPerClick);
      this.wallet.add('xp',   this.xpPerBounty);
      if (this.jackStarved[charId]) this.jackStarved = { ...this.jackStarved, [charId]: false };

    } else if (charId === 'ranger') {
      this.wallet.add('xp', 1);
      const catsEyeLevel = this.upgrades.level('POTION_CATS_EYE');
      const catsEyeProcs = catsEyeLevel > 0 && rollChance(catsEyeLevel);
      if (catsEyeProcs) {
        this.wallet.add('herb', this.computeHerbYield());
        if (rollChance(this.beastFindChance)) this.wallet.add('beast', this.computeMeatYield());
      } else {
        const targetHerb = rollChance(50);
        if (targetHerb) {
          this.wallet.add('herb', this.computeHerbYield());
        } else if (rollChance(this.beastFindChance)) {
          this.wallet.add('beast', this.computeMeatYield());
        }
      }
      if (this.jackStarved[charId]) this.jackStarved = { ...this.jackStarved, [charId]: false };

    } else if (charId === 'apothecary') {
      const herbCost = YIELDS.APOTHECARY_BREW_HERB_COST;
      if (!this.wallet.canAfford('herb', herbCost)) {
        if (!this.jackStarved[charId]) {
          this.jackStarved = { ...this.jackStarved, [charId]: true };
          this.updateAllPerSecond();
        }
        return;
      }
      if (this.jackStarved[charId]) {
        this.jackStarved = { ...this.jackStarved, [charId]: false };
        this.updateAllPerSecond();
      }
      this.wallet.remove('herb', herbCost);
      this.wallet.add('potion', 1);
      this.wallet.add('xp', 1);
      if (this.potionMarketingGoldPerBrew > 0) this.wallet.add('gold', this.potionMarketingGoldPerBrew);
      if (this.herbSaveChance > 0 && rollChance(this.herbSaveChance)) this.wallet.add('herb', 1);

    } else if (charId === 'culinarian') {
      const goldCost = this.culinarianGoldCost;
      if (!this.wallet.canAfford('gold', goldCost)) {
        if (!this.jackStarved[charId]) {
          this.jackStarved = { ...this.jackStarved, [charId]: true };
          this.updateAllPerSecond();
        }
        return;
      }
      if (this.jackStarved[charId]) {
        this.jackStarved = { ...this.jackStarved, [charId]: false };
        this.updateAllPerSecond();
      }
      this.wallet.remove('gold', goldCost);
      this.wallet.add('spice', this.spicePerClick);
      this.wallet.add('xp', 1);
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

  devClearSave(): void {
    this.saveService.suppressNextSave();
    this.saveService.deleteSave();
    document.body.classList.add('screen-shake');
    setTimeout(() => window.location.reload(), 800);
  }
}
