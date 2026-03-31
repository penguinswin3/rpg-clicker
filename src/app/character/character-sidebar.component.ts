import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { CharacterService, Character } from './character.service';
import { SaveService } from '../save/save.service';
import { HERO_STATS_FLAVOR } from '../flavor-text';

export interface HeroStat {
  label: string;
  value: string;
}

@Component({
  selector: 'app-character-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './character-sidebar.component.html',
  styleUrl: './character-sidebar.component.scss',
})
export class CharacterSidebarComponent implements OnInit, OnDestroy {
  @Input() heroStats: HeroStat[] = [];
  /** Passed in from AppComponent so the sidebar can display Jack assignment counts. */
  @Input() jacksAllocations: Record<string, number> = {};

  getJackCount(charId: string): number {
    return this.jacksAllocations[charId] ?? 0;
  }

  private charService = inject(CharacterService);
  private saveService = inject(SaveService);
  private sub = new Subscription();

  characters: Character[] = [];
  activeId  = 'fighter';
  collapsed = false;
  blandMode = false;

  readonly heroStatsFlavor = HERO_STATS_FLAVOR;

  get unlockedCharacters(): Character[] {
    return this.characters.filter(c => c.unlocked);
  }

  ngOnInit(): void {
    this.sub.add(this.charService.characters$.subscribe(c => (this.characters = c)));
    this.sub.add(this.charService.activeId$.subscribe(id => (this.activeId = id)));
    this.sub.add(this.charService.sidebarCollapsed$.subscribe(v => (this.collapsed = v)));
    this.sub.add(this.saveService.blandMode$.subscribe(v => (this.blandMode = v)));
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
