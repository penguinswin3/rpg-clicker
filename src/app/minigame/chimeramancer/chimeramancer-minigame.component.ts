import {
  Component, Input, Output, EventEmitter,
  inject, OnInit, OnChanges, OnDestroy, SimpleChanges,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { CHIMERAMANCER_MG, AUTO_SOLVE, BEADS, GOLD2_CONDITIONS } from '../../game-config';
import { CURRENCY_FLAVOR, LOG_MSG, cur, GOLD2_STEP_MESSAGES } from '../../flavor-text';

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
 * ASCII Slayer art — displayed in precious-metal silver to the left of the
 * Chimera once the Slayer character is unlocked.
 */
const SLAYER_ART: string[] = [

  '                   _.--.    .--._',
  '                 ."  ."      ".  ".',
  '                ;  ."    /\\    ".  ;',
  '                ;  \'._,-/  \\-,`.  ;',
  '                \\  ,`  / /\\ \\  `,  /',
  '                 \\/    \\/  \\/    \\/',
  '                 ,=_    \\/\\/    _=,',
  '                 |  "_   \\/   _"  |',
  '                 |_   \'\"-..-\"\'   _|',
  '                 | "-.        .-" |',
  '                 |    "\\    /"    |',
  '                 |      |  |      |',
  '         ___     |      |  |      |     ___',
  '     _,-",  ",   \'_     |  |     _\'   ,"  ,"-,_',
  '   _(  \\  \\   \\"=--"-.  |  |  .-"--="/   /  /  )_',
  ' ,"  \\  \\  \\   \\      "-\'--\'-"      /   /  /  /  ".',
  '!     \\  \\  \\   \\                  /   /  /  /     !',
  ':      \\  \\  \\   \\                /   /  /  /      :',
];

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
export class ChimeramancerMinigameComponent implements OnInit, OnChanges, OnDestroy {
  private wallet = inject(WalletService);
  private log    = inject(ActivityLogService);
  private stats  = inject(StatisticsService);
  private cdr    = inject(ChangeDetectorRef);
  private sub    = new Subscription();

  // ── Slayer art ────────────────────────────────────────────────
  /** When true, displays the Slayer ASCII art to the left of the Chimera. */
  @Input() slayerUnlocked = false;
  readonly slayerArt = SLAYER_ART;

  // ── Standard bead / auto-solve inputs ────────────────────────
  @Input() autoSolveUnlocked = false;
  @Input() autoSolveEnabled  = false;
  @Input() autoSolveGoodMode = false;
  @Input() isActiveTab = true;
  @Input() gold1Socketed = false;
  @Output() autoSolveEnabledChange = new EventEmitter<boolean>();
  @Output() goldBeadFound = new EventEmitter<void>();
  @Input() gold2Progress: unknown;
  @Output() gold2ProgressChange = new EventEmitter<unknown>();
  @Output() gold2BeadFound = new EventEmitter<void>();
  @Input() gemHunterLevel = 0;
  @Input() gold2BeadAlreadyFound = false;

  // ── Sidequest upgrade inputs ──────────────────────────────────
  /** Quick Stitching: each level doubles the resources applied per click. */
  @Input() quickStitchingLevel = 0;
  /** Minor Touch Up: 10% chance per level to apply (level) resources to another random bar. */
  @Input() minorTouchUpLevel = 0;

  /** Persisted contribution state from save. */
  @Input() savedContributions: Record<string, number> | null = null;
  /** Emitted whenever contribution state changes (for save). */
  @Output() contributionsChange = new EventEmitter<Record<string, number>>();

  /** Emitted when the chimera is 100% complete — triggers the Slayer endgame. */
  @Output() chimeraCompleted = new EventEmitter<void>();

  /** Resource bars derived from config. */
  bars: ResourceBar[] = [];

  /** Whether the chimera has been fully assembled. */
  chimeraAwakened = false;

  /** Manual contribution count — used for gold-1 bead drop chance. */
  private manualContributions = 0;

  /** Current step in the ordered-click gold-2 sequence (0 = expecting bar[0]). */
  private gold2Step = 0;

  /** Auto-stitch interval handle. */
  private autoStitchTimer: ReturnType<typeof setInterval> | null = null;
  /** Hold-to-contribute interval handle. */
  private holdTimer: ReturnType<typeof setInterval> | null = null;

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

  /** Resources applied per click (Quick Stitching doubles per level). */
  get contributeAmount(): number {
    return CHIMERAMANCER_MG.CONTRIBUTE_AMOUNT * Math.pow(2, this.quickStitchingLevel);
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
    // Good mode (both gold beads): always free — no wallet check needed.
    if (this.autoSolveGoodMode) return true;
    // Only need to afford the remaining gap (may be less than full contributeAmount).
    const needed = Math.min(this.contributeAmount, bar.required - bar.contributed);
    return this.wallet.canAfford(bar.currencyId, needed);
  }

  /** Format a number compactly (e.g. 500000 → 500k). */
  shortNum(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 10_000)    return (n / 1_000).toFixed(0) + 'k';
    if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    return n.toString();
  }

  /** Contribute resources to a bar (manual click).
   *  Quick Stitching doubles the amount; Minor Touch Up may proc a free bonus. */
  contribute(bar: ResourceBar, barIndex: number): void {
    if (!this.canContribute(bar)) return;

    // ── Quick Stitching ──────────────────────────────────────────
    const effectiveAmount = Math.min(this.contributeAmount, bar.required - bar.contributed);
    // Good mode (both gold beads): free — no wallet deduction. Otherwise deduct cost.
    if (!this.autoSolveGoodMode) {
      this.wallet.remove(bar.currencyId, effectiveAmount);
    }
    bar.contributed += effectiveAmount;
    this.stats.trackCurrencyGain('life-thread', 0); // track activity

    this.log.log(LOG_MSG.MG_CHIMERAMANCER.CONTRIBUTE(cur(bar.currencyId, effectiveAmount, '')));

    // ── Minor Touch Up ───────────────────────────────────────────
    if (this.minorTouchUpLevel > 0 && !this.chimeraAwakened) {
      const procChance = this.minorTouchUpLevel * 0.1;
      if (Math.random() < procChance) {
        const others = this.bars.filter(b => b !== bar && b.contributed < b.required);
        if (others.length > 0) {
          const target = others[Math.floor(Math.random() * others.length)];
          const bonus  = Math.min(this.minorTouchUpLevel, target.required - target.contributed);
          target.contributed += bonus;
        }
      }
    }

    // ── Gold-1 bead drop check ───────────────────────────────────
    this.manualContributions++;
    if (this.manualContributions >= BEADS.GOLD_BEAD_MIN_MANUAL_CLEARS) {
      if (Math.random() < BEADS.MINIGAME_GOLD_BEAD_CHANCE) {
        this.goldBeadFound.emit();
      }
    }

    // ── Gold-2 ordered-click sequence ────────────────────────────
    if (!this.gold2BeadAlreadyFound) {
      this._checkGold2Sequence(barIndex);
    }

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

    // Restore gold-2 progress
    if (this.gold2Progress && typeof this.gold2Progress === 'object') {
      const p = this.gold2Progress as { step?: number };
      this.gold2Step = p.step ?? 0;
    }

    // Start auto-stitch if already enabled on restore
    if (this.autoSolveEnabled && this.autoSolveUnlocked) {
      this._startAutoStitch();
    }

    // Re-check afford state when wallet changes
    this.sub.add(this.wallet.state$.subscribe(() => this.cdr.markForCheck()));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['autoSolveEnabled'] || changes['autoSolveUnlocked'] ||
        changes['isActiveTab'] || changes['gold1Socketed']) {
      if (this.autoSolveEnabled && this.autoSolveUnlocked) {
        this._startAutoStitch();
      } else {
        this._stopAutoStitch();
      }
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this._stopAutoStitch();
    this.stopHold();
  }

  startHold(bar: ResourceBar, barIndex: number): void {
    this.stopHold();
    this.holdTimer = setInterval(() => {
      this.contribute(bar, barIndex);
    }, 100);
  }

  stopHold(): void {
    if (this.holdTimer) {
      clearInterval(this.holdTimer);
      this.holdTimer = null;
    }
  }

  toggleAutoSolve(): void {
    this.autoSolveEnabledChange.emit(!this.autoSolveEnabled);
  }

  private _startAutoStitch(): void {
    // Always restart to pick up speed changes (tab switch, bead socket)
    if (this.autoStitchTimer) { clearInterval(this.autoStitchTimer); this.autoStitchTimer = null; }
    const baseMs = AUTO_SOLVE.CHIMERAMANCER_TICK_MS;
    const tickMs = (!this.isActiveTab && !this.gold1Socketed) ? baseMs * AUTO_SOLVE.OFF_TAB_SLOW_FACTOR : baseMs;
    this.autoStitchTimer = setInterval(() => this._autoStitchTick(), tickMs);
  }

  private _stopAutoStitch(): void {
    if (this.autoStitchTimer) {
      clearInterval(this.autoStitchTimer);
      this.autoStitchTimer = null;
    }
  }

  /** Auto-stitch tick: contribute to the bar for the richest currency in the wallet. */
  private _autoStitchTick(): void {
    if (!this.autoSolveEnabled || !this.autoSolveUnlocked) { this._stopAutoStitch(); return; }
    if (this.chimeraAwakened) { this._stopAutoStitch(); return; }

    // Find all incomplete bars
    const incomplete = this.bars.filter(b => b.contributed < b.required);
    if (incomplete.length === 0) return;

    // Pick the bar for whichever currency the player has the most of
    let best: ResourceBar | null = null;
    let bestAmt = -1;
    for (const bar of incomplete) {
      const have = this.wallet.get(bar.currencyId);
      if (have > bestAmt) {
        bestAmt = have;
        best = bar;
      }
    }
    if (!best) return;

    const effectiveAmount = Math.min(this.contributeAmount, best.required - best.contributed);

    if (!this.autoSolveGoodMode) {
      // Normal auto-stitch: costs from wallet
      if (!this.wallet.canAfford(best.currencyId, effectiveAmount)) return;
      this.wallet.remove(best.currencyId, effectiveAmount);
    }
    // Good mode: free of cost — no wallet deduction

    best.contributed += effectiveAmount;
    this.stats.trackCurrencyGain('life-thread', 0);
    this._emitState();
    this._checkCompletion();
    this.cdr.markForCheck();
  }

  /** Gold-2: check if this manual click advances the ordered sequence. */
  private _checkGold2Sequence(barIndex: number): void {
    if (this.gold2BeadAlreadyFound) return;

    if (barIndex === this.gold2Step) {
      this.gold2Step++;

      if (this.gold2Step >= this.bars.length) {
        // Completed full sequence in order — award gold-2 bead
        this.gold2BeadFound.emit();
        this.gold2Step = 0;
      } else if (this.gemHunterLevel > 0 && GOLD2_CONDITIONS.LOG_PROGRESS) {
        const msgs = GOLD2_STEP_MESSAGES['chimeramancer'] ?? [];
        if (msgs.length > 0) {
          const msg = msgs[(this.gold2Step - 1) % msgs.length];
          this.log.log(msg, 'rare');
        }
      }
    } else {
      // Out-of-order click — reset sequence
      this.gold2Step = 0;
    }

    this._emitGold2Progress();
  }

  private _emitGold2Progress(): void {
    this.gold2ProgressChange.emit({ step: this.gold2Step });
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
      this.chimeraCompleted.emit();
    }
  }
}



