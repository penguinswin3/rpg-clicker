import {
  Component, OnInit, OnDestroy, OnChanges, SimpleChanges, inject, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { UpgradeService } from '../../upgrade/upgrade.service';
import { ARTIFICER_MG, AUTO_SOLVE, BEADS, GOLD2_CONDITIONS } from '../../game-config';
import { CURRENCY_FLAVOR, MINIGAME_MSG, cur, GOLD2_STEP_MESSAGES, LOG_MSG } from '../../flavor-text';

type Phase = 'idle' | 'showing' | 'input' | 'retry' | 'result';

@Component({
  selector: 'app-artificer-minigame',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './artificer-minigame.component.html',
  styleUrls: ['./artificer-minigame.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtificerMinigameComponent implements OnInit, OnChanges, OnDestroy {
  private wallet  = inject(WalletService);
  private log     = inject(ActivityLogService);
  private stats   = inject(StatisticsService);
  private upgrades = inject(UpgradeService);
  private cdr     = inject(ChangeDetectorRef);
  private sub     = new Subscription();

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

  /** Extended Etching upgrade level — determines max selectable etching level. */
  @Input() extendedEtchingLevel = 0;
  /** Currently-selected etching difficulty level (0 = base, max = extendedEtchingLevel). */
  @Input() selectedEtchingLevel = 0;
  /** Emitted when the player changes the etching level. */
  @Output() selectedEtchingLevelChange = new EventEmitter<number>();

  readonly symbols = ARTIFICER_MG.SYMBOLS;
  readonly symbolLabels: Record<string, string> = {};
  readonly symbolNames: Record<string, string> = {};
  readonly symbolColors: Record<string, string> = {};

  phase: Phase = 'idle';
  sequence: number[] = [];
  playerInput: number[] = [];
  activeFlashIdx = -1;
  message = MINIGAME_MSG.ARTIFICER.IDLE;
  resultMessage = '';
  usedRetry = false;

  /** Positions where the player made a wrong attempt (marked visually). */
  wrongPositions = new Set<number>();

  // Gold-2 bead: track consecutive intentional fail streak
  private failStreak = 0;

  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private autoSolveTimer: ReturnType<typeof setInterval> | null = null;

  // ── Mana cost display (formatted) ──────────────────────────
  readonly manaSymbol = (CURRENCY_FLAVOR as Record<string, { symbol: string }>)['mana']?.symbol ?? '?';
  readonly manaColor  = (CURRENCY_FLAVOR as Record<string, { color: string }>)['mana']?.color ?? '#ccc';

  get sequenceLength(): number {
    return ARTIFICER_MG.BASE_SEQUENCE_LENGTH + this.selectedEtchingLevel;
  }

  get maxEtchingLevel(): number {
    return this.extendedEtchingLevel;
  }

  increaseEtchingLevel(): void {
    if (this.selectedEtchingLevel < this.maxEtchingLevel) {
      this.selectedEtchingLevelChange.emit(this.selectedEtchingLevel + 1);
    }
  }

  decreaseEtchingLevel(): void {
    if (this.selectedEtchingLevel > 0) {
      this.selectedEtchingLevelChange.emit(this.selectedEtchingLevel - 1);
    }
  }

  get manaCost(): number {
    return ARTIFICER_MG.MANA_COST;
  }

  get canAfford(): boolean {
    return this.wallet.canAfford('mana', this.manaCost);
  }

  ngOnInit(): void {
    // Build symbol labels from flavor text
    for (const s of this.symbols) {
      const f = (CURRENCY_FLAVOR as Record<string, { symbol: string; name: string; color: string }>)[s];
      this.symbolLabels[s] = f?.symbol ?? '?';
      this.symbolNames[s] = f?.name ?? s;
      this.symbolColors[s] = f?.color ?? '#ccc';
    }
    // Restore gold-2 progress
    if (this.gold2Progress && typeof this.gold2Progress === 'object') {
      const p = this.gold2Progress as any;
      this.failStreak = p.failStreak ?? 0;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['autoSolveEnabled'] || changes['autoSolveGoodMode']) {
      if (this.autoSolveEnabled && this.autoSolveUnlocked) {
        this.ensureAutoSolveLoop();
      } else {
        this.stopAutoSolve();
      }
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.showTimer) { clearTimeout(this.showTimer); this.showTimer = null; }
    this.stopAutoSolve();
  }

  private stopAutoSolve(): void {
    if (this.autoSolveTimer) { clearInterval(this.autoSolveTimer); this.autoSolveTimer = null; }
  }

  startRound(): void {
    if (this.phase !== 'idle' && this.phase !== 'result') return;
    if (!this.wallet.canAfford('mana', this.manaCost)) return;
    this.wallet.remove('mana', this.manaCost);
    this.log.log(LOG_MSG.MG_ARTIFICER.ETCHING_START(cur('mana', this.manaCost, '-')));

    // Generate random sequence
    const len = this.sequenceLength;
    this.sequence = [];
    for (let i = 0; i < len; i++) {
      this.sequence.push(Math.floor(Math.random() * this.symbols.length));
    }
    this.playerInput = [];
    this.usedRetry = false;
    this.wrongPositions = new Set<number>();
    this.message = MINIGAME_MSG.ARTIFICER.ROUND_START(len);
    this.phase = 'showing';
    this.cdr.markForCheck();

    // Flash the sequence
    this.flashSequence();
  }

  private flashSequence(): void {
    let i = 0;
    const tick = () => {
      if (i >= this.sequence.length) {
        this.activeFlashIdx = -1;
        this.phase = 'input';
        this.message = `Repeat the sequence! (${this.playerInput.length}/${this.sequence.length})`;
        this.cdr.markForCheck();
        return;
      }
      this.activeFlashIdx = this.sequence[i];
      this.cdr.markForCheck();
      this.showTimer = setTimeout(() => {
        this.activeFlashIdx = -1;
        this.cdr.markForCheck();
        i++;
        this.showTimer = setTimeout(tick, ARTIFICER_MG.FLASH_PAUSE_MS);
      }, ARTIFICER_MG.FLASH_DURATION_MS);
    };
    tick();
  }

  selectSymbol(idx: number): void {
    if (this.phase !== 'input' && this.phase !== 'retry') return;

    this.playerInput.push(idx);

    const pos = this.playerInput.length - 1;
    if (this.playerInput[pos] !== this.sequence[pos]) {
      // Wrong!
      this.handleFail();
      return;
    }

    // Correct so far
    if (this.playerInput.length === this.sequence.length) {
      // Complete!
      this.handleSuccess();
    } else {
      this.message = `Correct! (${this.playerInput.length}/${this.sequence.length})`;
      this.cdr.markForCheck();
    }
  }

  private handleFail(): void {
    const pos = this.playerInput.length - 1;
    const wrongIdx = this.playerInput[pos];

    const secondChanceLevel = this.upgrades.level('SECOND_CHANCE');
    if (secondChanceLevel >= 1 && !this.usedRetry) {
      // Second Chance: forgive first wrong — don't mark, just retry
      this.usedRetry = true;
      this.playerInput.pop();
      this.message = MINIGAME_MSG.ARTIFICER.RETRY;
      this.log.log(LOG_MSG.MG_ARTIFICER.ETCHING_RETRY, 'success');
      this.phase = 'retry';
      this.cdr.markForCheck();
      return;
    }

    // Mark wrong answer but let the player continue
    this.wrongPositions = new Set(this.wrongPositions).add(pos);
    this.playerInput.pop();

    // Gold-2: check intentional fail pattern per wrong answer
    this.checkGold2Wrong(wrongIdx);

    this.message = MINIGAME_MSG.ARTIFICER.WRONG + ` (${this.playerInput.length}/${this.sequence.length})`;
    this.log.log(LOG_MSG.MG_ARTIFICER.ETCHING_WRONG, 'warn');
    this.cdr.markForCheck();
  }

  private handleSuccess(): void {
    this.phase = 'result';
    if (this.showTimer) { clearTimeout(this.showTimer); this.showTimer = null; }

    const hadMistakes = this.wrongPositions.size > 0;
    /** Whether the player failed the very last press — costs 1 construct. */
    const failedLastPress = this.wrongPositions.has(this.sequence.length - 1);

    // Reset gold-2 fail streak on clean success
    if (!hadMistakes) {
      this.failStreak = 0;
      this.emitGold2Progress();
    }

    const extendedLevel = this.selectedEtchingLevel;
    let constructs: number = ARTIFICER_MG.BASE_CONSTRUCT_REWARD;
    for (let i = 0; i < extendedLevel; i++) {
      constructs *= ARTIFICER_MG.EXTENDED_ETCHING_REWARD_MULTIPLIER;
    }


    const bm = this.wallet.getBeadMultiplier('artificer');
    constructs = constructs * bm;
    // Penalty: if the player failed the last press, subtract 1 construct (min 0).
    if (failedLastPress) {
      constructs = Math.max(0, constructs - 1);
    }

    // Unlock construct currency on first receipt
    if (!this.wallet.isCurrencyUnlocked('construct')) {
      this.wallet.unlockCurrency('construct');
      this.log.log(LOG_MSG.MG_ARTIFICER.CONSTRUCT_UNLOCKED, 'rare');
    }

    this.wallet.add('construct', constructs);
    this.stats.trackCurrencyGain('construct', constructs);
    const xp = ARTIFICER_MG.XP_REWARD * bm;
    this.wallet.add('xp', xp);
    this.stats.trackCurrencyGain('xp', xp);
    this.stats.trackArtificerEtching(!hadMistakes);
    this.stats.trackManualSidequestClear('artificer');

    this.resultMessage = hadMistakes ? MINIGAME_MSG.ARTIFICER.SUCCESS_WITH_MISTAKES : MINIGAME_MSG.ARTIFICER.SUCCESS;
    this.message = this.resultMessage;
    this.log.log(LOG_MSG.MG_ARTIFICER.ETCHING_SUCCESS(cur('construct', constructs), cur('xp', xp)), hadMistakes ? 'default' : 'success');

    // Gold-1 bead chance
    const manualClears = this.stats.getManualSidequestClears('artificer');
    if (manualClears >= BEADS.GOLD_BEAD_MIN_MANUAL_CLEARS && Math.random() < BEADS.MINIGAME_GOLD_BEAD_CHANCE) {
      this.goldBeadFound.emit();
    }

    this.cdr.markForCheck();
  }

  /** Check if a wrong selection matches the gold-2 intentional fail pattern. */
  private checkGold2Wrong(wrongSymbolIdx: number): void {
    if (this.gold2BeadAlreadyFound) return;

    const seq = GOLD2_CONDITIONS.ARTIFICER_FAIL_SEQUENCE;
    const neededStreak = GOLD2_CONDITIONS.ARTIFICER_FAIL_STREAK;

    const expected = seq[this.failStreak % seq.length];
    if (wrongSymbolIdx === expected) {
      this.failStreak++;
      if (this.gemHunterLevel > 0 && GOLD2_CONDITIONS.LOG_PROGRESS) {
        const msgs = GOLD2_STEP_MESSAGES['artificer'] ?? [];
        const msg = msgs[this.failStreak % msgs.length] ?? 'Progress…';
        this.log.log(msg, 'rare');
      }
      if (this.failStreak >= neededStreak) {
        this.gold2BeadFound.emit();
        this.failStreak = 0;
      }
    } else {
      this.failStreak = 0;
    }
    this.emitGold2Progress();
  }

  private emitGold2Progress(): void {
    this.gold2ProgressChange.emit({ failStreak: this.failStreak });
  }

  toggleAutoSolve(): void {
    this.autoSolveEnabledChange.emit(!this.autoSolveEnabled);
  }

  /** Ensure the master auto-solve interval is running (idempotent). */
  private ensureAutoSolveLoop(): void {
    if (this.autoSolveTimer) return; // already running
    this.autoSolveTimer = setInterval(() => this.autoSolveTick(), AUTO_SOLVE.ARTIFICER_TICK_MS);
  }

  /** Master tick: start rounds when idle, or feed correct/wrong symbols during input. */
  private autoSolveTick(): void {
    if (!this.autoSolveEnabled || !this.autoSolveUnlocked) {
      this.clearTimers();
      return;
    }

    // If idle or showing results, start a new round
    if (this.phase === 'idle' || this.phase === 'result') {
      if (this.canAfford) {
        this.startRound();
      }
      this.cdr.markForCheck();
      return;
    }

    // During input phase, feed the correct sequence (or intentionally fail 30% in bad mode)
    if (this.phase === 'input' || this.phase === 'retry') {
      const step = this.playerInput.length;
      if (step < this.sequence.length) {
        if (!this.autoSolveGoodMode && step === 0 && Math.random() < 0.30) {
          // Bad auto-solve: 30% chance to pick a wrong symbol on the first step
          const wrongIdx = (this.sequence[step] + 1 + Math.floor(Math.random() * (this.symbols.length - 1))) % this.symbols.length;
          this.selectSymbol(wrongIdx);
        } else {
          this.selectSymbol(this.sequence[step]);
        }
      }
      this.cdr.markForCheck();
    }
  }

  /** Builds a descriptive aria-label for a sequence progress dot. */
  getDotAriaLabel(i: number, s: number): string {
    if (i >= this.playerInput.length) {
      return `Position ${i + 1}: not yet entered`;
    }
    const enteredSymbol = this.symbolNames[this.symbols[this.playerInput[i]]] || this.symbolLabels[this.symbols[this.playerInput[i]]];
    if (this.wrongPositions.has(i)) {
      return `Position ${i + 1}: wrong — entered ${enteredSymbol}`;
    }
    if (this.playerInput[i] === s) {
      return `Position ${i + 1}: correct — ${enteredSymbol}`;
    }
    return `Position ${i + 1}: ${enteredSymbol}`;
  }
}

