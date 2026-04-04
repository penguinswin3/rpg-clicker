import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
  readonly LUCKY_GEM_BONUS= ARTISAN_MG.LUCKY_GEM_BONUS;
  readonly JEWELRY_REWARD = ARTISAN_MG.JEWELRY_REWARD;
  readonly GEM_SYMBOL     = CURRENCY_FLAVOR['gemstone'].symbol;
  readonly GEM_COLOR      = CURRENCY_FLAVOR['gemstone'].color;

  // ── Wallet-synced ─────────────────────────
  gemstones = 0;
  preciousMetal = 0;

  // ── Round state ───────────────────────────
  roundStarted = false;
  roundOver    = false;
  gems: Gem[]  = [];
  picksLeft    = this.PICKS;

  // ── Result ────────────────────────────────
  lastMsg  = '';
  msgClass = 'msg-neutral';
  resultParts: Array<{ amount: number; symbol: string; color: string }> = [];
  resultXp = 0;

  /** Index of the best gem (highest score). */
  bestGemIndex = -1;

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

    // Generate gems with random attributes
    this.gems = [];
    const luckyGem = randInt(0, this.GEM_COUNT - 1);  // one random gem will be the "lucky" best one
    for (let i = 0; i < this.GEM_COUNT; i++) {
      let color: number = 0;
      let clarity:number =0;
      let cut= 0;
      let carat = 0;
      if (i === luckyGem){
        color = Math.min(100, Math.random()+this.LUCKY_GEM_BONUS);
        clarity = Math.min(100, Math.random()+this.LUCKY_GEM_BONUS);
        cut = Math.min(100, Math.random()+this.LUCKY_GEM_BONUS);
        carat = Math.min(100, Math.random()+this.LUCKY_GEM_BONUS);
      } else {
        color = Math.random();
        clarity = Math.random();
        cut = Math.random();
        carat = Math.random();
      }
      const score   = (color + clarity + cut + carat) / 4;
      this.gems.push({ color, clarity, cut, carat, score, selected: false, revealed: false });
    }

    // Find best gem
    let maxScore = -1;
    this.bestGemIndex = 0;
    for (let i = 0; i < this.gems.length; i++) {
      if (this.gems[i].score > maxScore) {
        maxScore = this.gems[i].score;
        this.bestGemIndex = i;
      }
    }

    this.picksLeft    = this.PICKS;
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

    // Check if the player selected the best gem
    const pickedBest = this.gems[this.bestGemIndex].selected;

    if (pickedBest) {
      // Award jewelry — unlock it on first acquisition
      if (!this.wallet.isCurrencyUnlocked('jewelry')) {
        this.wallet.unlockCurrency('jewelry');
        this.log.log(
          `A perfect jewel! ${cur('jewelry', 1)} Jewelry unlocked!`,
          'rare'
        );
      }

      this.wallet.add('jewelry', this.JEWELRY_REWARD);
      this.wallet.add('xp', ARTISAN_MG.XP_REWARD);
      this.stats.trackCurrencyGain('jewelry', this.JEWELRY_REWARD);
      this.stats.trackCurrencyGain('xp', ARTISAN_MG.XP_REWARD);
      this.stats.trackArtisanFaceting(true);

      this.lastMsg  = MINIGAME_MSG.ARTISAN.CORRECT;
      this.msgClass = 'msg-success';
      this.resultParts = [
        { amount: this.JEWELRY_REWARD, symbol: CURRENCY_FLAVOR['jewelry'].symbol, color: CURRENCY_FLAVOR['jewelry'].color },
      ];
      this.resultXp = ARTISAN_MG.XP_REWARD;

      this.log.log(
        `Faceting success! (${cur('jewelry', this.JEWELRY_REWARD)}, ${cur('xp', ARTISAN_MG.XP_REWARD)})`,
        'success'
      );
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
    return (1 - gem.cut) * 3;
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
