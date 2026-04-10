import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GLOBAL_PURCHASE_DEFS, getActiveCosts } from '../game-config';
import { CHARACTER_FLAVOR } from '../flavor-text';

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

/**
 * Resolves unlock costs and xpRequirement for a character from GLOBAL_PURCHASE_DEFS.
 * Looks up the entry whose id is `UNLOCK_<CHARID>` (upper-cased).
 */
function charUnlock(charId: string): { unlockCosts: UnlockCost[]; xpRequirement: number } {
  const def = GLOBAL_PURCHASE_DEFS.find(d => d.id === `UNLOCK_${charId.toUpperCase()}`);
  if (!def) return { unlockCosts: [], xpRequirement: 0 };
  return {
    unlockCosts:    getActiveCosts(def, 0).map(c => ({ currencyId: c.currency, amount: c.amount })),
    xpRequirement:  def.xpMin ?? 0,
  };
}

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private readonly definitions: Character[] = [
    {
      id: 'fighter',
      name: CHARACTER_FLAVOR.FIGHTER.name,
      color: '#c87941',
      description: CHARACTER_FLAVOR.FIGHTER.desc,
      unlocked: true,
      unlockCosts: [],
      xpRequirement: 0,
    },
    {
      id: 'ranger',
      name: CHARACTER_FLAVOR.RANGER.name,
      color: '#2d7a2d',
      description: CHARACTER_FLAVOR.RANGER.desc,
      unlocked: false,
      ...charUnlock('ranger'),
    },
    {
      id: 'apothecary',
      name: CHARACTER_FLAVOR.APOTHECARY.name,
      color: '#9d6ec7',
      description: CHARACTER_FLAVOR.APOTHECARY.desc,
      unlocked: false,
      ...charUnlock('apothecary'),
    },
    {
      id: 'culinarian',
      name: CHARACTER_FLAVOR.CULINARIAN.name,
      color: '#c0c0c0',
      description: CHARACTER_FLAVOR.CULINARIAN.desc,
      unlocked: false,
      ...charUnlock('culinarian'),
    },
    {
      id: 'thief',
      name: CHARACTER_FLAVOR.THIEF.name,
      color: '#4a9b8e',
      description: CHARACTER_FLAVOR.THIEF.desc,
      unlocked: false,
      ...charUnlock('thief'),
    },
    {
      id: 'artisan',
      name: CHARACTER_FLAVOR.ARTISAN.name,
      color: '#e8c252',
      description: CHARACTER_FLAVOR.ARTISAN.desc,
      unlocked: false,
      ...charUnlock('artisan'),
    },
    {
      id: 'necromancer',
      name: CHARACTER_FLAVOR.NECROMANCER.name,
      color: '#3bf184',
      description: CHARACTER_FLAVOR.NECROMANCER.desc,
      unlocked: false,
      ...charUnlock('necromancer'),
    },
    {
      id: 'merchant',
      name: CHARACTER_FLAVOR.MERCHANT.name,
      color: '#4c3a29',
      description: CHARACTER_FLAVOR.MERCHANT.desc,
      unlocked: false,
      ...charUnlock('merchant'),
    },
    {
      id: 'artificer',
      name: CHARACTER_FLAVOR.ARTIFICER.name,
      color: '#7eb8d4',
      description: CHARACTER_FLAVOR.ARTIFICER.desc,
      unlocked: false,
      ...charUnlock('artificer'),
    },
    {
      id: 'chimeramancer',
      name: CHARACTER_FLAVOR.CHIMERAMANCER.name,
      color: '#c44d8e',
      description: CHARACTER_FLAVOR.CHIMERAMANCER.desc,
      unlocked: false,
      ...charUnlock('chimeramancer'),
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

  setSidebarCollapsed(v: boolean): void {
    this.sidebarCollapsedSource.next(v);
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
