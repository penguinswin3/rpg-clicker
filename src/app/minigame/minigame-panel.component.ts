import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../wallet/wallet.service';
import { CharacterService } from '../character/character.service';
import { FighterMinigameComponent } from './fighter/fighter-minigame.component';
import { ApothecaryMinigameComponent } from './apothecary/apothecary-minigame.component';
import { RangerMinigameComponent } from './ranger/ranger-minigame.component';
import { XP_THRESHOLDS } from '../game-config';
import { MINIGAME_FLAVOR } from '../flavor-text';
import { FighterCombatState } from '../save/save.service';

interface MinigamePlaceholder {
  characterId: string;
  title: string;
  description: string;
  ascii: string;
}

@Component({
  selector: 'app-minigame-panel',
  standalone: true,
  imports: [CommonModule, FighterMinigameComponent, ApothecaryMinigameComponent, RangerMinigameComponent],
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
  /** Currently-selected kobold difficulty level — forwarded to the fighter minigame. */
  @Input() selectedKoboldLevel = 1;
  /** Emitted when the player changes the kobold level inside the fighter minigame. */
  @Output() selectedKoboldLevelChange = new EventEmitter<number>();
  /** Bountiful Lands level — forwarded to the ranger minigame. */
  @Input() bountifulLandsLevel = 0;
  /** Abundant Lands level — forwarded to the ranger minigame. */
  @Input() abundantLandsLevel = 0;
  /** Previously-saved fighter combat state. */
  @Input() fighterCombatState: FighterCombatState | null = null;
  /** Emitted whenever fighter combat state changes. */
  @Output() fighterCombatStateChange = new EventEmitter<FighterCombatState>();

  xp = 0;
  activeCharacterId = 'fighter';
  readonly threshold = XP_THRESHOLDS.MINIGAME_UNLOCK;

  readonly placeholders: MinigamePlaceholder[] = [
    {
      characterId: 'fighter',
      title: MINIGAME_FLAVOR.FIGHTER.name,
      description: MINIGAME_FLAVOR.FIGHTER.desc,
      ascii:
        '    O    \n' +
        '   /|\\   \n' +
        '   / \\   \n' +
        ' -------- \n' +
        '  FIGHTER ',
    },
    {
      characterId: 'ranger',
      title: MINIGAME_FLAVOR.RANGER.name,
      description: MINIGAME_FLAVOR.RANGER.desc,
      ascii:
        ' }---->   \n' +
        ' }---->   \n' +
        '  ~forest~\n' +
        ' }---->   \n' +
        '  RANGER  ',
    },
    {
      characterId: 'apothecary',
      title: MINIGAME_FLAVOR.APOTHECARY.name,
      description: MINIGAME_FLAVOR.APOTHECARY.desc,
      ascii:
        '  _   _   \n' +
        ' (_) (_)  \n' +
        '  |   |   \n' +
        ' [=] [=]  \n' +
        ' APOTH.   ',
    },
  ];

  get shown(): boolean {
    return this.xp >= this.threshold;
  }

  get activeMinigame(): MinigamePlaceholder {
    return (
      this.placeholders.find(p => p.characterId === this.activeCharacterId) ??
      this.placeholders[0]
    );
  }

  get descLines(): string[] {
    return this.activeMinigame.description.split('\n');
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

