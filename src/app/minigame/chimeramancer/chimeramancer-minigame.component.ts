import {
  Component, Input, Output, EventEmitter,
  inject, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { CHIMERAMANCER_MG } from '../../game-config';
import { CURRENCY_FLAVOR, LOG_MSG, cur } from '../../flavor-text';

/** Progress state for each resource bar. */
interface ResourceBar {
  currencyId: string;
  displayName: string;
  symbol: string;
  color: string;
  required: number;
  contributed: number;
}

/**
 * ASCII chimera art — rows revealed progressively as overall completion
 * increases.  The chimera is assembled from the bottom up with a touch
 * of randomness so the build feels organic.
 */
const CHIMERA_ART: string[] = [
  '                                             ,--,  ,.-.',
  '               ,                   \\,       \'-,-`,\'-.\' | ._',
  '              /|           \\    ,   |\\         }  )/  / `-,\',',
  '              [ ,          |\\  /|   | |        /  \\|  |/`  ,`',
  '              | |       ,.`  `,` `, | |  _,...(   (      .\',',
  '              \\  \\  __ ,-` `  ,  , `/ |,\'      Y     (   /_L\\',
  '               \\  \\_\\,``,   ` , ,  /  |         )         _,/',
  '                \\  \'  `  ,_ _`_,-,<._.<        /         /',
  '                 \', `>.,`  `  `   ,., |_      |         /',
  '                   \\/`  `,   `   ,`  | /__,.-`    _,   `\\',
  '               -,-..\\  _  \\  `  /  ,  / `._) _,-\\`       \\',
  '                \\_,,.) /\\    ` /  / ) (-,, ``    ,        |',
  '               ,` )  | \\_\\       \'-`  |  `(               \\',
  '              /  /```(   , --, ,\' \\   |`<`    ,            |',
  '             /  /_,--`\\   <\\  V /> ,` )<_/)  | \\      _____)',
  '       ,-, ,`   `   (_,\\ \\    |   /) / __/  /   `----`',
  '      (-, \\           ) \\ (\'_.-._)/ /,`    /',
  '      | /  `          `/ \\\\ V   V, /`     /',
  '   ,--\\(        ,     <_/`\\\\     ||      /',
  '  (   ,``-     \\/|         \\-A.A-`|     /',
  ' ,>,_ )_,..(    )\\          -,,_-`  _--`',
  '(_ \\|`   _,/_  /  \\_            ,--`',
  ' \\( `   <.,../`     `-.._   _,-`',
];

/**
 * Reveal order — indices into CHIMERA_ART.
 * Generally bottom-to-top with occasional swaps so the construction
 * feels slightly unpredictable.
 */
const REVEAL_ORDER: number[] = [
  22, 21, 20, 19, 17, 18, 16, 14, 15, 12, 13, 11,
   9, 10,  7,  8,  5,  6,  4,  2,  3,  1,  0,
];

@Component({
  selector: 'app-chimeramancer-minigame',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chimeramancer-minigame.component.html',
  styleUrls: ['./chimeramancer-minigame.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChimeramancerMinigameComponent implements OnInit, OnDestroy {
  private wallet = inject(WalletService);
  private log    = inject(ActivityLogService);
  private stats  = inject(StatisticsService);
  private cdr    = inject(ChangeDetectorRef);
  private sub    = new Subscription();

  // ── Standard bead / auto-solve inputs ────────────────────────
  @Input() autoSolveUnlocked = false;
  @Input() autoSolveEnabled  = false;
  @Input() autoSolveGoodMode = false;
  @Output() autoSolveEnabledChange = new EventEmitter<boolean>();
  @Output() goldBeadFound = new EventEmitter<void>();
  @Input() gold2Progress: unknown;
  @Output() gold2ProgressChange = new EventEmitter<unknown>();
  @Output() gold2BeadFound = new EventEmitter<void>();
  @Input() gemHunterLevel = 0;
  @Input() gold2BeadAlreadyFound = false;

  /** Persisted contribution state from save. */
  @Input() savedContributions: Record<string, number> | null = null;
  /** Emitted whenever contribution state changes (for save). */
  @Output() contributionsChange = new EventEmitter<Record<string, number>>();

  /** Resource bars derived from config. */
  bars: ResourceBar[] = [];

  /** Whether the chimera has been fully assembled. */
  chimeraAwakened = false;

  /**
   * Overall completion fraction 0–1.
   * Each bar contributes equally (1 / numBars) to the total,
   * regardless of how many resources it requires to fill.
   */
  get overallProgress(): number {
    if (this.bars.length === 0) return 0;
    const perBar = 1 / this.bars.length;
    return this.bars.reduce(
      (sum, b) => sum + Math.min(b.contributed / b.required, 1) * perBar,
      0,
    );
  }

  /** How many lines from REVEAL_ORDER have been uncovered. */
  get revealedCount(): number {
    return Math.floor(this.overallProgress * CHIMERA_ART.length);
  }

  /** Set of line indices currently visible. */
  private get _revealedSet(): Set<number> {
    const set = new Set<number>();
    const count = this.revealedCount;
    for (let i = 0; i < count && i < REVEAL_ORDER.length; i++) {
      set.add(REVEAL_ORDER[i]);
    }
    return set;
  }

  /**
   * The visible ASCII art lines.
   * Revealed lines show the art; unrevealed lines are completely blank
   * so nothing hints at the final shape.
   */
  get chimeraLines(): string[] {
    const revealed = this._revealedSet;
    return CHIMERA_ART.map((line, i) =>
      revealed.has(i) ? line : ' '.repeat(line.length)
    );
  }

  /** Bar fill % for a single resource. */
  barPercent(bar: ResourceBar): number {
    return Math.min(100, (bar.contributed / bar.required) * 100);
  }

  /** Whether a bar is full. */
  barComplete(bar: ResourceBar): boolean {
    return bar.contributed >= bar.required;
  }

  /** Whether the player can afford to contribute to this bar. */
  canContribute(bar: ResourceBar): boolean {
    if (this.chimeraAwakened) return false;
    if (bar.contributed >= bar.required) return false;
    return this.wallet.canAfford(bar.currencyId, CHIMERAMANCER_MG.CONTRIBUTE_AMOUNT);
  }

  /** Format a number compactly (e.g. 500000 → 500k). */
  shortNum(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 10_000)    return (n / 1_000).toFixed(0) + 'k';
    if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    return n.toString();
  }

  /** Contribute one unit of a resource to the chimera. */
  contribute(bar: ResourceBar): void {
    if (!this.canContribute(bar)) return;
    const amount = CHIMERAMANCER_MG.CONTRIBUTE_AMOUNT;
    this.wallet.remove(bar.currencyId, amount);
    bar.contributed += amount;
    this.stats.trackCurrencyGain('life-thread', 0); // track activity

    this.log.log(LOG_MSG.MG_CHIMERAMANCER.CONTRIBUTE(cur(bar.currencyId, amount, '')));

    this._emitState();
    this._checkCompletion();
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    // Build bars from config
    this.bars = CHIMERAMANCER_MG.RESOURCE_REQUIREMENTS.map((req: { currencyId: string; required: number }) => {
      const flavor = (CURRENCY_FLAVOR as Record<string, any>)[req.currencyId];
      return {
        currencyId:  req.currencyId,
        displayName: flavor?.name ?? req.currencyId,
        symbol:      flavor?.symbol ?? '?',
        color:       flavor?.color ?? '#aaa',
        required:    req.required,
        contributed: 0,
      };
    });

    // Restore saved state
    if (this.savedContributions) {
      for (const bar of this.bars) {
        bar.contributed = this.savedContributions[bar.currencyId] ?? 0;
      }
      this._checkCompletion();
    }

    // Re-check afford state when wallet changes
    this.sub.add(this.wallet.state$.subscribe(() => this.cdr.markForCheck()));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private _emitState(): void {
    const state: Record<string, number> = {};
    for (const bar of this.bars) {
      state[bar.currencyId] = bar.contributed;
    }
    this.contributionsChange.emit(state);
  }

  private _checkCompletion(): void {
    if (this.chimeraAwakened) return;
    const allFull = this.bars.every(b => b.contributed >= b.required);
    if (allFull) {
      this.chimeraAwakened = true;
      this.log.log(LOG_MSG.MG_CHIMERAMANCER.CHIMERA_AWAKEN, 'rare');
      this.stats.recordMilestone('chimera_awaken', 'The Chimera Awakens!');
    }
  }
}



