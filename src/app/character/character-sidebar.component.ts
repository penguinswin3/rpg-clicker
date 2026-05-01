import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { CharacterService, Character } from './character.service';
import { SaveService } from '../options/save.service';
import { HERO_STATS_FLAVOR } from '../flavor-text';

export interface HeroStat {
  label: string;
  value: string;
  color?: string;
}

@Component({
  selector: 'app-character-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './character-sidebar.component.html',
  styleUrl: './character-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterSidebarComponent implements OnInit, OnDestroy {
  @Input() heroStats: HeroStat[] = [];
  /** Passed in from AppComponent so the sidebar can display Jack assignment counts. */
  @Input() jacksAllocations: Record<string, number> = {};
  @Input() jacksOwned = 0;
  @Input() sidequestJacksEnabled: Record<string, boolean> = {};
  @Output() unassignAllJacks = new EventEmitter<void>();
  @Output() unassignAllSidequestJacks = new EventEmitter<void>();

  // ── Button state mirroring (visual only) ─────────────────
  /** True while the Thief is in a stun lockout. */
  @Input() isThiefStunned = false;
  /** Inline styles for the thief stun fill-bar animation. */
  @Input() thiefStunAnimStyle: Record<string, string> = {};
  /** True while the Artisan's appraisal timer is running. */
  @Input() isArtisanTimerActive = false;
  /** Inline styles for the artisan timer fill-bar animation. */
  @Input() artisanTimerAnimStyle: Record<string, string> = {};
  /** Which necromancer button is currently active ('defile' or 'ward'). */
  @Input() necromancerActiveButton: 'defile' | 'ward' = 'defile';
  /** Set of character IDs that should display a "new content" shine effect. */
  @Input() charShine: Set<string> = new Set();
  /** Current Artificer insight level (for sidebar coloring). */
  @Input() artificerInsight = 0;
  /** Maximum Artificer insight (for sidebar coloring ratio). */
  @Input() artificerMaxInsight = 8;

  getJackCount(charId: string): number {
    if (charId === 'necromancer') {
      return (this.jacksAllocations['necromancer-defile'] ?? 0)
           + (this.jacksAllocations['necromancer-ward'] ?? 0);
    }
    if (charId === 'artificer') {
      return (this.jacksAllocations['artificer-study'] ?? 0)
           + (this.jacksAllocations['artificer-reflect'] ?? 0);
    }
    return this.jacksAllocations[charId] ?? 0;
  }

  get totalJacksAssigned(): number {
    return Object.values(this.jacksAllocations).reduce((a, b) => a + b, 0);
  }

  get totalSidequestJacksAssigned(): number {
    return Object.values(this.sidequestJacksEnabled).filter(Boolean).length;
  }

  emitUnassignAll(): void {
    this.unassignAllJacks.emit();
  }

  private charService = inject(CharacterService);
  private saveService = inject(SaveService);
  private cdr         = inject(ChangeDetectorRef);
  private sub = new Subscription();

  characters: Character[] = [];
  activeId  = 'fighter';
  collapsed = false;
  blandMode = false;

  readonly heroStatsFlavor = HERO_STATS_FLAVOR;

  /** Pre-computed unlocked characters — updated in subscription callback. */
  unlockedCharacters: Character[] = [];

  ngOnInit(): void {
    this.sub.add(this.charService.characters$.subscribe(c => {
      this.characters = c;
      this.unlockedCharacters = c.filter(ch => ch.unlocked);
      this.cdr.markForCheck();
    }));
    this.sub.add(this.charService.activeId$.subscribe(id => { this.activeId = id; this.cdr.markForCheck(); }));
    this.sub.add(this.charService.sidebarCollapsed$.subscribe(v => { this.collapsed = v; this.cdr.markForCheck(); }));
    this.sub.add(this.saveService.blandMode$.subscribe(v => { this.blandMode = v; this.cdr.markForCheck(); }));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  toggle(): void {
    this.charService.toggleSidebar();
  }

  setActive(id: string): void {
    this.charService.setActive(id);
  }
}
