import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { RANGER_MG } from '../../game-config';
import { CURRENCY_FLAVOR } from '../../flavor-text';

type PrizeType = 'meat' | 'herb' | 'pixie' | 'blank';

interface GridCell {
  prize: PrizeType;
  revealed: boolean;
}

const PRIZE_SYMBOL: Record<PrizeType, string> = {
  meat:  'M',
  herb:  'H',
  pixie: '*',
  blank: '-',
};

const PRIZE_NAME: Record<PrizeType, string> = {
  meat:  'Raw Meat',
  herb:  'Herb',
  pixie: 'Pixie!',
  blank: 'empty',
};

@Component({
  selector: 'app-ranger-minigame',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ranger-minigame.component.html',
  styleUrls: ['./ranger-minigame.component.scss'],
})
export class RangerMinigameComponent implements OnInit, OnDestroy {
  private wallet = inject(WalletService);
  private log    = inject(ActivityLogService);
  private sub    = new Subscription();

  readonly PICKS      = RANGER_MG.PICKS;
  readonly GRID_SIZE  = RANGER_MG.GRID_SIZE;
  readonly SCOUT_COST = RANGER_MG.SCOUT_COST;
  readonly currencyFlavor = CURRENCY_FLAVOR;

  // Wallet-synced
  beastMeat = 0;

  cells: GridCell[]  = [];
  picksLeft          = this.PICKS;
  roundOver          = false;
  roundStarted       = false;   // false = show idle/cost screen
  firstPixieDone     = false;

  // Round tallies
  meatFound  = 0;
  herbFound  = 0;
  pixieFound = 0;

  lastMsg  = '';
  msgClass = 'msg-neutral';

  get canScout(): boolean {
    return this.beastMeat >= this.SCOUT_COST;
  }

  // ── Lifecycle ─────────────────────────────

  ngOnInit(): void {
    this.sub.add(
      this.wallet.state$.subscribe(s => {
        this.beastMeat = Math.floor(s['beast']?.amount ?? 0);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ── Actions ───────────────────────────────

  select(i: number): void {
    const cell = this.cells[i];
    if (this.roundOver || cell.revealed || this.picksLeft <= 0) return;

    cell.revealed = true;
    this.picksLeft--;
    this.award(cell.prize);

    if (this.picksLeft <= 0) {
      this.endRound();
    }
  }

  newRound(): void {
    if (!this.canScout) return;
    this.wallet.remove('beast', this.SCOUT_COST);
    this.log.log(`Ranger sets out to scout the area. (−${this.SCOUT_COST} Raw Beast Meat)`);

    // Prize cells + blank cells, all shuffled
    const prizeCells = RANGER_MG.GRID_SIZE - RANGER_MG.BLANK_CELLS;
    const pool: GridCell[] = [
      ...Array.from({ length: prizeCells },          () => ({ prize: this.rollPrize(), revealed: false })),
      ...Array.from({ length: RANGER_MG.BLANK_CELLS }, () => ({ prize: 'blank' as PrizeType, revealed: false })),
    ];
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.cells        = pool;
    this.picksLeft    = this.PICKS;
    this.roundOver    = false;
    this.roundStarted = true;
    this.meatFound    = 0;
    this.herbFound    = 0;
    this.pixieFound   = 0;
    this.lastMsg      = `Choose ${this.PICKS} boxes...`;
    this.msgClass     = 'msg-neutral';
  }

  // ── Helpers ───────────────────────────────

  symbol(cell: GridCell): string {
    return cell.revealed ? PRIZE_SYMBOL[cell.prize] : '?';
  }

  subLabel(cell: GridCell): string {
    return cell.revealed ? PRIZE_NAME[cell.prize] : '';
  }

  cellClass(cell: GridCell): string {
    if (!cell.revealed) return '';
    return `prize-${cell.prize}`;
  }

  // ── Private ───────────────────────────────

  private rollPrize(): PrizeType {
    const r = Math.random();
    if (r < RANGER_MG.PIXIE_CHANCE)                          return 'pixie';
    if (r < RANGER_MG.PIXIE_CHANCE + RANGER_MG.HERB_CHANCE) return 'herb';
    return 'meat';
  }

  private award(prize: PrizeType): void {
    switch (prize) {
      case 'meat':
        this.wallet.add('beast', 1);
        this.meatFound++;
        break;

      case 'herb':
        this.wallet.add('herb', 1);
        this.herbFound++;
        break;

      case 'pixie':
        this.wallet.add('pixie-dust', 1);
        this.pixieFound++;
        if (!this.firstPixieDone) {
          this.firstPixieDone = true;
          this.wallet.unlockCurrency('pixie-dust');
          this.log.log('A Pixie emerged from the undergrowth! Pixie Dust unlocked!', 'rare');
        } else {
          this.log.log('A Pixie! +1 Pixie Dust', 'rare');
        }
        break;

      case 'blank':
        // No reward — empty cell
        break;
    }
  }

  private endRound(): void {
    this.roundOver = true;
    // Reveal all unrevealed cells
    this.cells.forEach(c => (c.revealed = true));

    const parts: string[] = [];
    if (this.meatFound  > 0) parts.push(`${this.meatFound}× meat`);
    if (this.herbFound  > 0) parts.push(`${this.herbFound}× herb`);
    if (this.pixieFound > 0) parts.push(`${this.pixieFound}× pixie dust`);

    const summary = parts.length ? parts.join(', ') : 'nothing useful';
    const type = this.pixieFound > 0 ? 'rare' : 'success';

    if (this.pixieFound === 0) {
      this.log.log(`Ranger scouted the area: found ${summary}.`, type);
    }

    this.lastMsg  = `Found: ${summary}`;
    this.msgClass = this.pixieFound > 0 ? 'msg-rare' : 'msg-good';
  }
}

