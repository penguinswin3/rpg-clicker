import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Character {
  id: string;
  name: string;
  /** Unique display color for this character's name. */
  color: string;
  description: string;
  unlocked: boolean;
  /** Gold cost to unlock. 0 = starts unlocked. */
  unlockCostGold: number;
  /** Minimum XP required before the unlock option is shown. */
  xpRequirement: number;
}

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private readonly definitions: Character[] = [
    {
      id: 'fighter',
      name: 'Fighter',
      color: '#0ff',
      description: 'A seasoned warrior armed with blade and shield.',
      unlocked: true,
      unlockCostGold: 0,
      xpRequirement: 0,
    },
    {
      id: 'ranger',
      name: 'Ranger',
      color: '#f90',
      description: 'A swift archer who strikes from the shadows.',
      unlocked: false,
      unlockCostGold: 250,
      xpRequirement: 100,
    },
  ];

  private readonly charactersSource = new BehaviorSubject<Character[]>(
    this.definitions.map(c => ({ ...c }))
  );
  readonly characters$ = this.charactersSource.asObservable();

  private readonly activeIdSource = new BehaviorSubject<string>('fighter');
  readonly activeId$ = this.activeIdSource.asObservable();

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

