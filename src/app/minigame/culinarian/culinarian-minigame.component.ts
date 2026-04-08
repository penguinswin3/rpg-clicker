import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { CULINARIAN_MG, AUTO_SOLVE, BEADS, GOLD2_CONDITIONS } from '../../game-config';
import { CURRENCY_FLAVOR, MINIGAME_MSG, cur, GOLD2_STEP_MESSAGES, LOG_MSG } from '../../flavor-text';

/** Feedback per slot after a guess is submitted. */
export type PegColor = 'green' | 'yellow' | 'miss';

export interface GuessRow {
  ingredients: string[];   // currency IDs
  pegs: PegColor[];
}

@Component({
  selector: 'app-culinarian-minigame',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './culinarian-minigame.component.html',
  styleUrls: ['./culinarian-minigame.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CulinarianMinigameComponent implements OnInit, OnDestroy, OnChanges {
  private wallet = inject(WalletService);
  private log    = inject(ActivityLogService);
  private stats  = inject(StatisticsService);
  private cdr    = inject(ChangeDetectorRef);
  private sub    = new Subscription();

  readonly SOLUTION_LENGTH  = CULINARIAN_MG.SOLUTION_LENGTH;
  readonly MAX_GUESSES      = CULINARIAN_MG.MAX_GUESSES;
  readonly INGREDIENT_COST  = CULINARIAN_MG.INGREDIENT_COST;
  readonly MEAL_REWARD      = CULINARIAN_MG.MEAL_REWARD;
  readonly INGREDIENTS      = CULINARIAN_MG.INGREDIENTS;
  readonly currencyFlavor   = CURRENCY_FLAVOR;

  /** Level of the Waste Not upgrade — grants +1 hearty meal per unused guess on win. */
  @Input() wasteNotLevel = 0;
  /** Level of the Larger Cookbooks upgrade — reveals the first ingredient at round start. */
  @Input() largerCookbooksLevel = 0;
  /** Whether the Ancient Cookbook reveal is enabled. */
  @Input() ancientCookbookEnabled = true;
  /** Emitted when the player toggles the Ancient Cookbook. */
  @Output() ancientCookbookEnabledChange = new EventEmitter<boolean>();
  /** Level of the Cookbook Annotations upgrade — auto-submits one-of-each guess at round start. */
  @Input() cookbookAnnotationsLevel = 0;

  // ── Auto-solve ──────────────────────────
  @Input() autoSolveUnlocked = false;
  @Input() autoSolveEnabled = false;
  @Input() autoSolveGoodMode = false;
  @Output() autoSolveEnabledChange = new EventEmitter<boolean>();
  @Output() goldBeadFound = new EventEmitter<void>();
  private autoSolveInterval?: ReturnType<typeof setInterval>;
  /**
   * Brute-force approach: systematically test each ingredient in each slot.
   * 4 herb guesses, 4 meat guesses, 4 tongue guesses → solve on 4th try.
   * This tracks which auto-guess step we're on (0–15).
   */
  private autoSolveStep = 0;
  /** Pre-built brute-force guesses for auto-solve. */
  private autoSolveGuesses: string[][] = [];

  // ── Gold-2 bead tracking ─────────────────
  @Input() gold2Progress: unknown;
  @Output() gold2ProgressChange = new EventEmitter<unknown>();
  @Output() gold2BeadFound = new EventEmitter<void>();
  private gold2Awarded = false;
  /** Level of the Gem Hunter upgrade — enables gold-2 log progress messages. */
  @Input() gemHunterLevel = 0;
  /** Whether the gold-2 bead has already been found for this character (suppresses log messages). */
  @Input() gold2BeadAlreadyFound = false;

  toggleAutoSolve(): void {
    this.autoSolveEnabledChange.emit(!this.autoSolveEnabled);
  }

  toggleAncientCookbook(): void {
    this.ancientCookbookEnabledChange.emit(!this.ancientCookbookEnabled);
  }

  // ── Wallet-synced ─────────────────────────
  herb         = 0;
  beast        = 0;
  koboldTongue = 0;
  spice        = 0;

  // ── Round state ───────────────────────────
  roundActive = false;
  solution: string[] = [];
  guessHistory: GuessRow[] = [];
  currentGuess: (string | null)[] = [];
  /** Indices that are locked as revealed hints and cannot be cleared or overwritten. */
  revealedSlots = new Set<number>();
  guessesUsed = 0;
  won   = false;
  lost  = false;

  // ── Drag state ────────────────────────────
  /** The ingredient currently being dragged (or selected via click). */
  dragIngredient: string | null = null;

  lastMsg  = '';
  msgClass = 'msg-neutral';

  // ── Computed ──────────────────────────────

  get canStart(): boolean {
    return !this.roundActive
      && this.herb         >= this.INGREDIENT_COST
      && this.beast        >= this.INGREDIENT_COST
      && this.koboldTongue >= this.INGREDIENT_COST
      && this.spice        >= this.INGREDIENT_COST;
  }

  get canSubmit(): boolean {
    return this.roundActive && !this.won && !this.lost
      && this.currentGuess.every(s => s !== null);
  }

  get guessesRemaining(): number {
    return this.MAX_GUESSES - this.guessesUsed;
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
        this.herb         = Math.floor(s['herb']?.amount           ?? 0);
        this.beast        = Math.floor(s['beast']?.amount          ?? 0);
        this.koboldTongue = Math.floor(s['kobold-tongue']?.amount  ?? 0);
        this.spice        = Math.floor(s['spice']?.amount          ?? 0);
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.stopAutoSolve();
  }

  // ── Actions ───────────────────────────────

  startRound(): void {
    if (!this.canStart) return;
    this.wallet.remove('herb',          this.INGREDIENT_COST);
    this.wallet.remove('beast',         this.INGREDIENT_COST);
    this.wallet.remove('kobold-tongue', this.INGREDIENT_COST);
    this.wallet.remove('spice',         this.INGREDIENT_COST);

    // Generate random solution
    this.solution = Array.from(
      { length: this.SOLUTION_LENGTH },
      () => this.INGREDIENTS[Math.floor(Math.random() * this.INGREDIENTS.length)]
    );

    this.guessHistory = [];
    this.currentGuess = Array(this.SOLUTION_LENGTH).fill(null);
    this.revealedSlots = new Set<number>();
    this.guessesUsed  = 0;
    this.won   = false;
    this.lost  = false;
    this.roundActive = true;
    this.dragIngredient = null;

    // Cookbook Annotations: auto-submit one-of-each guess before the player begins.
    // The annotation is always [herb, beast, kobold-tongue, spice] — one of every
    // ingredient in INGREDIENTS order — shown as a free hint (does not count as a used guess).
    if (this.cookbookAnnotationsLevel >= 1) {
      const annotationGuess = [...this.INGREDIENTS] as string[]; // one of each, in order
      const annotationPegs  = this.evaluate(annotationGuess);
      this.guessHistory.push({ ingredients: annotationGuess, pegs: annotationPegs });
      // Check for the (very unlikely) case that the annotation is a perfect match
      if (annotationPegs.every(p => p === 'green')) {
        this.onWin();
        this.log.log(LOG_MSG.MG_CULINARIAN.ANNOTATION_MATCH, 'success');
        this.cdr.markForCheck();
        return;
      }
    }

    // Larger Cookbooks: reveal and lock the first ingredient
    if (this.largerCookbooksLevel >= 1 && this.ancientCookbookEnabled) {
      this.currentGuess[0] = this.solution[0];
      this.revealedSlots.add(0);
    }

    this.lastMsg  = MINIGAME_MSG.CULINARIAN.ROUND_START(this.MAX_GUESSES);
    this.msgClass = 'msg-neutral';
    this.log.log(LOG_MSG.MG_CULINARIAN.EXPERIMENT_START(`${cur('herb', this.INGREDIENT_COST, '-')}, ${cur('beast', this.INGREDIENT_COST, '-')}, ${cur('kobold-tongue', this.INGREDIENT_COST, '-')}, ${cur('spice', this.INGREDIENT_COST, '-')}`));
  }

  submitGuess(): void {
    if (!this.canSubmit) return;

    const guess = this.currentGuess as string[];

    // Gold-2 tracking: check if the first guess of this round matches the pattern
    if (!this.autoSolveEnabled && !this.gold2Awarded && this.guessesUsed === 0) {
      this.trackGold2FirstGuess(guess);
    }

    const pegs  = this.evaluate(guess);
    this.guessHistory.push({ ingredients: [...guess], pegs: [...pegs] });
    this.guessesUsed++;

    if (pegs.every(p => p === 'green')) {
      this.onWin();
    } else if (this.guessesUsed >= this.MAX_GUESSES) {
      this.onLose();
    } else {
      const greens  = pegs.filter(p => p === 'green').length;
      const yellows = pegs.filter(p => p === 'yellow').length;
      this.lastMsg  = MINIGAME_MSG.CULINARIAN.GUESS_FEEDBACK(greens, yellows, this.guessesRemaining);
      this.msgClass = 'msg-neutral';
      this.currentGuess = Array(this.SOLUTION_LENGTH).fill(null);
      // Re-apply any Larger Cookbooks revealed slots so they persist across every guess row.
      for (const idx of this.revealedSlots) {
        this.currentGuess[idx] = this.solution[idx];
      }
    }
  }

  clearGuess(): void {
    // Preserve any revealed slots — only clear the player-placed ones.
    this.currentGuess = this.currentGuess.map((v, i) =>
      this.revealedSlots.has(i) ? v : null
    );
    this.dragIngredient = null;
  }

  // ── Click-to-place (primary interaction) ──

  /** Place ingredient into the leftmost empty, non-revealed slot. */
  selectIngredient(id: string): void {
    if (this.won || this.lost) return;
    const idx = this.currentGuess.findIndex((v, i) => v === null && !this.revealedSlots.has(i));
    if (idx !== -1) {
      this.currentGuess[idx] = id;
    }
  }

  /** Clicking a filled, non-revealed slot clears it. */
  slotClick(index: number): void {
    if (this.won || this.lost) return;
    if (!this.revealedSlots.has(index) && this.currentGuess[index] !== null) {
      this.currentGuess[index] = null;
    }
  }

  // ── Native HTML5 drag-and-drop ────────────

  onDragStart(event: DragEvent, id: string): void {
    this.dragIngredient = id;
    event.dataTransfer?.setData('text/plain', id);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();   // allow drop
  }

  onDrop(event: DragEvent, index: number): void {
    event.preventDefault();
    if (this.revealedSlots.has(index)) return;
    const id = event.dataTransfer?.getData('text/plain') ?? this.dragIngredient;
    if (id && this.INGREDIENTS.includes(id)) {
      this.currentGuess[index] = id;
    }
    this.dragIngredient = null;
  }

  // ── Display helpers ───────────────────────

  ingredientSymbol(id: string): string {
    return (CURRENCY_FLAVOR as Record<string, { symbol: string }>)[id]?.symbol ?? '?';
  }

  ingredientColor(id: string): string {
    return (CURRENCY_FLAVOR as Record<string, { color: string }>)[id]?.color ?? '#888';
  }

  ingredientName(id: string): string {
    return (CURRENCY_FLAVOR as Record<string, { name: string }>)[id]?.name ?? id;
  }

  pegColorValue(peg: PegColor): string {
    switch (peg) {
      case 'green':  return '#0c0';
      case 'yellow': return '#ee0';
      case 'miss':   return '#333';
    }
  }

  pegBgColor(peg: PegColor): string {
    switch (peg) {
      case 'green':  return 'rgba(0, 180, 0, 0.30)';
      case 'yellow': return 'rgba(220, 200, 0, 0.28)';
      case 'miss':   return '#060606';
    }
  }

  // ── Auto-solve helpers ──────────────────

  private startAutoSolve(): void {
    this.stopAutoSolve();
    this.autoSolveStep = 0;
    this.autoSolveGuesses = [];
    this.autoSolveInterval = setInterval(() => this.autoSolveTick(), AUTO_SOLVE.CULINARIAN_TICK_MS);
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

    // If no round is active and we can start, start one
    if (!this.roundActive && !this.won && !this.lost) {
      if (this.canStart) {
        this.startRound();
        this.autoSolveStep = 0;

        if (this.autoSolveGoodMode) {
          // Good auto-solve: first guess is always [herb, beast, kobold-tongue, spice]
          this.autoSolveGuesses = [
            ['herb', 'beast', 'kobold-tongue', 'spice'],
          ];
        } else {
          // Build the brute-force guesses: all-herb, all-beast, all-tongue, then deduced solution
          this.autoSolveGuesses = [
            Array(this.SOLUTION_LENGTH).fill('herb'),
            Array(this.SOLUTION_LENGTH).fill('beast'),
            Array(this.SOLUTION_LENGTH).fill('kobold-tongue'),
            // The 4th guess will be computed after the first 3 results
          ];
        }
      }
      this.cdr.markForCheck();
      return;
    }

    // If round is over (won or lost), reset for next round
    if (this.won || this.lost) {
      this.autoSolveStep = 0;
      this.autoSolveGuesses = [];
      // Clear state so the next tick can start a new round
      this.roundActive = false;
      this.won = false;
      this.lost = false;
      this.cdr.markForCheck();
      return;
    }

    // If round is active but we haven't built guesses yet (enabled mid-round), build them now
    if (this.roundActive && this.autoSolveGuesses.length === 0) {
      this.autoSolveStep = 0;
      if (this.autoSolveGoodMode) {
        this.autoSolveGuesses = [
          ['herb', 'beast', 'kobold-tongue', 'spice'],
        ];
      } else {
        this.autoSolveGuesses = [
          Array(this.SOLUTION_LENGTH).fill('herb'),
          Array(this.SOLUTION_LENGTH).fill('beast'),
          Array(this.SOLUTION_LENGTH).fill('kobold-tongue'),
        ];
      }
      this.cdr.markForCheck();
      return;
    }

    if (this.autoSolveGoodMode) {
      this.autoSolveTickGood();
    } else {
      this.autoSolveTickBad();
    }
  }

  /** Bad auto-solve: 2 all-same guesses, then a smart combined guess, then fully deduced 4th. */
  private autoSolveTickBad(): void {
    const offset = this.cookbookAnnotationsLevel >= 1 ? 1 : 0;

    // Steps 0–1: submit all-herb, all-beast
    if (this.roundActive && this.autoSolveStep < 2 && this.autoSolveStep < this.autoSolveGuesses.length) {
      const guess = this.autoSolveGuesses[this.autoSolveStep];
      this.currentGuess = [...guess];
      this.submitGuess();
      this.autoSolveStep++;
      this.cdr.markForCheck();
      return;
    }

    // Step 2: build a smart guess — fill known herb/beast positions, kobold-tongue elsewhere.
    // If all unknowns are kobold-tongue, this solves on the 3rd guess.
    if (this.roundActive && this.autoSolveStep === 2) {
      const smart = this.buildSmartGuess(offset);
      this.currentGuess = [...smart];
      this.submitGuess();
      this.autoSolveStep++;
      this.cdr.markForCheck();
      return;
    }

    // Step 3: any position that was kobold-tongue in the smart guess but didn't go green
    // must be spice. Submit the fully deduced solution.
    if (this.roundActive && this.autoSolveStep === 3) {
      const smart = this.buildSmartGuess(offset);
      const smartRow = this.guessHistory[offset + 2];
      const deduced = smart.map((ing, s) => {
        if (ing === 'kobold-tongue' && smartRow && smartRow.pegs[s] !== 'green') return 'spice';
        return ing;
      });
      this.currentGuess = [...deduced];
      this.submitGuess();
      this.autoSolveStep++;
      this.cdr.markForCheck();
    }
  }

  /**
   * Build a partially-deduced guess from the first two all-same results.
   * Known herb/beast positions are filled in; unknowns get kobold-tongue.
   */
  private buildSmartGuess(offset: number): string[] {
    const smart: string[] = Array(this.SOLUTION_LENGTH).fill('kobold-tongue');
    const herbRow  = this.guessHistory[offset];
    const beastRow = this.guessHistory[offset + 1];
    if (herbRow) {
      for (let s = 0; s < this.SOLUTION_LENGTH; s++) {
        if (herbRow.pegs[s] === 'green') smart[s] = 'herb';
      }
    }
    if (beastRow) {
      for (let s = 0; s < this.SOLUTION_LENGTH; s++) {
        if (beastRow.pegs[s] === 'green') smart[s] = 'beast';
      }
    }
    return smart;
  }

  /**
   * Good auto-solve: guess [herb, beast, kobold-tongue, spice] first,
   * then deduce and submit the correct solution on the second guess.
   */
  private autoSolveTickGood(): void {
    // Step 0: submit the one-of-each guess
    if (this.roundActive && this.autoSolveStep === 0 && this.autoSolveGuesses.length > 0) {
      const guess = this.autoSolveGuesses[0];
      this.currentGuess = [...guess];
      this.submitGuess();
      this.autoSolveStep++;
      this.cdr.markForCheck();
      return;
    }

    // Step 1: deduce the solution using all available guess history
    if (this.roundActive && this.autoSolveStep === 1) {
      const deduced = this.deduceSolutionFromHistory();
      this.currentGuess = [...deduced];
      this.submitGuess();
      this.autoSolveStep++;
      this.cdr.markForCheck();
    }
  }

  /**
   * Enumerate all 256 possible solutions (4^4), filter to those consistent
   * with every guess in the history, and return the first match.
   */
  private deduceSolutionFromHistory(): string[] {
    const ingredients = this.INGREDIENTS;
    const n = this.SOLUTION_LENGTH;

    // Generate all possible solutions
    const total = Math.pow(ingredients.length, n);
    for (let code = 0; code < total; code++) {
      const candidate: string[] = [];
      let c = code;
      for (let i = 0; i < n; i++) {
        candidate.push(ingredients[c % ingredients.length]);
        c = Math.floor(c / ingredients.length);
      }

      // Check if this candidate is consistent with all guess history
      let consistent = true;
      for (const row of this.guessHistory) {
        const pegs = this.evaluateAgainst(row.ingredients, candidate);
        if (!this.pegsMatch(pegs, row.pegs)) {
          consistent = false;
          break;
        }
      }
      if (consistent) return candidate;
    }

    // Fallback: just return the solution (shouldn't happen)
    return [...this.solution];
  }

  /** Evaluate a guess against a hypothetical solution. */
  private evaluateAgainst(guess: string[], sol: string[]): PegColor[] {
    const pegs: PegColor[] = Array(this.SOLUTION_LENGTH).fill('miss');
    const solR: (string | null)[] = [...sol];
    const guessR: (string | null)[] = [...guess];

    for (let i = 0; i < this.SOLUTION_LENGTH; i++) {
      if (guess[i] === sol[i]) {
        pegs[i] = 'green';
        solR[i] = null;
        guessR[i] = null;
      }
    }
    for (let i = 0; i < this.SOLUTION_LENGTH; i++) {
      if (guessR[i] === null) continue;
      const idx = solR.indexOf(guessR[i]);
      if (idx !== -1) {
        pegs[i] = 'yellow';
        solR[idx] = null;
      }
    }
    return pegs;
  }

  /** Check if two peg arrays are identical. */
  private pegsMatch(a: PegColor[], b: PegColor[]): boolean {
    return a.length === b.length && a.every((p, i) => p === b[i]);
  }

  // ── Gold-2 helpers ─────────────────────

  /**
   * Track the first guess of each round for gold-2 unlock.
   * Must match the required sequence across 3 consecutive games.
   */
  private trackGold2FirstGuess(guess: string[]): void {
    const progress = (this.gold2Progress as { step?: number }) ?? {};
    let step = progress.step ?? 0;
    const patterns = GOLD2_CONDITIONS.CULINARIAN_FIRST_GUESSES;

    if (step >= patterns.length) {
      this.gold2ProgressChange.emit({ step: 0 });
      return;
    }

    const expected = patterns[step];
    if (guess.length === expected.length && guess.every((g, i) => g === expected[i])) {
      step++;
      if (step >= patterns.length) {
        // All 3 games completed — award the bead!
        this.gold2Awarded = true;
        this.gold2BeadFound.emit();
        this.gold2ProgressChange.emit({ step: 0 });
      } else {
        if (this.gemHunterLevel >= 1 && !this.gold2BeadAlreadyFound) {
          const msgs = GOLD2_STEP_MESSAGES['culinarian'];
          this.log.log(msgs[(step - 1) % msgs.length], 'rare');
        }
        this.gold2ProgressChange.emit({ step });
      }
    } else {
      // Mismatch — reset, but check if this guess matches step 0
      const first = patterns[0];
      if (guess.length === first.length && guess.every((g, i) => g === first[i])) {
        if (this.gemHunterLevel >= 1 && !this.gold2BeadAlreadyFound) this.log.log(GOLD2_STEP_MESSAGES['culinarian'][0], 'rare');
        this.gold2ProgressChange.emit({ step: 1 });
      } else {
        this.gold2ProgressChange.emit({ step: 0 });
      }
    }
  }

  private rollMinigameGoldBead(): void {
    if (this.stats.getManualSidequestClears('culinarian') < BEADS.GOLD_BEAD_MIN_MANUAL_CLEARS) return;
    if (Math.random() < BEADS.MINIGAME_GOLD_BEAD_CHANCE) {
      this.goldBeadFound.emit();
    }
  }

  // ── Private ───────────────────────────────

  /**
   * Classic Mastermind evaluation.
   * Green = correct ingredient in correct position.
   * Yellow = correct ingredient in wrong position (but not already matched green).
   * Miss = ingredient not in solution or already accounted for.
   */
  private evaluate(guess: string[]): PegColor[] {
    const pegs: PegColor[] = Array(this.SOLUTION_LENGTH).fill('miss');
    const solRemaining: (string | null)[] = [...this.solution];
    const guessRemaining: (string | null)[] = [...guess];

    // Pass 1: greens — exact position matches
    for (let i = 0; i < this.SOLUTION_LENGTH; i++) {
      if (guess[i] === this.solution[i]) {
        pegs[i] = 'green';
        solRemaining[i]   = null;
        guessRemaining[i] = null;
      }
    }

    // Pass 2: yellows — right ingredient, wrong position
    for (let i = 0; i < this.SOLUTION_LENGTH; i++) {
      if (guessRemaining[i] === null) continue;
      const matchIdx = solRemaining.indexOf(guessRemaining[i]);
      if (matchIdx !== -1) {
        pegs[i] = 'yellow';
        solRemaining[matchIdx] = null;
      }
    }

    return pegs;
  }

  private onWin(): void {
    this.won = true;
    this.roundActive = false;

    // Roll for gold bead on successful recipe
    if (!this.autoSolveEnabled) {
      this.stats.trackManualSidequestClear('culinarian');
    }
    this.rollMinigameGoldBead();

    const bm = this.wallet.getBeadMultiplier('culinarian');
    const unusedGuesses  = this.MAX_GUESSES - this.guessesUsed;
    const wasteNotBonus  = this.wasteNotLevel >= 1 ? unusedGuesses*this.wasteNotLevel : 0;
    const totalReward    = (this.MEAL_REWARD + wasteNotBonus) * bm;

    this.wallet.add('hearty-meal', totalReward);

    // Track stats
    this.stats.trackCulinarianResult(true, this.guessesUsed);
    this.stats.trackCurrencyGain('hearty-meal', totalReward);

    if (!this.wallet.isCurrencyUnlocked('hearty-meal')) {
      this.wallet.unlockCurrency('hearty-meal');
      this.log.log(LOG_MSG.MG_CULINARIAN.MEAL_UNLOCKED, 'rare');
    } else if (wasteNotBonus > 0) {
      this.log.log(LOG_MSG.MG_CULINARIAN.MEAL_WITH_WASTE_NOT(cur('hearty-meal', this.MEAL_REWARD * bm), cur('hearty-meal', wasteNotBonus * bm)), 'success');
    } else {
      this.log.log(LOG_MSG.MG_CULINARIAN.MEAL_CRAFTED(cur('hearty-meal', totalReward)), 'success');
    }

    this.lastMsg  = wasteNotBonus > 0
      ? MINIGAME_MSG.CULINARIAN.WIN_BONUS(wasteNotBonus)
      : MINIGAME_MSG.CULINARIAN.WIN;
    this.msgClass = 'msg-good';
  }

  private onLose(): void {
    this.lost = true;
    this.roundActive = false;
    this.stats.trackCulinarianResult(false, this.guessesUsed);
    this.log.log(LOG_MSG.MG_CULINARIAN.RECIPE_FAILED, 'warn');
    this.lastMsg  = MINIGAME_MSG.CULINARIAN.LOSE;
    this.msgClass = 'msg-bad';
  }
}
