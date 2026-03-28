import { Component, inject, OnInit } from '@angular/core';
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
import { XP_THRESHOLDS, BASE_COSTS, COST_SCALE, YIELDS } from './game-config';

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
export class AppComponent implements OnInit {
  title = 'RPG Clicker';

  // Synced from wallet
  gold    = 0;
  xp      = 0;
  potions = 0;

  readonly minigameXpThreshold = XP_THRESHOLDS.MINIGAME_UNLOCK;

  get minigameShown(): boolean {
    return this.xp >= XP_THRESHOLDS.MINIGAME_UNLOCK;
  }

  // Active character (synced from CharacterService)
  activeCharacterId = 'fighter';

  // ── Fighter upgrades ──────────────────────
  goldPerClick: number      = YIELDS.FIGHTER_GOLD_PER_CLICK;
  clickUpgradeCost: number  = BASE_COSTS.SHARPER_SWORD;
  clickUpgradeLevel         = 0;

  autoUpgradeCost: number   = BASE_COSTS.CONTRACT_KILLING;
  autoUpgradeLevel          = 0;

  /** Derived — 1 gold/sec per Contract Killing level. Never stored directly. */
  get autoGoldPerSecond(): number { return this.autoUpgradeLevel; }

  /** Shown only once the Apothecary is unlocked (potion currency available). */
  apothecaryUnlocked         = false;
  potionChuggingLevel        = 0;
  potionChuggingCost: number = BASE_COSTS.POTION_CHUGGING;

  // ── Ranger upgrades ───────────────────────
  herbsPerFind: number      = YIELDS.RANGER_BASE_HERBS;
  moreHerbsCost: number     = BASE_COSTS.MORE_HERBS;
  moreHerbsLevel            = 0;

  betterTrackingLevel       = 0;
  betterTrackingCost: number = BASE_COSTS.BETTER_TRACKING;

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

  // ── Hero Stats (feeds character sidebar) ──
  get heroStats(): HeroStat[] {
    if (this.activeCharacterId === 'ranger') {
      return [
        { label: 'Herb Chance  :', value: `50%`                       },
        { label: 'Beast Chance :', value: `${this.beastFindChance}%`  },
        { label: 'Herbs / Find :', value: `${this.herbsPerFind}`      },
      ];
    }
    if (this.activeCharacterId === 'apothecary') {
      return [
        { label: 'Herbs/Brew   :', value: '5'                            },
        { label: 'Save Chance  :', value: `${this.herbSaveChance}%`      },
        { label: 'Sell Rate    :', value: `${this.potionAutoGoldPerSecond}g/s` },
      ];
    }
    return [
      { label: 'Per Click   :', value: `${this.goldPerClick}`      },
      { label: 'Per Second  :', value: `${this.autoGoldPerSecond}` },
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
    });
    this.charService.activeId$.subscribe(id => {
      this.activeCharacterId = id;
    });
    this.charService.characters$.subscribe(chars => {
      this.apothecaryUnlocked = chars.find(c => c.id === 'apothecary')?.unlocked ?? false;
    });
    setInterval(() => {
      const total = this.autoGoldPerSecond + this.potionAutoGoldPerSecond;
      if (total > 0) {
        this.wallet.add('gold', total);
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
      herbsPerFind:             this.herbsPerFind,
      moreHerbsCost:            this.moreHerbsCost,
      moreHerbsLevel:           this.moreHerbsLevel,
      betterTrackingLevel:      this.betterTrackingLevel,
      betterTrackingCost:       this.betterTrackingCost,
      herbSaveChance:           this.herbSaveChance,
      potionTitrationCost:      this.potionTitrationCost,
      potionTitrationLevel:     this.potionTitrationLevel,
      potionMarketingCost:      this.potionMarketingCost,
      potionMarketingLevel:     this.potionMarketingLevel,
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
    this.herbsPerFind            = s.herbsPerFind;
    this.moreHerbsCost           = s.moreHerbsCost;
    this.moreHerbsLevel          = s.moreHerbsLevel;
    this.betterTrackingLevel     = s.betterTrackingLevel;
    this.betterTrackingCost      = s.betterTrackingCost;
    this.herbSaveChance          = s.herbSaveChance;
    this.potionTitrationCost     = s.potionTitrationCost;
    this.potionTitrationLevel    = s.potionTitrationLevel;
    this.potionMarketingCost     = s.potionMarketingCost;
    this.potionMarketingLevel    = s.potionMarketingLevel;
    // autoGoldPerSecond and potionAutoGoldPerSecond are derived getters —
    // updateGoldPerSecond() reads them and syncs the wallet display.
    this.updateGoldPerSecond();
  }

  private updateGoldPerSecond(): void {
    this.wallet.setPerSecond('gold', this.autoGoldPerSecond + this.potionAutoGoldPerSecond);
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
      // Second roll: always succeeds for herb foraging; More Herbs raises the yield
      this.wallet.add('herb', this.herbsPerFind);
      this.log.log(
        `You targeted herbs and foraged ${this.herbsPerFind} herb(s). (+1 XP)`
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

  buyClickUpgrade(): void {
    if (this.wallet.canAfford('gold', this.clickUpgradeCost)) {
      this.wallet.remove('gold', this.clickUpgradeCost);
      this.clickUpgradeLevel++;
      this.goldPerClick++;
      this.clickUpgradeCost = Math.floor(this.clickUpgradeCost * COST_SCALE.SHARPER_SWORD);
      this.log.log(
        `Sharper Sword upgraded to Lv.${this.clickUpgradeLevel}. Now earning ${this.goldPerClick}g per click.`,
        'success'
      );
    } else {
      this.log.log(
        `Not enough gold for Sharper Sword. Need ${this.clickUpgradeCost}g, have ${this.gold}g.`,
        'warn'
      );
    }
  }

  buyAutoUpgrade(): void {
    if (this.wallet.canAfford('gold', this.autoUpgradeCost)) {
      this.wallet.remove('gold', this.autoUpgradeCost);
      this.autoUpgradeLevel++;
      this.autoUpgradeCost = Math.floor(this.autoUpgradeCost * COST_SCALE.CONTRACT_KILLING);
      this.updateGoldPerSecond();
      this.log.log(
        `Contract Killing upgraded to Lv.${this.autoUpgradeLevel}. Now earning ${this.autoGoldPerSecond}g/sec.`,
        'success'
      );
    } else {
      this.log.log(
        `Not enough gold for Contract Killing. Need ${this.autoUpgradeCost}g, have ${this.gold}g.`,
        'warn'
      );
    }
  }

  buyPotionChugging(): void {
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

  // ── Ranger upgrade methods ────────────────

  buyMoreHerbs(): void {
    if (this.wallet.canAfford('gold', this.moreHerbsCost)) {
      this.wallet.remove('gold', this.moreHerbsCost);
      this.moreHerbsLevel++;
      this.herbsPerFind++;
      this.moreHerbsCost = Math.floor(this.moreHerbsCost * COST_SCALE.MORE_HERBS);
      this.log.log(
        `More Herbs upgraded to Lv.${this.moreHerbsLevel}. Now finding ${this.herbsPerFind} herb(s) per forage.`,
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

  // ── Apothecary upgrade methods ────────────

  buyPotionTitration(): void {
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
    if (this.wallet.canAfford('gold', this.potionMarketingCost)) {
      this.wallet.remove('gold', this.potionMarketingCost);
      this.potionMarketingLevel++;
      this.potionMarketingCost = Math.floor(this.potionMarketingCost * COST_SCALE.POTION_MARKETING);
      this.updateGoldPerSecond();
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
