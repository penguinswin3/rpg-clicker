import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { XP_THRESHOLDS, UNLOCK_COSTS } from '../game-config';

export interface UnlockCost {
  currencyId: string;
  amount: number;
}

export interface Character {
  id: string;
  name: string;
  /** Unique display color for this character's name. */
  color: string;
  description: string;
  unlocked: boolean;
  /** Costs required to unlock. Empty array = free / starts unlocked. */
  unlockCosts: UnlockCost[];
  /** Minimum XP required before the unlock option is shown. */
  xpRequirement: number;
}

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private readonly definitions: Character[] = [
    {
      id: 'fighter',
      name: 'Fighter',
      color: '#c87941',
      description: 'A seasoned warrior armed with blade and shield.',
      unlocked: true,
      unlockCosts: [],
      xpRequirement: 0,
    },
    {
      id: 'ranger',
      name: 'Ranger',
      color: '#2d7a2d',
      description: 'A swift archer who strikes from the shadows.',
      unlocked: false,
      unlockCosts: [{ currencyId: 'gold', amount: UNLOCK_COSTS.RANGER_GOLD }],
      xpRequirement: XP_THRESHOLDS.RANGER_UNLOCK,
    },
    {
      id: 'apothecary',
      name: 'Apothecary',
      color: '#9d6ec7',
      description: 'A skilled brewer who turns rare ingredients into powerful potions.',
      unlocked: false,
      unlockCosts: [
        { currencyId: 'gold', amount: UNLOCK_COSTS.APOTHECARY_GOLD },
        { currencyId: 'herb', amount: UNLOCK_COSTS.APOTHECARY_HERBS },
      ],
      xpRequirement: XP_THRESHOLDS.APOTHECARY_UNLOCK,
    },
  ];

  private readonly charactersSource = new BehaviorSubject<Character[]>(
    this.definitions.map(c => ({ ...c }))
  );
  readonly characters$ = this.charactersSource.asObservable();

  private readonly activeIdSource = new BehaviorSubject<string>('fighter');
  readonly activeId$ = this.activeIdSource.asObservable();

  private readonly sidebarCollapsedSource = new BehaviorSubject<boolean>(false);
  /** Emits true when the character sidebar is collapsed. */
  readonly sidebarCollapsed$ = this.sidebarCollapsedSource.asObservable();

  get sidebarCollapsed(): boolean {
    return this.sidebarCollapsedSource.getValue();
  }

  toggleSidebar(): void {
    this.sidebarCollapsedSource.next(!this.sidebarCollapsedSource.getValue());
  }

  get activeId(): string {
    return this.activeIdSource.getValue();
  }

  getCharacters(): Character[] {
    return this.charactersSource.getValue();
  }

  /**
   * Mark a character as unlocked.
   * The caller is responsible for deducting the gold cost first.
   */
  unlock(id: string): void {
    this.charactersSource.next(
      this.charactersSource.getValue().map(c =>
        c.id === id ? { ...c, unlocked: true } : c
      )
    );
  }

  /** Switch the active character (only allowed if already unlocked). */
  setActive(id: string): void {
    const char = this.charactersSource.getValue().find(c => c.id === id);
    if (char?.unlocked) {
      this.activeIdSource.next(id);
    }
  }
}
