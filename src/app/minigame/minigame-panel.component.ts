import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../wallet/wallet.service';
import { CharacterService } from '../character/character.service';
import { FighterMinigameComponent } from './fighter/fighter-minigame.component';
import { ApothecaryMinigameComponent } from './apothecary/apothecary-minigame.component';
import { RangerMinigameComponent } from './ranger/ranger-minigame.component';
import { CulinarianMinigameComponent } from './culinarian/culinarian-minigame.component';
import { XP_THRESHOLDS } from '../game-config';
import { MINIGAME_FLAVOR } from '../flavor-text';
import { FighterCombatState } from '../save/save.service';

interface MinigameInfo {
  characterId: string;
  title: string;
}

@Component({
  selector: 'app-minigame-panel',
  standalone: true,
  imports: [CommonModule, FighterMinigameComponent, ApothecaryMinigameComponent, RangerMinigameComponent, CulinarianMinigameComponent],
  templateUrl: './minigame-panel.component.html',
  styleUrls: ['./minigame-panel.component.scss'],
})
export class MinigamePanelComponent implements OnInit, OnDestroy {
  private wallet      = inject(WalletService);
  private charService = inject(CharacterService);
  private sub         = new Subscription();

  /** Sword sharpness passed in from AppComponent (goldPerClick). */
  @Input() fighterAttack = 1;
  /** Potion Chugging level — forwarded to the fighter minigame. */
  @Input() potionChuggingLevel = 0;
  /** Stronger Kobolds tier — forwarded to the fighter minigame. */
  @Input() strongerKoboldsLevel = 0;
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
  /** Bubbling Brew level — forwarded to the apothecary minigame. */
  @Input() bubblingBrewLevel = 0;
  /** Bigger Bubbles level — forwarded to the apothecary minigame. */
  @Input() biggerBubblesLevel = 0;
  /** Potion Dilution level — forwarded to the apothecary minigame. */
  @Input() potionDilutionLevel = 0;
  /** Serial Dilution level — forwarded to the apothecary minigame. */
  @Input() serialDilutionLevel = 0;
  /** Waste Not level — forwarded to the culinarian minigame. */
  @Input() wasteNotLevel = 0;
  /** Previously-saved fighter combat state. */
  @Input() fighterCombatState: FighterCombatState | null = null;
  /** Emitted whenever fighter combat state changes. */
  @Output() fighterCombatStateChange = new EventEmitter<FighterCombatState>();

  xp = 0;
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
  ];

  get shown(): boolean {
    return this.xp >= this.threshold;
  }

  get activeMinigame(): MinigameInfo {
    return (
      this.placeholders.find(p => p.characterId === this.activeCharacterId) ??
      this.placeholders[0]
    );
  }


  ngOnInit(): void {
    this.sub.add(
      this.wallet.state$.subscribe(s => {
        this.xp = Math.floor(s['xp']?.amount ?? 0);
      })
    );
    this.sub.add(
      this.charService.activeId$.subscribe(id => {
        this.activeCharacterId = id;
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}

