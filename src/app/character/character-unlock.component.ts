import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest } from 'rxjs';
import { CharacterService, Character } from './character.service';
import { WalletService } from '../wallet/wallet.service';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Component({
  selector: 'app-character-unlock',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './character-unlock.component.html',
  styleUrl: './character-unlock.component.scss',
})
export class CharacterUnlockComponent implements OnInit, OnDestroy {
  private charService = inject(CharacterService);
  private wallet     = inject(WalletService);
  private log        = inject(ActivityLogService);
  private sub        = new Subscription();

  /** Locked characters whose XP requirement has been reached. */
  available: Character[] = [];
  gold = 0;
  xp   = 0;

  ngOnInit(): void {
    this.sub.add(
      combineLatest([this.charService.characters$, this.wallet.state$])
        .subscribe(([chars, state]) => {
          this.gold = Math.floor(state['gold']?.amount ?? 0);
          this.xp   = Math.floor(state['xp']?.amount  ?? 0);
          this.available = chars.filter(
            c => !c.unlocked && this.xp >= c.xpRequirement
          );
        })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  canAfford(char: Character): boolean {
    return this.gold >= char.unlockCostGold;
  }

  buy(char: Character): void {
    if (!this.wallet.remove('gold', char.unlockCostGold)) {
      this.log.log(
        `Not enough gold to unlock ${char.name}. Need ${char.unlockCostGold}g, have ${this.gold}g.`,
        'warn'
      );
      return;
    }
    this.charService.unlock(char.id);
    this.log.log(`${char.name} has been unlocked! Welcome to the party.`, 'rare');
  }
}

