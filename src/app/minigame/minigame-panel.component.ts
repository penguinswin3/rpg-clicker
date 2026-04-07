import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../wallet/wallet.service';
import { CharacterService } from '../character/character.service';
import { FighterMinigameComponent } from './fighter/fighter-minigame.component';
import { ApothecaryMinigameComponent } from './apothecary/apothecary-minigame.component';
import { RangerMinigameComponent } from './ranger/ranger-minigame.component';
import { CulinarianMinigameComponent } from './culinarian/culinarian-minigame.component';
import { ThiefMinigameComponent } from './thief/thief-minigame.component';
import { ArtisanMinigameComponent } from './artisan/artisan-minigame.component';
import { NecromancerMinigameComponent } from './necromancer/necromancer-minigame.component';
import { XP_THRESHOLDS } from '../game-config';
import { MINIGAME_FLAVOR } from '../flavor-text';
import { FighterCombatState } from '../options/save.service';

interface MinigameInfo {
  characterId: string;
  title: string;
}

@Component({
  selector: 'app-minigame-panel',
  standalone: true,
  imports: [CommonModule, FighterMinigameComponent, ApothecaryMinigameComponent, RangerMinigameComponent, CulinarianMinigameComponent, ThiefMinigameComponent, ArtisanMinigameComponent, NecromancerMinigameComponent],
  templateUrl: './minigame-panel.component.html',
  styleUrls: ['./minigame-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinigamePanelComponent implements OnInit, OnDestroy {
  private wallet      = inject(WalletService);
  private charService = inject(CharacterService);
  private cdr         = inject(ChangeDetectorRef);
  private sub         = new Subscription();

  /** Sword sharpness passed in from AppComponent (goldPerClick). */
  @Input() fighterAttack = 1;
  /** Potion Chugging level — forwarded to the fighter minigame. */
  @Input() potionChuggingLevel = 0;
  /** Stronger Kobolds tier — forwarded to the fighter minigame. */
  @Input() strongerKoboldsLevel = 0;
  /** First Strike level — forwarded to the fighter minigame. */
  @Input() firstStrikeLevel = 0;
  /** Slow Blade level — forwarded to the fighter minigame. */
  @Input() slowBladeLevel = 0;
  /** Gilded Blade level — forwarded to the fighter minigame. */
  @Input() gildedBladeLevel = 0;
  /** Potion of Mind Reading level — forwarded to the fighter minigame. */
  @Input() mindReadingLevel = 0;
  /** Potion of Cat's Swiftness level — forwarded to the fighter minigame. */
  @Input() catSwiftnessLevel = 0;
  /** Kobold Bait level — forwarded to the fighter minigame. */
  @Input() koboldBaitLevel = 0;
  /** Whether Kobold Bait is currently enabled — forwarded to the fighter minigame. */
  @Input() koboldBaitEnabled = false;
  /** Emitted when the player toggles Kobold Bait inside the fighter minigame. */
  @Output() koboldBaitEnabledChange = new EventEmitter<boolean>();
  /** Short Rest level — forwarded to the fighter minigame. */
  @Input() shortRestLevel = 0;
  /** Whether Short Rest auto-heal is currently enabled — forwarded to the fighter minigame. */
  @Input() shortRestEnabled = false;
  /** Emitted when the player toggles Short Rest inside the fighter minigame. */
  @Output() shortRestEnabledChange = new EventEmitter<boolean>();
  /** Currently-selected kobold difficulty level — forwarded to the fighter minigame. */
  @Input() selectedKoboldLevel = 1;
  /** Emitted when the player changes the kobold level inside the fighter minigame. */
  @Output() selectedKoboldLevelChange = new EventEmitter<number>();
  /** Bountiful Lands level — forwarded to the ranger minigame. */
  @Input() bountifulLandsLevel = 0;
  /** Abundant Lands level — forwarded to the ranger minigame. */
  @Input() abundantLandsLevel = 0;
  /** Fairy Hostage level — forwarded to the ranger minigame. */
  @Input() fairyHostageLevel = 0;
  /** Treasure Chest level — forwarded to the ranger minigame. */
  @Input() treasureChestLevel = 0;
  /** X Marks the Spot level — forwarded to the ranger minigame. */
  @Input() xMarksTheSpotLevel = 0;
  /** Bubbling Brew level — forwarded to the apothecary minigame. */
  @Input() bubblingBrewLevel = 0;
  /** Bigger Bubbles level — forwarded to the apothecary minigame. */
  @Input() biggerBubblesLevel = 0;
  /** Potion Dilution level — forwarded to the apothecary minigame. */
  @Input() potionDilutionLevel = 0;
  /** Serial Dilution level — forwarded to the apothecary minigame. */
  @Input() serialDilutionLevel = 0;
  /** Perfect Potions level — forwarded to the apothecary minigame. */
  @Input() perfectPotionsLevel = 0;
  /** Synaptical Potions level — forwarded to the apothecary minigame. */
  @Input() synapticalPotionsLevel = 0;
  /** Synaptic Static level — forwarded to the apothecary minigame. */
  @Input() synapticStaticLevel = 0;
  /** Whether Synaptical mode is enabled — forwarded to the apothecary minigame. */
  @Input() synapticalEnabled = false;
  /** Emitted when the player toggles synaptical mode inside the apothecary minigame. */
  @Output() synapticalEnabledChange = new EventEmitter<boolean>();
  /** Waste Not level — forwarded to the culinarian minigame. */
  @Input() wasteNotLevel = 0;
  /** Larger Cookbooks level — forwarded to the culinarian minigame. */
  @Input() largerCookbooksLevel = 0;
  /** Cookbook Annotations level — forwarded to the culinarian minigame. */
  @Input() cookbookAnnotationsLevel = 0;
  /** Vanishing Powder level — forwarded to the thief minigame. */
  @Input() vanishingPowderLevel = 0;
  /** Potion of Cat's Ears level — forwarded to the thief minigame. */
  @Input() potionCatEarsLevel = 0;
  /** Bag of Holding level — forwarded to the thief minigame. */
  @Input() bagOfHoldingLevel = 0;
  /** Relic Hunter level — forwarded to the thief minigame. */
  @Input() relicHunterLevel = 0;
  /** Locked In level — forwarded to the thief minigame. */
  @Input() lockedInLevel = 0;
  /** Flow State level — forwarded to the thief minigame. */
  @Input() flowStateLevel = 0;
  /** Lucky Gems level — forwarded to the artisan minigame. */
  @Input() luckyGemsLevel = 0;
  /** Double Dip level — forwarded to the artisan minigame. */
  @Input() doubleDipLevel = 0;
  /** Stand Out Selection level — forwarded to the artisan minigame. */
  @Input() standOutSelectionLevel = 0;
  /** Good Enough level — forwarded to the artisan minigame. */
  @Input() goodEnoughLevel = 0;
  /** Close Enough level — forwarded to the artisan minigame. */
  @Input() closeEnoughLevel = 0;
  /** Previously-saved fighter combat state. */
  @Input() fighterCombatState: FighterCombatState | null = null;
  /** Emitted whenever fighter combat state changes. */
  @Output() fighterCombatStateChange = new EventEmitter<FighterCombatState>();
  /** Whether the Potion Dilution toggle is enabled — forwarded to the apothecary minigame. */
  @Input() dilutionEnabled = false;
  /** Emitted when the player toggles dilution inside the apothecary minigame. */
  @Output() dilutionEnabledChange = new EventEmitter<boolean>();

  xp = 0;
  /** All-time peak XP — used for the threshold gate. */
  highestXpEver = 0;
  activeCharacterId = 'fighter';
  readonly threshold = XP_THRESHOLDS.MINIGAME_UNLOCK;

  readonly placeholders: MinigameInfo[] = [
    {
      characterId: 'fighter',
      title: MINIGAME_FLAVOR.FIGHTER.name,
    },
    {
      characterId: 'ranger',
      title: MINIGAME_FLAVOR.RANGER.name,
    },
    {
      characterId: 'apothecary',
      title: MINIGAME_FLAVOR.APOTHECARY.name,
    },
    {
      characterId: 'culinarian',
      title: MINIGAME_FLAVOR.CULINARIAN.name,
    },
    {
      characterId: 'thief',
      title: MINIGAME_FLAVOR.THIEF.name,
    },
    {
      characterId: 'artisan',
      title: MINIGAME_FLAVOR.ARTISAN.name,
    },
    {
      characterId: 'necromancer',
      title: MINIGAME_FLAVOR.NECROMANCER.name,
    },
  ];

  get shown(): boolean {
    return this.highestXpEver >= this.threshold;
  }

  get activeMinigame(): MinigameInfo {
    return (
      this.placeholders.find(p => p.characterId === this.activeCharacterId) ??
      this.placeholders[0]
    );
  }

  /** Whether the sidequest panel is collapsed. */
  @Input() collapsed = false;
  @Output() collapsedChange = new EventEmitter<boolean>();

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
    this.cdr.markForCheck();
  }


  ngOnInit(): void {
    this.sub.add(
      this.wallet.state$.subscribe(s => {
        this.xp = Math.floor(s['xp']?.amount ?? 0);
        this.cdr.markForCheck();
      })
    );
    this.sub.add(this.wallet.highestXpEver$.subscribe(v => { this.highestXpEver = v; this.cdr.markForCheck(); }));
    this.sub.add(
      this.charService.activeId$.subscribe(id => {
        this.activeCharacterId = id;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}

