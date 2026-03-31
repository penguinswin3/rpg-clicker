import { Component, OnInit, OnDestroy, inject, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest } from 'rxjs';
import { CharacterService, Character } from './character.service';
import { WalletService } from '../wallet/wallet.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { GLOBAL_UPGRADE_FLAVOR, CURRENCY_FLAVOR, JACK_FLAVOR } from '../flavor-text';
import { fmtNumber } from '../utils/mathUtils';

@Component({
  selector: 'app-character-unlock',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './character-unlock.component.html',
  styleUrl: './character-unlock.component.scss',
})
export class CharacterUnlockComponent implements OnInit, OnDestroy {
  private charService = inject(CharacterService);
  private wallet      = inject(WalletService);
  private log         = inject(ActivityLogService);
  private sub         = new Subscription();

  // ── Global upgrade inputs ─────────────────
  @Input() minigameUnlockAvailable = false;
  @Input() minigameGoldCost   = 0;
  @Input() minigamePotionCost = 0;
  @Input() minigameBeastCost  = 0;
  @Input() canAffordMinigame  = false;
  @Output() minigameUnlock    = new EventEmitter<void>();

  // ── Jack of All Trades hire inputs ────────
  @Input() jackHireAvailable = false;
  @Input() canAffordJack     = false;
  @Input() jackGoldCost      = 0;
  @Input() jackBeastCost     = 0;
  @Input() jackPotionCost    = 0;
  @Input() jackKoboldEarCost = 0;
  @Input() jackPixieDustCost = 0;
  @Output() jackHire         = new EventEmitter<void>();

  /** Locked characters whose XP requirement has been reached. */
  available: Character[] = [];
  xp = 0;

  readonly globalUpgradeFlavor = GLOBAL_UPGRADE_FLAVOR;
  readonly jackFlavor          = JACK_FLAVOR;
  readonly currencyFlavor      = CURRENCY_FLAVOR;

  fmt(n: number): string { return fmtNumber(n); }

  ngOnInit(): void {
    this.sub.add(
      combineLatest([this.charService.characters$, this.wallet.state$])
        .subscribe(([chars, state]) => {
          this.xp = Math.floor(state['xp']?.amount ?? 0);
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
    return char.unlockCosts.every(cost => this.wallet.canAfford(cost.currencyId, cost.amount));
  }

  buy(char: Character): void {
    if (!this.canAfford(char)) {
      const missing = char.unlockCosts
        .filter(cost => !this.wallet.canAfford(cost.currencyId, cost.amount))
        .map(cost => `${cost.amount} ${this.shorthand(cost.currencyId)}`)
        .join(', ');
      this.log.log(`Can't unlock ${char.name} — still need: ${missing}.`, 'warn');
      return;
    }
    for (const cost of char.unlockCosts) {
      this.wallet.remove(cost.currencyId, cost.amount);
    }
    this.charService.unlock(char.id);
    this.log.log(`${char.name} has been unlocked! Welcome to the party.`, 'rare');
  }

  /** Returns structured cost entries for template rendering with colored symbols. */
  costsFor(char: Character): { amount: number; symbol: string; color: string }[] {
    return char.unlockCosts.map(cost => {
      const c = this.wallet.currencies.find(cu => cu.id === cost.currencyId);
      return { amount: cost.amount, symbol: c?.symbol ?? cost.currencyId, color: c?.color ?? '#fff' };
    });
  }

  private shorthand(currencyId: string): string {
    return this.wallet.currencies.find(c => c.id === currencyId)?.symbol ?? currencyId;
  }
}
