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
  /** Whether this character has been killed by the chimera (Slayer endgame). Defaults to false. */
  dead?: boolean;
  /** If true, this character is unlocked via an in-game event, not the purchase panel. */
  eventDriven?: boolean;
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
      dead: false,
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
      dead: false,
    },
    {
      id: 'apothecary',
      name: CHARACTER_FLAVOR.APOTHECARY.name,
      color: '#9d6ec7',
      description: CHARACTER_FLAVOR.APOTHECARY.desc,
      unlocked: false,
      ...charUnlock('apothecary'),
      dead: false,
    },
    {
      id: 'culinarian',
      name: CHARACTER_FLAVOR.CULINARIAN.name,
      color: '#c0c0c0',
      description: CHARACTER_FLAVOR.CULINARIAN.desc,
      unlocked: false,
      ...charUnlock('culinarian'),
      dead: false,
    },
    {
      id: 'thief',
      name: CHARACTER_FLAVOR.THIEF.name,
      color: '#4a9b8e',
      description: CHARACTER_FLAVOR.THIEF.desc,
      unlocked: false,
      ...charUnlock('thief'),
      dead: false,
    },
    {
      id: 'artisan',
      name: CHARACTER_FLAVOR.ARTISAN.name,
      color: '#e8c252',
      description: CHARACTER_FLAVOR.ARTISAN.desc,
      unlocked: false,
      ...charUnlock('artisan'),
      dead: false,
    },
    {
      id: 'necromancer',
      name: CHARACTER_FLAVOR.NECROMANCER.name,
      color: '#3bf184',
      description: CHARACTER_FLAVOR.NECROMANCER.desc,
      unlocked: false,
      ...charUnlock('necromancer'),
      dead: false,
    },
    {
      id: 'merchant',
      name: CHARACTER_FLAVOR.MERCHANT.name,
      color: '#4c3a29',
      description: CHARACTER_FLAVOR.MERCHANT.desc,
      unlocked: false,
      ...charUnlock('merchant'),
      dead: false,
    },
    {
      id: 'artificer',
      name: CHARACTER_FLAVOR.ARTIFICER.name,
      color: '#7eb8d4',
      description: CHARACTER_FLAVOR.ARTIFICER.desc,
      unlocked: false,
      ...charUnlock('artificer'),
      dead: false,
    },
    {
      id: 'chimeramancer',
      name: CHARACTER_FLAVOR.CHIMERAMANCER.name,
      color: '#c44d8e',
      description: CHARACTER_FLAVOR.CHIMERAMANCER.desc,
      unlocked: false,
      ...charUnlock('chimeramancer'),
      dead: false,
    },
    {
      id: 'slayer',
      name: CHARACTER_FLAVOR.SLAYER.name,
      color: '#8b0000',
      description: CHARACTER_FLAVOR.SLAYER.desc,
      unlocked: false,
      dead: false,
      eventDriven: true,
      unlockCosts: [{ currencyId: 'ichor', amount: 66 }],
      xpRequirement: 0,
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

  /** Deselect the current character (set active ID to empty). */
  clearActive(): void {
    this.activeIdSource.next('');
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

  /** Switch the active character (only allowed if already unlocked and not dead). Pass '' to deselect. */
  setActive(id: string): void {
    if (id === '') {
      this.activeIdSource.next('');
      return;
    }
    const char = this.charactersSource.getValue().find(c => c.id === id);
    if (char?.unlocked && !char?.dead) {
      this.activeIdSource.next(id);
    }
  }

  /** Map from character ID to their death description (from flavor text). */
  private readonly deathDescs: Record<string, string> = {
    fighter:       CHARACTER_FLAVOR.FIGHTER.deathDesc,
    ranger:        CHARACTER_FLAVOR.RANGER.deathDesc,
    apothecary:    CHARACTER_FLAVOR.APOTHECARY.deathDesc,
    culinarian:    CHARACTER_FLAVOR.CULINARIAN.deathDesc,
    thief:         CHARACTER_FLAVOR.THIEF.deathDesc,
    artisan:       CHARACTER_FLAVOR.ARTISAN.deathDesc,
    necromancer:   CHARACTER_FLAVOR.NECROMANCER.deathDesc,
    merchant:      CHARACTER_FLAVOR.MERCHANT.deathDesc,
    artificer:     CHARACTER_FLAVOR.ARTIFICER.deathDesc,
    chimeramancer: CHARACTER_FLAVOR.CHIMERAMANCER.deathDesc,
  };

  /** Mark a character as dead (killed by the chimera in the Slayer endgame). */
  kill(id: string): void {
    const deathDesc = this.deathDescs[id] ?? '';
    this.charactersSource.next(
      this.charactersSource.getValue().map(c =>
        c.id === id ? { ...c, dead: true, description: deathDesc || c.description } : c
      )
    );
  }

  /** Check if a character is dead. */
  isDead(id: string): boolean {
    return this.charactersSource.getValue().find(c => c.id === id)?.dead ?? false;
  }

  /** Restore dead state for a set of character IDs (used on save load). */
  setDead(ids: string[]): void {
    this.charactersSource.next(
      this.charactersSource.getValue().map(c =>
        ids.includes(c.id) ? { ...c, dead: true, description: this.deathDescs[c.id] || c.description } : c
      )
    );
  }
}
