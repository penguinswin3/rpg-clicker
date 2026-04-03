import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { CULINARIAN_MG } from '../../game-config';
import { CURRENCY_FLAVOR, MINIGAME_MSG } from '../../flavor-text';

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
})
export class CulinarianMinigameComponent implements OnInit, OnDestroy {
  private wallet = inject(WalletService);
  private log    = inject(ActivityLogService);
  private stats  = inject(StatisticsService);
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

  ngOnInit(): void {
    this.sub.add(
      this.wallet.state$.subscribe(s => {
        this.herb         = Math.floor(s['herb']?.amount           ?? 0);
        this.beast        = Math.floor(s['beast']?.amount          ?? 0);
        this.koboldTongue = Math.floor(s['kobold-tongue']?.amount  ?? 0);
        this.spice        = Math.floor(s['spice']?.amount          ?? 0);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
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

    // Larger Cookbooks: reveal and lock the first ingredient
    if (this.largerCookbooksLevel >= 1) {
      this.currentGuess[0] = this.solution[0];
      this.revealedSlots.add(0);
    }

    this.lastMsg  = MINIGAME_MSG.CULINARIAN.ROUND_START(this.MAX_GUESSES);
    this.msgClass = 'msg-neutral';
    this.log.log(`Culinarian begins experimenting. (−${this.INGREDIENT_COST} each ingredient)`);
  }

  submitGuess(): void {
    if (!this.canSubmit) return;

    const guess = this.currentGuess as string[];
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

    const unusedGuesses  = this.MAX_GUESSES - this.guessesUsed;
    const wasteNotBonus  = this.wasteNotLevel >= 1 ? unusedGuesses*this.wasteNotLevel : 0;
    const totalReward    = this.MEAL_REWARD + wasteNotBonus;

    this.wallet.add('hearty-meal', totalReward);

    // Track stats
    this.stats.trackCulinarianResult(true, this.guessesUsed);
    this.stats.trackCurrencyGain('hearty-meal', totalReward);

    if (!this.wallet.isCurrencyUnlocked('hearty-meal')) {
      this.wallet.unlockCurrency('hearty-meal');
      this.log.log(`The Culinarian perfects a Hearty Meal! New currency unlocked!`, 'rare');
    } else if (wasteNotBonus > 0) {
      this.log.log(`Hearty Meal crafted! (+${this.MEAL_REWARD} +${wasteNotBonus} Waste Not bonus)`, 'success');
    } else {
      this.log.log(`Hearty Meal crafted! (+${this.MEAL_REWARD})`, 'success');
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
    this.log.log('The Culinarian failed to find the recipe.', 'warn');
    this.lastMsg  = MINIGAME_MSG.CULINARIAN.LOSE;
    this.msgClass = 'msg-bad';
  }
}

