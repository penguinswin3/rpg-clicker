import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../wallet/wallet.service';
import { CharacterService } from '../character/character.service';
import { FighterMinigameComponent } from './fighter/fighter-minigame.component';
import { ApothecaryMinigameComponent } from './apothecary/apothecary-minigame.component';
import { RangerMinigameComponent } from './ranger/ranger-minigame.component';
import { XP_THRESHOLDS } from '../game-config';

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

  xp = 0;
  activeCharacterId = 'fighter';
  readonly threshold = XP_THRESHOLDS.MINIGAME_UNLOCK;

  readonly placeholders: MinigamePlaceholder[] = [
    {
      characterId: 'fighter',
      title: 'Battle Arena',
      description: 'Face waves of enemies in gladiatorial combat.\nSurvive as long as you can.',
      ascii:
        '    O    \n' +
        '   /|\\   \n' +
        '   / \\   \n' +
        ' -------- \n' +
        '  FIGHTER ',
    },
    {
      characterId: 'ranger',
      title: 'Hunting Grounds',
      description: 'Track and pursue elusive prey\nthrough the ancient forest.',
      ascii:
        ' }---->   \n' +
        ' }---->   \n' +
        '  ~forest~\n' +
        ' }---->   \n' +
        '  RANGER  ',
    },
    {
      characterId: 'apothecary',
      title: 'Alchemy Bench',
      description: 'Combine rare ingredients to brew\npowerful concoctions.',
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

