import { Component, OnInit, OnDestroy, inject, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { ARTISAN_MG } from '../../game-config';
import { CURRENCY_FLAVOR, MINIGAME_MSG, cur } from '../../flavor-text';
import {randInt} from "../../utils/mathUtils";

/** Internal representation of one gemstone in the Faceting minigame. */
interface Gem {
  /** Colour saturation factor (0 = grey, 1 = full colour). */
  color: number;
  /** Clarity factor (0 = many imperfections, 1 = flawless). */
  clarity: number;
  /** Cut factor (0 = blurred, 1 = crisp). */
  cut: number;
  /** Carat factor (0 = small, 1 = large). */
  carat: number;
  /** Overall quality score (average of four attributes). */
  score: number;
  /** Whether this gem has been selected by the player. */
  selected: boolean;
  /** Whether the score has been revealed (after round ends). */
  revealed: boolean;
}

@Component({
  selector: 'app-artisan-minigame',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './artisan-minigame.component.html',
  styleUrls: ['./artisan-minigame.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtisanMinigameComponent implements OnInit, OnDestroy {
  private wallet = inject(WalletService);
  private log    = inject(ActivityLogService);
  private stats  = inject(StatisticsService);
  private cdr    = inject(ChangeDetectorRef);
  private sub    = new Subscription();

  readonly currencyFlavor = CURRENCY_FLAVOR;
  readonly GEMSTONE_COST  = ARTISAN_MG.GEMSTONE_COST;
  readonly METAL_COST     = ARTISAN_MG.METAL_COST;
  readonly GEM_COUNT      = ARTISAN_MG.GEM_COUNT;
  readonly PICKS          = ARTISAN_MG.PICKS;
  readonly JEWELRY_REWARD = ARTISAN_MG.JEWELRY_REWARD;
  readonly GEM_SYMBOL     = CURRENCY_FLAVOR['gemstone'].symbol;
  readonly GEM_COLOR      = CURRENCY_FLAVOR['gemstone'].color;

  // ── Upgrade inputs ────────────────────────
  @Input() luckyGemsLevel = 0;
  @Input() doubleDipLevel = 0;
  @Input() standOutSelectionLevel = 0;
  @Input() goodEnoughLevel = 0;
  @Input() closeEnoughLevel = 0;

  // ── Wallet-synced ─────────────────────────
  gemstones = 0;
  preciousMetal = 0;

  // ── Round state ───────────────────────────
  roundStarted = false;
  roundOver    = false;
  gems: Gem[]  = [];
  picksLeft: number = this.PICKS;

  // ── Result ────────────────────────────────
  lastMsg  = '';
  msgClass = 'msg-neutral';
  resultParts: Array<{ amount: number; symbol: string; color: string }> = [];
  resultXp = 0;

  /** Index of the best gem (highest score). */
  bestGemIndex = -1;
  /** Index of the second-best gem (used by Double Dip). */
  secondBestGemIndex = -1;
  /**
   * Set to the gem index when Double Dip confirms the first pick is correct.
   * Shows a green outline + score on that gem while awaiting the second pick.
   * Reset to -1 at round start and after the round ends.
   */
  doubleDipConfirmedIndex = -1;
  /**
   * Set to the 2nd-best gem index when Close Enough is the winning condition.
   * Used to highlight the Close Enough pick distinctly after the round ends.
   * Reset to -1 at round start.
   */
  closeEnoughPickIndex = -1;
  /**
   * Set to the 2nd-best gem index when Double Dip succeeds (both best and 2nd-best selected).
   * Used to show a green highlight on the 2nd pick after the round ends.
   * Reset to -1 at round start.
   */
  doubleDipSecondPickIndex = -1;

  get canStart(): boolean {
    return this.gemstones >= this.GEMSTONE_COST && this.preciousMetal >= this.METAL_COST;
  }

  // ── Lifecycle ─────────────────────────────

  ngOnInit(): void {
    this.sub.add(
      this.wallet.state$.subscribe(s => {
        this.gemstones     = Math.floor(s['gemstone']?.amount ?? 0);
        this.preciousMetal = Math.floor(s['precious-metal']?.amount ?? 0);
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ── Actions ───────────────────────────────

  startRound(): void {
    if (!this.canStart) return;

    // Deduct costs
    this.wallet.remove('gemstone', this.GEMSTONE_COST);
    this.wallet.remove('precious-metal', this.METAL_COST);

    // Compute effective lucky gem bonus from base + upgrade levels
    const effectiveBonus = ARTISAN_MG.LUCKY_GEM_BONUS + this.luckyGemsLevel * ARTISAN_MG.LUCKY_GEM_BONUS_PER_LEVEL;

    // Generate gems with random attributes
    this.gems = [];
    const luckyGem = randInt(0, this.GEM_COUNT - 1);  // one random gem will be the "lucky" best one
    for (let i = 0; i < this.GEM_COUNT; i++) {
      let color: number = 0;
      let clarity:number =0;
      let cut= 0;
      let carat = 0;
      if (i === luckyGem){
        color = Math.min(1, Math.random()+effectiveBonus);
        clarity = Math.min(1, Math.random()+effectiveBonus);
        cut = Math.min(1, Math.random()+effectiveBonus);
        carat = Math.min(1, Math.random()+effectiveBonus);
      } else {
        color = Math.random();
        clarity = Math.random();
        cut = Math.random();
        carat = Math.random();
      }

      // Stand Out Selection: set random attributes of the lucky gem to max (1.0)
      if (i === luckyGem && this.standOutSelectionLevel > 0) {
        const attrs: ('color' | 'clarity' | 'cut' | 'carat')[] = ['color', 'clarity', 'cut', 'carat'];
        // Shuffle and pick N attributes to max out
        for (let s = attrs.length - 1; s > 0; s--) {
          const r = randInt(0, s);
          [attrs[s], attrs[r]] = [attrs[r], attrs[s]];
        }
        const toMax = Math.min(this.standOutSelectionLevel, attrs.length);
        const vals: Record<string, number> = { color, clarity, cut, carat };
        for (let m = 0; m < toMax; m++) {
          vals[attrs[m]] = 1.0;
        }
        color   = vals['color'];
        clarity = vals['clarity'];
        cut     = vals['cut'];
        carat   = vals['carat'];
      }

      const score   = (color + clarity + cut + carat) / 4;
      this.gems.push({ color, clarity, cut, carat, score, selected: false, revealed: false });
    }

    // Find best and second-best gem
    let maxScore = -1;
    let secondMaxScore = -1;
    this.bestGemIndex = 0;
    this.secondBestGemIndex = -1;
    for (let i = 0; i < this.gems.length; i++) {
      if (this.gems[i].score > maxScore) {
        secondMaxScore = maxScore;
        this.secondBestGemIndex = this.bestGemIndex;
        maxScore = this.gems[i].score;
        this.bestGemIndex = i;
      } else if (this.gems[i].score > secondMaxScore) {
        secondMaxScore = this.gems[i].score;
        this.secondBestGemIndex = i;
      }
    }

    // Effective picks: base + 1 if Double Dip is active
    this.picksLeft                = this.PICKS + (this.doubleDipLevel >= 1 ? 1 : 0);
    this.doubleDipConfirmedIndex  = -1;
    this.doubleDipSecondPickIndex = -1;
    this.closeEnoughPickIndex     = -1;
    this.roundStarted = true;
    this.roundOver    = false;
    this.lastMsg      = MINIGAME_MSG.ARTISAN.ROUND_START(this.GEM_COUNT);
    this.msgClass     = 'msg-neutral';
    this.resultParts  = [];
    this.resultXp     = 0;
    this.cdr.markForCheck();
  }

  selectGem(index: number): void {
    if (this.roundOver || this.picksLeft <= 0) return;
    const gem = this.gems[index];
    if (gem.selected) return;

    gem.selected = true;
    this.picksLeft--;

    // Double Dip: after the first pick examine what was selected and decide how to proceed.
    //   • Best gem found      → green confirmation, player gets a second pick (Double Dip).
    //   • Runner-up found
    //     + Close Enough active → amber confirmation, player gets a second pick to try for the best.
    //   • Wrong pick           → cancel remaining picks, resolve as failure.
    if (this.doubleDipLevel >= 1 && this.picksLeft > 0) {
      const pickedActualBest = this.gems[this.bestGemIndex].selected;
      const pickedRunnerUp   = this.closeEnoughLevel >= 1
        && this.secondBestGemIndex >= 0
        && this.gems[this.secondBestGemIndex].selected
        && !pickedActualBest;

      if (pickedActualBest) {
        // Found the best gem — show green confirmation, await second pick
        this.doubleDipConfirmedIndex = index;
      } else if (pickedRunnerUp) {
        // Close Enough: found the runner-up — show amber confirmation, await second pick
        this.closeEnoughPickIndex = index;
        // Do NOT cancel picksLeft; player may still find the best gem
      } else {
        // Wrong pick — end the round immediately
        this.picksLeft = 0;
      }
    }

    // If all picks used, resolve round
    if (this.picksLeft <= 0) {
      this.resolveRound();
    }

    this.cdr.markForCheck();
  }

  private resolveRound(): void {
    this.roundOver = true;

    // Reveal all gems
    for (const g of this.gems) {
      g.revealed = true;
    }

    // Win conditions
    const pickedBest = this.gems[this.bestGemIndex].selected;
    const pickedCloseEnough = this.closeEnoughLevel >= 1
      && this.secondBestGemIndex >= 0
      && this.gems[this.secondBestGemIndex].selected
      && !pickedBest;  // Close Enough only fires when the strict best wasn't found
    const won = pickedBest || pickedCloseEnough;

    if (won) {
      // Award jewelry — unlock it on first acquisition
      if (!this.wallet.isCurrencyUnlocked('jewelry')) {
        this.wallet.unlockCurrency('jewelry');
        this.log.log(
          `A perfect jewel! ${cur('jewelry', 1)} Jewelry unlocked!`,
          'rare'
        );
      }

      let totalJewelry = this.JEWELRY_REWARD;
      let totalXp      = ARTISAN_MG.XP_REWARD;

      // Good Enough bonus: +1 jewelry per gem above the quality threshold
      if (this.goodEnoughLevel >= 1) {
        const gemsAboveThreshold = this.gems.filter(g => g.score >= ARTISAN_MG.GOOD_ENOUGH_THRESHOLD).length;
        totalJewelry += gemsAboveThreshold * ARTISAN_MG.GOOD_ENOUGH_JEWELRY_PER_GEM;
      }

      // Double Dip bonus: requires having picked the ACTUAL best gem AND the 2nd-best gem
      const picked2ndBest = pickedBest
        && this.doubleDipLevel >= 1
        && this.secondBestGemIndex >= 0
        && this.gems[this.secondBestGemIndex].selected;

      if (picked2ndBest) {
        // Normal Double Dip (best first, runner-up second) → green runner-up highlight.
        // Reverse order (Close Enough runner-up first, best second) → amber already set; keep it.
        if (this.closeEnoughPickIndex === -1) {
          this.doubleDipSecondPickIndex = this.secondBestGemIndex;
        }
        totalJewelry += ARTISAN_MG.DOUBLE_DIP_JEWELRY_BONUS;
        totalXp      += ARTISAN_MG.DOUBLE_DIP_XP_BONUS;
      }

      this.wallet.add('jewelry', totalJewelry);
      this.wallet.add('xp', totalXp);
      this.stats.trackCurrencyGain('jewelry', totalJewelry);
      this.stats.trackCurrencyGain('xp', totalXp);
      this.stats.trackArtisanFaceting(true);

      this.resultParts = [
        { amount: totalJewelry, symbol: CURRENCY_FLAVOR['jewelry'].symbol, color: CURRENCY_FLAVOR['jewelry'].color },
      ];
      this.resultXp = totalXp;
      this.msgClass = 'msg-success';

      if (pickedCloseEnough) {
        this.closeEnoughPickIndex = this.secondBestGemIndex;
        this.lastMsg = MINIGAME_MSG.ARTISAN.CLOSE_ENOUGH_WIN;
        this.log.log(
          `Faceting success (Close Enough)! (${cur('jewelry', totalJewelry)}, ${cur('xp', totalXp)})`,
          'success'
        );
      } else if (picked2ndBest) {
        this.lastMsg = MINIGAME_MSG.ARTISAN.DOUBLE_DIP_HIT;
        this.log.log(
          `Faceting success + Double Dip! (${cur('jewelry', totalJewelry)}, ${cur('xp', totalXp)})`,
          'success'
        );
      } else if (this.doubleDipLevel >= 1) {
        // Picked best but missed the 2nd-best
        this.lastMsg = MINIGAME_MSG.ARTISAN.DOUBLE_DIP_MISS;
        this.log.log(
          `Faceting success! (${cur('jewelry', totalJewelry)}, ${cur('xp', totalXp)})`,
          'success'
        );
      } else {
        this.lastMsg = MINIGAME_MSG.ARTISAN.CORRECT;
        this.log.log(
          `Faceting success! (${cur('jewelry', totalJewelry)}, ${cur('xp', totalXp)})`,
          'success'
        );
      }
    } else {
      this.stats.trackArtisanFaceting(false);
      this.lastMsg  = MINIGAME_MSG.ARTISAN.WRONG;
      this.msgClass = 'msg-fail';
      this.resultParts = [];
      this.resultXp = 0;

      this.log.log('Faceting failed — wrong gemstone selected.', 'warn');
    }

    this.cdr.markForCheck();
  }

  /** Restart shortcut when round is over. */
  tryRestart(): void {
    if (this.roundOver && this.canStart) {
      this.startRound();
    }
  }

  // ── Gem display helpers ───────────────────

  /** Size in px for the gem symbol; ranges from ~20 (carat=0) to ~42 (carat=1). */
  gemSize(gem: Gem): number {
    return 20 + gem.carat * 22;
  }

  /** Blur in px; ranges from ~3 (cut=0) to 0 (cut=1). */
  gemBlur(gem: Gem): number {
    return (1 - gem.cut) * 2;
  }

  /** Saturation percent; 0 = fully desaturated, 100 = full colour. */
  gemSaturation(gem: Gem): number {
    return gem.color * 100;
  }

  /** Number of imperfection dots (0 clarity = 5 dots, 1 clarity = 0 dots). */
  gemImperfections(gem: Gem): number[] {
    const count = Math.round((1 - gem.clarity) * 5);
    return new Array(count);
  }

  /** Stable imperfection positions seeded by gem index. */
  imperfectionStyle(gemIdx: number, dotIdx: number): Record<string, string> {
    // Deterministic-ish positions based on index
    const seed = (gemIdx * 7 + dotIdx * 13) % 100;
    const top  = 15 + ((seed * 3 + dotIdx * 17) % 55);
    const left = 10 + ((seed * 5 + dotIdx * 23) % 65);
    return {
      position: 'absolute',
      top: top + '%',
      left: left + '%',
      width: '4px',
      height: '4px',
      'border-radius': '50%',
      background: 'rgba(0,0,0,0.35)',
      'pointer-events': 'none',
    };
  }

  /** Score displayed as percentage for reveal. */
  scorePct(gem: Gem): string {
    return (gem.score * 100).toFixed(1) + '%';
  }

  /**
   * Colour for the score label on a red → yellow → green gradient.
   *   0.0  → rgb(255,   0, 0)  red
   *   0.5  → rgb(255, 255, 0)  yellow
   *   1.0  → rgb(  0, 255, 0)  green
   */
  scoreColor(gem: Gem): string {
    const s = gem.score; // 0–1
    let r: number, g: number;
    if (s <= 0.5) {
      // red → yellow
      r = 255;
      g = Math.round(255 * (s * 2));
    } else {
      // yellow → green
      r = Math.round(255 * (1 - (s - 0.5) * 2));
      g = 255;
    }
    return `rgb(${r},${g},0)`;
  }

  /** Whether this gem is the best one — used for highlighting after reveal. */
  isBest(index: number): boolean {
    return index === this.bestGemIndex;
  }
}
