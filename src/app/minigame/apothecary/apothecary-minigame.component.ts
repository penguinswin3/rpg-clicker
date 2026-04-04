import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, NgZone, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { APOTH_MG } from '../../game-config';
import { CURRENCY_FLAVOR, MINIGAME_MSG, cur } from '../../flavor-text';
import { toPct, rollChance } from '../../utils/mathUtils';

@Component({
  selector: 'app-apothecary-minigame',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './apothecary-minigame.component.html',
  styleUrls: ['./apothecary-minigame.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApothecaryMinigameComponent implements OnInit, OnDestroy {
  private wallet = inject(WalletService);
  private log    = inject(ActivityLogService);
  private stats  = inject(StatisticsService);
  private zone   = inject(NgZone);
  private cdr    = inject(ChangeDetectorRef);
  private sub    = new Subscription();
  private animFrame?: number;
  private lastTime?: number;

  /** Set to true when the Bubbling Brew upgrade has been purchased. */
  @Input() bubblingBrewUnlocked = false;
  /** Level of Bigger Bubbles upgrade — expands the inner brewing zone. */
  @Input() biggerBubblesLevel = 0;
  /** Set to true when the Potion Dilution upgrade has been purchased. */
  @Input() potionDilutionUnlocked = false;
  /** Serial Dilution level — each level adds +1 additional potion roll when diluting. */
  @Input() serialDilutionLevel = 0;
  /** Perfect Potions level — each inner-zone click adds +(level × 5)% to dilution success chance for the current brew. */
  @Input() perfectPotionsLevel = 0;

  // ── Synaptical Potions ─────────────────
  /** Set to true when the Synaptical Potions upgrade has been purchased. */
  @Input() synapticalPotionsUnlocked = false;
  /** Synaptic Static level — each level places one random bonus zone on the bar when brewing synaptical potions. */
  @Input() synapticStaticLevel = 0;
  /** Whether synaptical mode is active — owned by AppComponent, persisted across tab switches. */
  @Input()  synapticalEnabled = false;
  @Output() synapticalEnabledChange = new EventEmitter<boolean>();

  /** Randomly placed bonus zones for Synaptic Static (percentage positions). */
  synapticZones: { min: number; max: number }[] = [];

  onSynapticalChange(val: boolean): void {
    this.synapticalEnabled = val;
    this.synapticalEnabledChange.emit(val);
  }

  /** Whether the cursor is inside any Synaptic Static zone. */
  get isInSynapticZone(): boolean {
    if (!this.synapticalEnabled || this.synapticZones.length === 0) return false;
    return this.synapticZones.some(z => this.barPos >= z.min && this.barPos <= z.max);
  }

  // ── Dilution toggle ───────────────────────
  /** Whether dilution is active — owned by AppComponent, persisted across tab switches. */
  @Input()  dilutionEnabled = false;
  @Output() dilutionEnabledChange = new EventEmitter<boolean>();

  /** Bonus dilution success % accumulated from inner-zone clicks during the current brew. */
  perfectClickBonus = 0;

  /** Accumulated dilution success chance penalty from misses in the current brew session. */
  dilutionMissPenalty = 0;

  onDilutionChange(val: boolean): void {
    this.dilutionEnabled = val;
    this.dilutionEnabledChange.emit(val);
  }

  /** Current dilution success chance (base − miss penalty + perfect click bonus). */
  get dilutionSuccessChance(): number {
    return Math.max(0, Math.min(100, APOTH_MG.DILUTION_BASE_CHANCE - this.dilutionMissPenalty + this.perfectClickBonus));
  }

  /** Total number of independent potion rolls per dilution: base 2 + 1 per Serial Dilution level. */
  get dilutionTotalRolls(): number {
    return 2 + this.serialDilutionLevel;
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
        this.cdr.markForCheck();
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
    this.potionActive        = true;
    this.hadMistake          = false;
    this.quality             = 0;
    this.dilutionMissPenalty = 0;
    this.perfectClickBonus   = 0;
    this.barPos              = 0;
    this.barDir             = 1;
    this.lastTime           = undefined;
    this.lastMsg            = MINIGAME_MSG.APOTHECARY.IDLE;
    this.msgClass           = 'msg-neutral';

    // Generate Synaptic Static bonus zones when brewing in synaptical mode
    this.synapticZones = [];
    if (this.synapticalEnabled && this.synapticStaticLevel > 0) {
      for (let i = 0; i < this.synapticStaticLevel; i++) {
        const zoneWidth = APOTH_MG.SYNAPTIC_ZONE_WIDTH;
        const center = 5 + Math.random() * 90; // 5-95% to keep zones roughly on the bar
        const min = Math.max(0, center - zoneWidth / 2);
        const max = Math.min(100, min + zoneWidth);
        this.synapticZones.push({ min, max });
      }
    }

    this.log.log(`Apothecary begins brewing. (${cur('herb', this.herbCost, '-')}, ${cur('potion', this.potionCost, '-')})`);
    this.startAnimation();
  }

  brew(): void {
    if (!this.potionActive) return;

    // In synaptical mode, Bubbling Brew / Bigger Bubbles don't apply.
    // Instead, Synaptic Static zones provide +2 quality.
    if (this.synapticalEnabled) {
      if (this.isInSynapticZone) {
        this.quality  = Math.min(this.maxQuality, this.quality + 2);
        this.lastMsg  = `Synaptic surge! +2 quality (${this.quality}/${this.maxQuality})`;
        this.msgClass = 'msg-double';
        this.stats.trackPotionHit(true);
        if (this.quality >= this.maxQuality) this.onPerfectPotion();
      } else if (this.isInZone) {
        this.quality  = Math.min(this.maxQuality, this.quality + 1);
        this.lastMsg  = MINIGAME_MSG.APOTHECARY.HIT_ZONE(this.quality, this.maxQuality);
        this.msgClass = 'msg-good';
        this.stats.trackPotionHit(false);
        if (this.quality >= this.maxQuality) this.onPerfectPotion();
      } else {
        this.quality    = Math.max(0, this.quality - 1);
        this.hadMistake = true;
        this.lastMsg    = MINIGAME_MSG.APOTHECARY.MISS_ZONE(this.quality, this.maxQuality);
        this.msgClass   = 'msg-bad';
        this.stats.trackPotionMiss();
      }
    } else {
      // Normal (concentrated potion) mode
      if (this.isInInnerZone) {
        this.quality  = Math.min(this.maxQuality, this.quality + 2);
        this.perfectClickBonus += this.perfectPotionsLevel * 5;
        this.lastMsg  = MINIGAME_MSG.APOTHECARY.HIT_INNER(this.quality, this.maxQuality);
        this.msgClass = 'msg-double';
        this.stats.trackPotionHit(true);
        if (this.quality >= this.maxQuality) this.onPerfectPotion();
      } else if (this.isInZone) {
        this.quality  = Math.min(this.maxQuality, this.quality + 1);
        this.lastMsg  = MINIGAME_MSG.APOTHECARY.HIT_ZONE(this.quality, this.maxQuality);
        this.msgClass = 'msg-good';
        this.stats.trackPotionHit(false);
        if (this.quality >= this.maxQuality) this.onPerfectPotion();
      } else {
        this.quality    = Math.max(0, this.quality - 1);
        this.hadMistake = true;
        if (this.dilutionEnabled) {
          this.dilutionMissPenalty += APOTH_MG.DILUTION_MISS_PENALTY;
        }
        this.lastMsg    = MINIGAME_MSG.APOTHECARY.MISS_ZONE(this.quality, this.maxQuality);
        this.msgClass   = 'msg-bad';
        this.stats.trackPotionMiss();
      }
    }
  }

  // ── Private ───────────────────────────────

  private startAnimation(): void {
    // Run rAF outside Angular so the frame loop doesn't trigger global CD.
    // We call detectChanges() locally each frame to update only this component's
    // template bindings (barPos, zone indicators) — cheap and stutter-free.
    const loop = (timestamp: number) => {
      if (!this.potionActive) return;

      if (this.lastTime !== undefined) {
        const dt = timestamp - this.lastTime;
        this.barPos += this.barDir * this.barSpeed * dt;

        if (this.barPos >= 100) { this.barPos = 100; this.barDir = -1; }
        else if (this.barPos <= 0) { this.barPos = 0; this.barDir = 1; }
      }
      this.lastTime = timestamp;

      this.cdr.detectChanges();          // re-render only this component
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
    this.potionActive      = false;
    this.dilutionMissPenalty = 0;
    this.perfectClickBonus   = 0;
    this.stats.trackApothecaryMinigameComplete();

    // ── Synaptical mode: 1 synaptical potion, no dilution ──
    if (this.synapticalEnabled) {
      this.wallet.add('synaptical-potion', 1);
      this.stats.trackCurrencyGain('synaptical-potion', 1);

      if (!this.wallet.isCurrencyUnlocked('synaptical-potion')) {
        this.wallet.unlockCurrency('synaptical-potion');
        this.log.log('A Synaptical Potion has been crafted! New currency unlocked!', 'rare');
      } else {
        this.log.log(`Synaptical Potion crafted! (${cur('synaptical-potion', 1)})`, 'success');
      }

      this.lastMsg  = 'Synaptical Potion brewed!';
      this.msgClass = 'msg-good';
      return;
    }

    // ── Concentrated potion modes (standard and dilution) ──
    if (this.potionDilutionUnlocked && this.dilutionEnabled) {
      // Dilution: roll dilutionTotalRolls independent potions, each with a chance to downgrade
      const totalRolls = this.dilutionTotalRolls;
      const failChance = 100 - this.dilutionSuccessChance;
      let concentrated = 0;
      let downgraded   = 0;

      for (let i = 0; i < totalRolls; i++) {
        if (rollChance(failChance)) {
          downgraded++;
        } else {
          concentrated++;
        }
      }

      if (concentrated > 0) this.wallet.add('concentrated-potion', concentrated);
      if (downgraded > 0)   this.wallet.add('potion', downgraded);

      // Track stats
      if (concentrated > 0) this.stats.trackCurrencyGain('concentrated-potion', concentrated);
      if (downgraded > 0)   this.stats.trackCurrencyGain('potion', downgraded);
      for (let i = 0; i < totalRolls; i++) {
        this.stats.trackDilution(i < concentrated);
      }

      if (!this.wallet.isCurrencyUnlocked('concentrated-potion') && concentrated > 0) {
        this.wallet.unlockCurrency('concentrated-potion');
        this.log.log('A Concentrated Potion has been crafted! New currency unlocked!', 'rare');
      }

      if (concentrated === totalRolls) {
        this.log.log(`Dilution success! (${cur('concentrated-potion', concentrated)})`, 'success');
        this.lastMsg  = MINIGAME_MSG.APOTHECARY.DILUTE_FULL(concentrated, totalRolls);
        this.msgClass = 'msg-good';
      } else if (concentrated > 0) {
        this.log.log(`Dilution partial! (${cur('concentrated-potion', concentrated)}, ${cur('potion', downgraded)})`, 'success');
        this.lastMsg  = MINIGAME_MSG.APOTHECARY.DILUTE_PARTIAL(concentrated, downgraded, totalRolls);
        this.msgClass = 'msg-good';
      } else {
        this.log.log(`Dilution failed! (${cur('potion', downgraded)})`, 'warn');
        this.lastMsg  = MINIGAME_MSG.APOTHECARY.DILUTE_FAIL(downgraded);
        this.msgClass = 'msg-bad';
      }
    } else {
      // Standard: 1 concentrated potion
      this.wallet.add('concentrated-potion', 1);
      this.stats.trackCurrencyGain('concentrated-potion', 1);

      if (!this.wallet.isCurrencyUnlocked('concentrated-potion')) {
        this.wallet.unlockCurrency('concentrated-potion');
        this.log.log('A Concentrated Potion has been crafted! New currency unlocked!', 'rare');
      } else {
        this.log.log(`Concentrated Potion crafted! (${cur('concentrated-potion', 1)})`, 'success');
      }

      this.lastMsg  = MINIGAME_MSG.APOTHECARY.PERFECT;
      this.msgClass = 'msg-good';
    }
  }
}

