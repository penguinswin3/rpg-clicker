import { Component, Input, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { RANGER_MG } from '../../game-config';
import { CURRENCY_FLAVOR, MINIGAME_MSG, cur } from '../../flavor-text';
import { shuffleInPlace, randInt } from '../../utils/mathUtils';

type PrizeType = 'meat' | 'herb' | 'pixie' | 'chest' | 'blank';

interface GridCell {
  prize: PrizeType;
  revealed: boolean;
}

const PRIZE_SYMBOL: Record<PrizeType, string> = {
  meat:  CURRENCY_FLAVOR['beast'].symbol,
  herb:  CURRENCY_FLAVOR['herb'].symbol,
  pixie: CURRENCY_FLAVOR['pixie-dust'].symbol,
  chest: CURRENCY_FLAVOR['treasure'].symbol,
  blank: '-',
};

const PRIZE_COLOR: Record<PrizeType, string> = {
  meat:  CURRENCY_FLAVOR['beast'].color,
  herb:  CURRENCY_FLAVOR['herb'].color,
  pixie: CURRENCY_FLAVOR['pixie-dust'].color,
  chest: CURRENCY_FLAVOR['treasure'].color,
  blank: '#555',
};

const PRIZE_NAME: Record<PrizeType, string> = {
  meat:  'Raw Meat',
  herb:  'Herb',
  pixie: 'Pixie!',
  chest: 'Chest!',
  blank: 'empty',
};

@Component({
  selector: 'app-ranger-minigame',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ranger-minigame.component.html',
  styleUrls: ['./ranger-minigame.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RangerMinigameComponent implements OnInit, OnDestroy {
  private wallet = inject(WalletService);
  private log    = inject(ActivityLogService);
  private stats  = inject(StatisticsService);
  private cdr    = inject(ChangeDetectorRef);
  private sub    = new Subscription();

  readonly PICKS      = RANGER_MG.PICKS;
  readonly GRID_SIZE  = RANGER_MG.GRID_SIZE;
  readonly SCOUT_COST = RANGER_MG.SCOUT_COST;
  readonly currencyFlavor = CURRENCY_FLAVOR;

  /** Each level = +1% chance a blank cell is converted to a prize cell (max 100%). */
  @Input() bountifulLandsLevel = 0;
  /** When >= 1 the total currency yield is multiplied by the number of successful squares. */
  @Input() abundantLandsLevel = 0;
  /** When >= 1 a subtle sparkle animates on any hidden cell containing a pixie. */
  @Input() fairyHostageLevel = 0;
  /** Each level = +2% chance for a treasure chest, stealing from herb & meat chance. */
  @Input() treasureChestLevel = 0;

  // Wallet-synced
  beastMeat = 0;

  cells: GridCell[]  = [];
  picksLeft          = this.PICKS;
  roundOver          = false;
  roundStarted       = false;   // false = show idle/cost screen

  /** Indices of cells that contain a pixie — used by Fairy Hostage sparkle hint. */
  pixieCellIndices = new Set<number>();

  // Round tallies
  meatFound  = 0;
  herbFound  = 0;
  pixieFound = 0;
  chestFound = 0;
  xpGained   = 0;

  // Chest reward tracking
  chestGold     = 0;
  chestTreasure = 0;
  chestGems     = 0;

  // Result display
  resultParts: Array<{ amount: number; symbol: string; color: string }> = [];
  resultMultiplier = 1;
  resultXp = 0;

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
        this.cdr.markForCheck();
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

  /**
   * Unified cell click handler.
   * - During an active round: reveal the cell (delegates to select).
   * - After the round is over: clicking any cell restarts (delegates to newRound).
   */
  cellClick(i: number): void {
    if (this.roundOver) {
      this.newRound();
    } else {
      this.select(i);
    }
  }

  newRound(): void {
    if (!this.canScout) return;
    this.wallet.remove('beast', this.SCOUT_COST);
    this.log.log(`Ranger sets out to scout the area. (${cur('beast', this.SCOUT_COST, '-')})`);

    // Prize cells + blank cells, all shuffled.
    // Bountiful Lands: each level adds +1 guaranteed prize node (up to all blanks converted).
    const basePrize  = RANGER_MG.GRID_SIZE - RANGER_MG.BLANK_CELLS;
    const extraPrize = Math.min(this.bountifulLandsLevel, RANGER_MG.BLANK_CELLS);
    const totalPrize = basePrize + extraPrize;
    const totalBlank = RANGER_MG.GRID_SIZE - totalPrize;
    const pool: GridCell[] = [
      ...Array.from({ length: totalPrize }, () => ({ prize: this.rollPrize(), revealed: false })),
      ...Array.from({ length: totalBlank }, () => ({ prize: 'blank' as PrizeType, revealed: false })),
    ];
    shuffleInPlace(pool);
    this.cells            = pool;
    this.picksLeft        = this.PICKS;
    this.roundOver        = false;
    this.roundStarted     = true;
    this.meatFound        = 0;
    this.herbFound        = 0;
    this.pixieFound       = 0;
    this.chestFound       = 0;
    this.xpGained         = 0;
    this.chestGold        = 0;
    this.chestTreasure    = 0;
    this.chestGems        = 0;
    this.resultParts      = [];
    this.resultMultiplier = 1;
    this.resultXp         = 0;
    this.lastMsg          = MINIGAME_MSG.RANGER.ROUND_START(this.PICKS);
    this.msgClass         = 'msg-neutral';

    // Track one random pixie cell for the Fairy Hostage sparkle hint
    this.pixieCellIndices.clear();
    const pixieIndices = pool.reduce<number[]>((acc, c, i) => { if (c.prize === 'pixie') acc.push(i); return acc; }, []);
    if (pixieIndices.length > 0) {
      this.pixieCellIndices.add(pixieIndices[Math.floor(Math.random() * pixieIndices.length)]);
    }
  }

  // ── Helpers ───────────────────────────────

  symbol(cell: GridCell): string {
    return cell.revealed ? PRIZE_SYMBOL[cell.prize] : '?';
  }

  symbolColor(cell: GridCell): string {
    return cell.revealed ? PRIZE_COLOR[cell.prize] : '#888';
  }

  subLabel(cell: GridCell): string {
    return cell.revealed ? PRIZE_NAME[cell.prize] : '';
  }

  cellClass(cell: GridCell): string {
    if (!cell.revealed) return '';
    return `prize-${cell.prize}`;
  }

  /** Returns true when Fairy Hostage is active and this cell is a hidden pixie cell. */
  hasFairyHint(i: number, cell: GridCell): boolean {
    return this.fairyHostageLevel >= 1 && !cell.revealed && this.pixieCellIndices.has(i);
  }

  // ── Private ───────────────────────────────

  private rollPrize(): PrizeType {
    const r = Math.random();
    const chestChance = this.treasureChestLevel * (RANGER_MG.CHEST_CHANCE_PER_LEVEL / 100);
    const pixieChance = RANGER_MG.PIXIE_CHANCE;
    const herbChance  = RANGER_MG.HERB_CHANCE - this.treasureChestLevel * (RANGER_MG.CHEST_HERB_REDUCTION_PER_LEVEL / 100);
    // Remaining = meat (with reduction)

    if (r < pixieChance)                              return 'pixie';
    if (r < pixieChance + chestChance)                return 'chest';
    if (r < pixieChance + chestChance + herbChance)   return 'herb';
    return 'meat';
  }

  private award(prize: PrizeType): void {
    switch (prize) {
      case 'meat':
        // Currency deferred to endRound for Abundant Lands multiplier
        this.wallet.add('xp', RANGER_MG.MEAT_XP);
        this.meatFound++;
        this.xpGained += RANGER_MG.MEAT_XP;
        break;

      case 'herb':
        // Currency deferred to endRound for Abundant Lands multiplier
        this.wallet.add('xp', RANGER_MG.HERB_XP);
        this.herbFound++;
        this.xpGained += RANGER_MG.HERB_XP;
        break;

      case 'pixie':
        // Currency deferred to endRound for Abundant Lands multiplier
        this.wallet.add('xp', RANGER_MG.PIXIE_XP);
        this.pixieFound++;
        this.xpGained += RANGER_MG.PIXIE_XP;
        if (!this.wallet.isCurrencyUnlocked('pixie-dust')) {
          this.wallet.unlockCurrency('pixie-dust');
          this.log.log('A Pixie emerged from the undergrowth! Pixie Dust unlocked!', 'rare');
        }
        break;

      case 'chest':
        // Gold, treasure, gems deferred to endRound for Abundant Lands multiplier
        this.wallet.add('xp', RANGER_MG.CHEST_XP);
        this.chestFound++;
        this.xpGained += RANGER_MG.CHEST_XP;
        // Track individual chest rewards for batching
        this.chestGold     += randInt(RANGER_MG.CHEST_GOLD_MIN, RANGER_MG.CHEST_GOLD_MAX);
        this.chestTreasure += randInt(RANGER_MG.CHEST_TREASURE_MIN, RANGER_MG.CHEST_TREASURE_MAX);
        this.chestGems     += randInt(RANGER_MG.CHEST_GEM_MIN, RANGER_MG.CHEST_GEM_MAX);
        if (!this.wallet.isCurrencyUnlocked('treasure')) {
          this.wallet.unlockCurrency('treasure');
          this.log.log('A treasure chest! Treasure unlocked!', 'rare');
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

    // Abundant Lands: multiply currency by the number of successful squares found
    const successCount = this.meatFound + this.herbFound + this.pixieFound + this.chestFound;
    const multiplier   = (this.abundantLandsLevel >= 1 && successCount > 0)
      ? successCount
      : 1;

    // Batch-award all currencies now (with multiplier applied)
    const totalMeat  = this.meatFound  * multiplier;
    const totalHerb  = this.herbFound  * multiplier;
    const totalPixie = this.pixieFound * multiplier;
    const totalChestGold     = this.chestGold     * multiplier;
    const totalChestTreasure = this.chestTreasure  * multiplier;
    const totalChestGems     = this.chestGems      * multiplier;

    if (totalMeat  > 0) this.wallet.add('beast',      totalMeat);
    if (totalHerb  > 0) this.wallet.add('herb',        totalHerb);
    if (totalPixie > 0) this.wallet.add('pixie-dust',  totalPixie);
    if (totalChestGold > 0)     this.wallet.add('gold',     totalChestGold);
    if (totalChestTreasure > 0) this.wallet.add('treasure', totalChestTreasure);
    if (totalChestGems > 0)     this.wallet.add('gemstone', totalChestGems);

    // Track stats
    this.stats.trackRangerHunt(successCount > 0);
    if (totalMeat  > 0) this.stats.trackCurrencyGain('beast', totalMeat);
    if (totalHerb  > 0) this.stats.trackCurrencyGain('herb', totalHerb);
    if (totalPixie > 0) this.stats.trackCurrencyGain('pixie-dust', totalPixie);
    if (totalChestGold > 0)     this.stats.trackCurrencyGain('gold', totalChestGold);
    if (totalChestTreasure > 0) this.stats.trackCurrencyGain('treasure', totalChestTreasure);
    if (totalChestGems > 0)     this.stats.trackCurrencyGain('gemstone', totalChestGems);
    if (this.xpGained > 0) this.stats.trackCurrencyGain('xp', this.xpGained);

    // Build result parts for display with colors
    this.resultParts = [];
    if (totalMeat  > 0) this.resultParts.push({ amount: totalMeat,  symbol: CURRENCY_FLAVOR['beast'].symbol,       color: CURRENCY_FLAVOR['beast'].color });
    if (totalHerb  > 0) this.resultParts.push({ amount: totalHerb,  symbol: CURRENCY_FLAVOR['herb'].symbol,        color: CURRENCY_FLAVOR['herb'].color });
    if (totalPixie > 0) this.resultParts.push({ amount: totalPixie, symbol: CURRENCY_FLAVOR['pixie-dust'].symbol,  color: CURRENCY_FLAVOR['pixie-dust'].color });
    if (totalChestGold > 0)     this.resultParts.push({ amount: totalChestGold,     symbol: CURRENCY_FLAVOR['gold'].symbol,     color: CURRENCY_FLAVOR['gold'].color });
    if (totalChestTreasure > 0) this.resultParts.push({ amount: totalChestTreasure, symbol: CURRENCY_FLAVOR['treasure'].symbol, color: CURRENCY_FLAVOR['treasure'].color });
    if (totalChestGems > 0)     this.resultParts.push({ amount: totalChestGems,     symbol: CURRENCY_FLAVOR['gemstone'].symbol, color: CURRENCY_FLAVOR['gemstone'].color });

    this.resultMultiplier = multiplier;
    this.resultXp = this.xpGained;

    // Build log message with colored currency tokens
    const parts: string[] = [];
    if (totalMeat  > 0) parts.push(cur('beast', totalMeat));
    if (totalHerb  > 0) parts.push(cur('herb', totalHerb));
    if (totalPixie > 0) parts.push(cur('pixie-dust', totalPixie));
    if (totalChestGold > 0)     parts.push(cur('gold', totalChestGold));
    if (totalChestTreasure > 0) parts.push(cur('treasure', totalChestTreasure));
    if (totalChestGems > 0)     parts.push(cur('gemstone', totalChestGems));
    if (this.xpGained > 0) parts.push(cur('xp', this.xpGained));

    const multiplierStr = multiplier > 1 ? ` [×${multiplier} Abundant Lands]` : '';
    const type: 'default' | 'success' = (this.pixieFound > 0 || this.chestFound > 0) ? 'success' : 'default';

    if (parts.length > 0) {
      this.log.log(`Ranger scouted the area. (${parts.join(', ')})${multiplierStr}`, type);
    } else {
      this.log.log(`Ranger scouted the area: found nothing useful.`);
    }

    this.lastMsg  = successCount === 0 ? 'Found: Nothing...' : 'Found:';
    this.msgClass = successCount === 0 ? 'msg-neutral' : (this.pixieFound > 0 || this.chestFound > 0 ? 'msg-rare' : 'msg-good');
  }
}

