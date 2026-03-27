import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { CharacterService, Character } from './character.service';

@Component({
  selector: 'app-character-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './character-sidebar.component.html',
  styleUrl: './character-sidebar.component.scss',
})
export class CharacterSidebarComponent implements OnInit, OnDestroy {
  @Input() goldPerClick = 1;
  @Input() autoGoldPerSecond = 0;

  private charService = inject(CharacterService);
  private sub = new Subscription();

  characters: Character[] = [];
  activeId = 'fighter';
  collapsed = false;

  get unlockedCharacters(): Character[] {
    return this.characters.filter(c => c.unlocked);
  }

  ngOnInit(): void {
    this.sub.add(this.charService.characters$.subscribe(c => (this.characters = c)));
    this.sub.add(this.charService.activeId$.subscribe(id => (this.activeId = id)));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
  }

  setActive(id: string): void {
    this.charService.setActive(id);
  }
}

