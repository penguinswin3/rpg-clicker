import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { APOTH_MG } from '../../game-config';
import { CURRENCY_FLAVOR, MINIGAME_MSG } from '../../flavor-text';
import { toPct, rollChance } from '../../utils/mathUtils';

@Component({
  selector: 'app-apothecary-minigame',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './apothecary-minigame.component.html',
  styleUrls: ['./apothecary-minigame.component.scss'],
})
export class ApothecaryMinigameComponent implements OnInit, OnDestroy {
  private wallet = inject(WalletService);
  private log    = inject(ActivityLogService);
  private stats  = inject(StatisticsService);
  private zone   = inject(NgZone);
  private sub    = new Subscription();
  private animFrame?: number;
  private lastTime?: number;

  /** Set to true when the Bubbling Brew upgrade has been purchased. */
  @Input() bubblingBrewUnlocked = false;
  /** Level of Bigger Bubbles upgrade — expands the inner brewing zone. */
  @Input() biggerBubblesLevel = 0;
  /** Set to true when the Potion Dilution upgrade has been purchased. */
  @Input() potionDilutionUnlocked = false;
  /** Serial Dilution level — each level reduces dilution fail chance by 1%. */
  @Input() serialDilutionLevel = 0;
  /** Perfect Potions level — awards +1 concentrated potion per level on a flawless brew (no misses). */
  @Input() perfectPotionsLevel = 0;

  // ── Dilution toggle ───────────────────────
  /** Whether dilution is active — owned by AppComponent, persisted across tab switches. */
  @Input()  dilutionEnabled = false;
  @Output() dilutionEnabledChange = new EventEmitter<boolean>();

  /** Accumulated dilution success chance penalty from misses in the current brew session. */
  dilutionMissPenalty = 0;

  onDilutionChange(val: boolean): void {
    this.dilutionEnabled = val;
    this.dilutionEnabledChange.emit(val);
  }

  /** Current dilution success chance (base + Serial Dilution bonus − per-miss penalty). */
  get dilutionSuccessChance(): number {
    return Math.max(0, Math.min(100, APOTH_MG.DILUTION_BASE_CHANCE + this.serialDilutionLevel - this.dilutionMissPenalty));
  }

  /** Interpolated color from yellow (50%) to green (100%). */
  get dilutionColor(): string {
    const pct = (this.dilutionSuccessChance - 50) / 50; // 0 at 50%, 1 at 100%
    const clamped = Math.max(0, Math.min(1, pct));
    // Interpolate hue from 60 (yellow) to 120 (green)
    const hue = Math.round( clamped * 120);
    return `hsl(${hue}, 80%, 50%)`;
  }

  // ── Wallet-synced ─────────────────────────
  herbs   = 0;
  potions = 0;

  // ── Potion state ──────────────────────────
  potionActive      = false;
  hadMistake        = false;
  quality           = 0;
  readonly maxQuality     = APOTH_MG.MAX_QUALITY;
  readonly herbCost       = APOTH_MG.HERB_COST;
  readonly potionCost     = APOTH_MG.POTION_COST;
  readonly currencyFlavor = CURRENCY_FLAVOR;

  // ── Beat bar ──────────────────────────────
  /** Cursor position: 0 – 100 */
  barPos = 0;
  /** Movement direction: 1 = right, -1 = left */
  barDir = 1;
  readonly barSpeed     = APOTH_MG.BAR_SPEED;
  readonly zoneMin      = APOTH_MG.ZONE_MIN;
  readonly zoneMax      = APOTH_MG.ZONE_MAX;

  /** Base inner zone bounds (before Bigger Bubbles expansion) */
  private readonly baseInnerZoneMin = APOTH_MG.INNER_ZONE_MIN;
  private readonly baseInnerZoneMax = APOTH_MG.INNER_ZONE_MAX;

  /** Effective inner zone left edge, widened by Bigger Bubbles. */
  get innerZoneMin(): number {
    return Math.max(this.zoneMin, this.baseInnerZoneMin - this.biggerBubblesLevel * APOTH_MG.BIGGER_BUBBLES_ZONE_EXPANSION_PER_LEVEL);
  }
  /** Effective inner zone right edge, widened by Bigger Bubbles. */
  get innerZoneMax(): number {
    return Math.min(this.zoneMax, this.baseInnerZoneMax + this.biggerBubblesLevel * APOTH_MG.BIGGER_BUBBLES_ZONE_EXPANSION_PER_LEVEL);
  }

  // ── Messages ──────────────────────────────
  lastMsg  = '';
  msgClass = 'msg-neutral';

  // ── Computed ──────────────────────────────

  get qualityBar(): string {
    return '█'.repeat(this.quality) + '░'.repeat(this.maxQuality - this.quality);
  }

  get qualityPct(): number {
    return toPct(this.quality, this.maxQuality);
  }

  get isInZone(): boolean {
    return this.barPos >= this.zoneMin && this.barPos <= this.zoneMax;
  }

  get isInInnerZone(): boolean {
    return this.bubblingBrewUnlocked &&
      this.barPos >= this.innerZoneMin && this.barPos <= this.innerZoneMax;
  }

  get canStart(): boolean {
    return !this.potionActive && this.herbs >= this.herbCost && this.potions >= this.potionCost;
  }

  // ── Lifecycle ─────────────────────────────

  ngOnInit(): void {
    this.sub.add(
      this.wallet.state$.subscribe(s => {
        this.herbs   = Math.floor(s['herb']?.amount   ?? 0);
        this.potions = Math.floor(s['potion']?.amount ?? 0);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.stopAnimation();
  }

  // ── Actions ───────────────────────────────

  startPotion(): void {
    if (!this.canStart) return;
    this.wallet.remove('herb',   this.herbCost);
    this.wallet.remove('potion', this.potionCost);
    this.potionActive       = true;
    this.hadMistake         = false;
    this.quality            = 0;
    this.dilutionMissPenalty = 0;
    this.barPos             = 0;
    this.barDir             = 1;
    this.lastTime           = undefined;
    this.lastMsg            = MINIGAME_MSG.APOTHECARY.IDLE;
    this.msgClass           = 'msg-neutral';
    this.log.log(`Apothecary begins brewing. (−${this.herbCost} herbs, −${this.potionCost} potion base)`);
    this.startAnimation();
  }

  brew(): void {
    if (!this.potionActive) return;

    if (this.isInInnerZone) {
      this.quality  = Math.min(this.maxQuality, this.quality + 2);
      this.lastMsg  = MINIGAME_MSG.APOTHECARY.HIT_INNER(this.quality, this.maxQuality);
      this.msgClass = 'msg-double';
      if (this.quality >= this.maxQuality) this.onPerfectPotion();
    } else if (this.isInZone) {
      this.quality  = Math.min(this.maxQuality, this.quality + 1);
      this.lastMsg  = MINIGAME_MSG.APOTHECARY.HIT_ZONE(this.quality, this.maxQuality);
      this.msgClass = 'msg-good';
      if (this.quality >= this.maxQuality) this.onPerfectPotion();
    } else {
      this.quality    = Math.max(0, this.quality - 1);
      this.hadMistake = true;
      if (this.dilutionEnabled) {
        this.dilutionMissPenalty += APOTH_MG.DILUTION_MISS_PENALTY;
      }
      this.lastMsg    = MINIGAME_MSG.APOTHECARY.MISS_ZONE(this.quality, this.maxQuality);
      this.msgClass   = 'msg-bad';
    }
  }

  // ── Private ───────────────────────────────

  private startAnimation(): void {
    // Run rAF outside Angular to avoid triggering CD every frame.
    // barPos is written here; we use markForCheck manually if we ever need it —
    // but the brew button click & startPotion already trigger CD at the moments
    // that matter.  The [style.left.%] binding updates via the next CD cycle
    // (triggered by the click event itself).  For a smooth visual cursor we
    // intentionally re-enter the zone each frame so Angular re-renders the bar.
    const loop = (timestamp: number) => {
      if (!this.potionActive) return;

      if (this.lastTime !== undefined) {
        const dt = timestamp - this.lastTime;
        this.barPos += this.barDir * this.barSpeed * dt;

        if (this.barPos >= 100) { this.barPos = 100; this.barDir = -1; }
        else if (this.barPos <= 0) { this.barPos = 0; this.barDir = 1; }
      }
      this.lastTime = timestamp;

      this.zone.run(() => {});           // tick Angular CD so [style.left.%] updates
      this.animFrame = requestAnimationFrame(loop);
    };

    this.zone.runOutsideAngular(() => {
      this.animFrame = requestAnimationFrame(loop);
    });
  }

  private stopAnimation(): void {
    if (this.animFrame !== undefined) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = undefined;
    }
  }

  private onPerfectPotion(): void {
    this.stopAnimation();
    this.potionActive = false;

    if (this.potionDilutionUnlocked && this.dilutionEnabled) {
      // Dilution: always produce 2 items, but each has a chance to downgrade
      const failChance = 100 - this.dilutionSuccessChance;
      let concentrated = 0;
      let downgraded   = 0;

      for (let i = 0; i < 2; i++) {
        if (rollChance(failChance)) {
          downgraded++;
        } else {
          concentrated++;
        }
      }

      if (concentrated > 0) this.wallet.add('concentrated-potion', concentrated);
      if (downgraded > 0)   this.wallet.add('potion', downgraded);

      // Track stats
      if (concentrated > 0) {
        this.stats.trackConcentratedPotionMade(concentrated);
        this.stats.trackCurrencyGain('concentrated-potion', concentrated);
      }
      if (downgraded > 0) this.stats.trackCurrencyGain('potion', downgraded);
      for (let i = 0; i < 2; i++) {
        this.stats.trackDilution(i < concentrated);
      }

      if (!this.wallet.isCurrencyUnlocked('concentrated-potion') && concentrated > 0) {
        this.wallet.unlockCurrency('concentrated-potion');
        this.log.log('A Concentrated Potion has been crafted! New currency unlocked!', 'rare');
      }

      if (concentrated === 2) {
        this.log.log(`Dilution success! 2 Concentrated Potions crafted!`, 'success');
        this.lastMsg  = MINIGAME_MSG.APOTHECARY.DILUTE_FULL;
        this.msgClass = 'msg-good';
      } else if (concentrated === 1) {
        this.log.log(`Dilution partial: 1 Concentrated Potion + 1 Potion Base.`, 'success');
        this.lastMsg  = MINIGAME_MSG.APOTHECARY.DILUTE_PARTIAL;
        this.msgClass = 'msg-good';
      } else {
        this.log.log(`Dilution failed! 2 Potion Bases produced instead.`, 'warn');
        this.lastMsg  = MINIGAME_MSG.APOTHECARY.DILUTE_FAIL;
        this.msgClass = 'msg-bad';
      }
    } else {
      // Standard: 1 concentrated potion
      this.wallet.add('concentrated-potion', 1);

      const flawlessBonus = !this.hadMistake && this.perfectPotionsLevel > 0 ? this.perfectPotionsLevel : 0;
      if (flawlessBonus > 0) this.wallet.add('concentrated-potion', flawlessBonus);

      // Track stats
      const totalConcentrated = 1 + flawlessBonus;
      this.stats.trackConcentratedPotionMade(totalConcentrated);
      this.stats.trackCurrencyGain('concentrated-potion', totalConcentrated);

      if (!this.wallet.isCurrencyUnlocked('concentrated-potion')) {
        this.wallet.unlockCurrency('concentrated-potion');
        this.log.log('A Concentrated Potion has been crafted! New currency unlocked!', 'rare');
      } else if (flawlessBonus > 0) {
        this.log.log(`A Concentrated Potion has been crafted! Flawless brew: +${flawlessBonus} bonus!`, 'success');
      } else {
        this.log.log('A Concentrated Potion has been crafted!', 'success');
      }

      this.lastMsg  = MINIGAME_MSG.APOTHECARY.PERFECT;
      this.msgClass = 'msg-good';
    }
  }
}

