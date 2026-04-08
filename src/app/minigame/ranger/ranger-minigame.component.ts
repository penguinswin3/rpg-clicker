import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { RANGER_MG, AUTO_SOLVE, BEADS, GOLD2_CONDITIONS } from '../../game-config';
import { CURRENCY_FLAVOR, MINIGAME_MSG, cur, GOLD2_STEP_MESSAGES } from '../../flavor-text';
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
export class RangerMinigameComponent implements OnInit, OnDestroy, OnChanges {
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
  /** When >= 1, unrevealed chest cells display a red X. */
  @Input() xMarksTheSpotLevel = 0;

  // ── Auto-solve ──────────────────────────
  @Input() autoSolveUnlocked = false;
  @Input() autoSolveEnabled = false;
  @Input() autoSolveGoodMode = false;
  @Output() autoSolveEnabledChange = new EventEmitter<boolean>();
  @Output() goldBeadFound = new EventEmitter<void>();
  private autoSolveInterval?: ReturnType<typeof setInterval>;
  /** Pre-selected random indices for auto-solve to pick (3 cells). */
  private autoSolveTargets: number[] = [];

  // ── Gold-2 bead tracking ─────────────────
  @Input() gold2Progress: unknown;
  @Output() gold2ProgressChange = new EventEmitter<unknown>();
  @Output() gold2BeadFound = new EventEmitter<void>();
  private gold2Awarded = false;
  /** Level of the Gem Hunter upgrade — enables gold-2 log progress messages. */
  @Input() gemHunterLevel = 0;
  /** Whether the gold-2 bead has already been found for this character (suppresses log messages). */
  @Input() gold2BeadAlreadyFound = false;
  /** Tracks the cells clicked in the current round, in order. */
  private currentRoundClicks: number[] = [];

  toggleAutoSolve(): void {
    this.autoSolveEnabledChange.emit(!this.autoSolveEnabled);
  }

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['autoSolveEnabled'] || changes['autoSolveGoodMode']) {
      if (this.autoSolveEnabled && this.autoSolveUnlocked) {
        this.startAutoSolve();
      } else {
        this.stopAutoSolve();
      }
    }
  }

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
    this.stopAutoSolve();
  }

  // ── Actions ───────────────────────────────

  select(i: number): void {
    const cell = this.cells[i];
    if (this.roundOver || cell.revealed || this.picksLeft <= 0) return;

    cell.revealed = true;
    this.picksLeft--;
    this.award(cell.prize);

    // Track click order for gold-2
    if (!this.autoSolveEnabled && !this.gold2Awarded) {
      this.currentRoundClicks.push(i);
    }

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
    // Reset current round click tracking for gold-2
    this.currentRoundClicks = [];

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

  /** Returns true when X Marks the Spot is active and this cell hides a treasure chest. */
  hasXMark(cell: GridCell): boolean {
    return this.xMarksTheSpotLevel >= 1 && !cell.revealed && cell.prize === 'chest';
  }

  // ── Auto-solve helpers ──────────────────

  private startAutoSolve(): void {
    this.stopAutoSolve();
    this.autoSolveInterval = setInterval(() => this.autoSolveTick(), AUTO_SOLVE.RANGER_TICK_MS);
  }

  private stopAutoSolve(): void {
    if (this.autoSolveInterval) {
      clearInterval(this.autoSolveInterval);
      this.autoSolveInterval = undefined;
    }
  }

  private autoSolveTick(): void {
    if (!this.autoSolveEnabled || !this.autoSolveUnlocked) {
      this.stopAutoSolve();
      return;
    }
    // If round is over or not started, start a new round
    if (!this.roundStarted || this.roundOver) {
      if (this.canScout) {
        this.newRound();
        if (this.autoSolveGoodMode) {
          // Good auto-solve: prioritize pixie cells, then X-mark (chest) cells, then random
          this.autoSolveTargets = this.buildGoodAutoSolveTargets();
        } else {
          // Pre-select 3 random cell indices to reveal
          const indices = Array.from({ length: this.cells.length }, (_, i) => i);
          shuffleInPlace(indices);
          this.autoSolveTargets = indices.slice(0, this.PICKS);
        }
      }
      this.cdr.markForCheck();
      return;
    }
    // If round is active but no targets queued (enabled mid-round), build targets now
    if (this.picksLeft > 0 && this.autoSolveTargets.length === 0) {
      if (this.autoSolveGoodMode) {
        this.autoSolveTargets = this.buildGoodAutoSolveTargets();
      } else {
        const indices = this.cells
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => !c.revealed)
          .map(({ i }) => i);
        shuffleInPlace(indices);
        this.autoSolveTargets = indices.slice(0, this.picksLeft);
      }
    }
    // If round is active, pick the next auto-solve target
    if (this.picksLeft > 0 && this.autoSolveTargets.length > 0) {
      const idx = this.autoSolveTargets.shift()!;
      if (!this.cells[idx].revealed) {
        this.select(idx);
      }
      this.cdr.markForCheck();
    }
  }

  /**
   * Good auto-solve target selection: pick pixie cells first (if Fairy Hostage unlocked),
   * then up to two X-mark (chest) cells (if X Marks the Spot unlocked), then random.
   */
  private buildGoodAutoSolveTargets(): number[] {
    const targets: number[] = [];
    const remaining = new Set(Array.from({ length: this.cells.length }, (_, i) => i));

    // 1) Pick revealed pixie hint cell (Fairy Hostage)
    if (this.fairyHostageLevel >= 1) {
      for (const idx of this.pixieCellIndices) {
        if (!this.cells[idx].revealed && targets.length < this.PICKS) {
          targets.push(idx);
          remaining.delete(idx);
        }
      }
    }

    // 2) Pick up to 2 X-mark (chest) cells
    if (this.xMarksTheSpotLevel >= 1) {
      let chestPicks = 0;
      for (const idx of remaining) {
        if (chestPicks >= 2 || targets.length >= this.PICKS) break;
        if (this.cells[idx].prize === 'chest' && !this.cells[idx].revealed) {
          targets.push(idx);
          remaining.delete(idx);
          chestPicks++;
        }
      }
    }

    // 3) Fill remaining picks randomly
    const leftover = Array.from(remaining);
    shuffleInPlace(leftover);
    for (const idx of leftover) {
      if (targets.length >= this.PICKS) break;
      if (!this.cells[idx].revealed) {
        targets.push(idx);
      }
    }

    return targets;
  }

  private rollMinigameGoldBead(): void {
    if (this.stats.getManualSidequestClears('ranger') < BEADS.GOLD_BEAD_MIN_MANUAL_CLEARS) return;
    if (Math.random() < BEADS.MINIGAME_GOLD_BEAD_CHANCE) {
      this.goldBeadFound.emit();
    }
  }

  // ── Private ───────────────────────────

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
    const bm = this.wallet.getBeadMultiplier('ranger');
    switch (prize) {
      case 'meat':
        // Currency deferred to endRound for Abundant Lands multiplier
        this.wallet.add('xp', RANGER_MG.MEAT_XP * bm);
        this.meatFound++;
        this.xpGained += RANGER_MG.MEAT_XP * bm;
        break;

      case 'herb':
        // Currency deferred to endRound for Abundant Lands multiplier
        this.wallet.add('xp', RANGER_MG.HERB_XP * bm);
        this.herbFound++;
        this.xpGained += RANGER_MG.HERB_XP * bm;
        break;

      case 'pixie':
        // Currency deferred to endRound for Abundant Lands multiplier
        this.wallet.add('xp', RANGER_MG.PIXIE_XP * bm);
        this.pixieFound++;
        this.xpGained += RANGER_MG.PIXIE_XP * bm;
        if (!this.wallet.isCurrencyUnlocked('pixie-dust')) {
          this.wallet.unlockCurrency('pixie-dust');
          this.log.log('A Pixie emerged from the undergrowth! Pixie Dust unlocked!', 'rare');
        }
        break;

      case 'chest':
        // Gold, treasure, gems deferred to endRound for Abundant Lands multiplier
        this.wallet.add('xp', RANGER_MG.CHEST_XP * bm);
        this.chestFound++;
        this.xpGained += RANGER_MG.CHEST_XP * bm;
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
    // ── Gold-2 tracking after round completes ──
    if (!this.autoSolveEnabled && !this.gold2Awarded) {
      this.trackGold2Round();
    }

    // Reveal all unrevealed cells
    this.cells.forEach(c => (c.revealed = true));

    // Bead multiplier for ranger character
    const bm = this.wallet.getBeadMultiplier('ranger');

    // Abundant Lands: multiply currency by the number of successful squares found
    const successCount = this.meatFound + this.herbFound + this.pixieFound + this.chestFound;
    const multiplier   = (this.abundantLandsLevel >= 1 && successCount > 0)
      ? successCount
      : 1;

    // Batch-award all currencies now (with multiplier and bead multiplier applied)
    const totalMeat  = this.meatFound  * multiplier * bm;
    const totalHerb  = this.herbFound  * multiplier * bm;
    const totalPixie = this.pixieFound * multiplier * bm;
    const totalChestGold     = this.chestGold     * multiplier * bm;
    const totalChestTreasure = this.chestTreasure  * multiplier * bm;
    const totalChestGems     = this.chestGems      * multiplier * bm;

    if (totalMeat  > 0) this.wallet.add('beast',      totalMeat);
    if (totalHerb  > 0) this.wallet.add('herb',        totalHerb);
    if (totalPixie > 0) this.wallet.add('pixie-dust',  totalPixie);
    if (totalChestGold > 0)     this.wallet.add('gold',     totalChestGold);
    if (totalChestTreasure > 0) this.wallet.add('treasure', totalChestTreasure);
    if (totalChestGems > 0)     this.wallet.add('gemstone', totalChestGems);

    // Track stats
    this.stats.trackRangerHunt(successCount > 0);
    if (this.chestFound > 0) this.stats.trackRangerTreasureChest(this.chestFound);
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
      this.log.log(`${multiplierStr} Ranger scouted the area. (${parts.join(', ')})`, type);
    } else {
      this.log.log(`Ranger scouted the area: found nothing useful.`);
    }

    this.lastMsg  = successCount === 0 ? 'Found: Nothing...' : 'Found:';
    this.msgClass = successCount === 0 ? 'msg-neutral' : (this.pixieFound > 0 || this.chestFound > 0 ? 'msg-rare' : 'msg-good');

    // Roll for gold bead on successful round
    if (successCount > 0) {
      if (!this.autoSolveEnabled) {
        this.stats.trackManualSidequestClear('ranger');
      }
      this.rollMinigameGoldBead();
    }
  }

  // ── Gold-2 helpers ─────────────────────

  /**
   * Track the completed round's click pattern for gold-2 unlock.
   * Pattern must match across 5 consecutive games.
   */
  private trackGold2Round(): void {
    const progress = (this.gold2Progress as { step?: number }) ?? {};
    let step = progress.step ?? 0;
    const patterns = GOLD2_CONDITIONS.RANGER_CLICK_PATTERNS;
    if (step >= patterns.length) {
      // Already completed or out of bounds — reset
      this.gold2ProgressChange.emit({ step: 0 });
      return;
    }

    const expected = patterns[step];
    const clicks = this.currentRoundClicks;

    // Check if the clicks match the expected pattern (same elements in same order)
    if (clicks.length === expected.length && clicks.every((c, i) => c === expected[i])) {
      step++;
      if (step >= patterns.length) {
        // All 5 games completed — award the bead!
        this.gold2Awarded = true;
        this.gold2BeadFound.emit();
        this.gold2ProgressChange.emit({ step: 0 });
      } else {
        if (this.gemHunterLevel >= 1 && !this.gold2BeadAlreadyFound) {
          const msgs = GOLD2_STEP_MESSAGES['ranger'];
          this.log.log(msgs[(step - 1) % msgs.length], 'rare');
        }
        this.gold2ProgressChange.emit({ step });
      }
    } else {
      // Mismatch — reset, but check if this round matches step 0
      const first = patterns[0];
      if (clicks.length === first.length && clicks.every((c, i) => c === first[i])) {
        if (this.gemHunterLevel >= 1 && !this.gold2BeadAlreadyFound) this.log.log(GOLD2_STEP_MESSAGES['ranger'][0], 'rare');
        this.gold2ProgressChange.emit({ step: 1 });
      } else {
        this.gold2ProgressChange.emit({ step: 0 });
      }
    }
  }
}
