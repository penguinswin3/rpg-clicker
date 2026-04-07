import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, NgZone, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { APOTH_MG, AUTO_SOLVE, BEADS, GOLD2_CONDITIONS, GOOD_AUTO_SOLVE } from '../../game-config';
import { CURRENCY_FLAVOR, MINIGAME_MSG, cur, GOLD2_STEP_MESSAGES } from '../../flavor-text';
import { toPct, rollChance } from '../../utils/mathUtils';

@Component({
  selector: 'app-apothecary-minigame',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './apothecary-minigame.component.html',
  styleUrls: ['./apothecary-minigame.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApothecaryMinigameComponent implements OnInit, OnDestroy, OnChanges {
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

  // ── Auto-solve ──────────────────────────
  @Input() autoSolveUnlocked = false;
  @Input() autoSolveEnabled = false;
  @Input() autoSolveGoodMode = false;
  @Output() autoSolveEnabledChange = new EventEmitter<boolean>();
  @Output() goldBeadFound = new EventEmitter<void>();
  private autoSolveInterval?: ReturnType<typeof setInterval>;

  // ── Gold-2 bead tracking ─────────────────
  @Input() gold2Progress: unknown;
  @Output() gold2ProgressChange = new EventEmitter<unknown>();
  @Output() gold2BeadFound = new EventEmitter<void>();
  private gold2Awarded = false;
  /** Level of the Gem Hunter upgrade — enables gold-2 log progress messages. */
  @Input() gemHunterLevel = 0;
  /** Whether the gold-2 bead has already been found for this character (suppresses log messages). */
  @Input() gold2BeadAlreadyFound = false;
  /** Tracks the phase within a single brew for gold-2: 'up' → 'down' → 'inner'. */
  private gold2Phase: 'up' | 'down' | 'inner' | 'failed' = 'up';

  toggleAutoSolve(): void {
    this.autoSolveEnabledChange.emit(!this.autoSolveEnabled);
  }

  onDilutionChange(val: boolean): void {
    this.dilutionEnabled = val;
    this.dilutionEnabledChange.emit(val);
  }

  /** Current dilution success chance (base − miss penalty + perfect click bonus). */
  get dilutionSuccessChance(): number {
    return Math.max(0, Math.min(100, APOTH_MG.DILUTION_BASE_CHANCE - this.dilutionMissPenalty + this.perfectClickBonus));
  }

  /**
   * Net modifier to dilution success chance relative to the base.
   * Positive = bonus is outweighing the miss penalty.
   * Negative = miss penalty is outweighing the bonus.
   * Zero = no change from base (nothing shown in UI).
   */
  get dilutionNetModifier(): number {
    return this.perfectClickBonus - this.dilutionMissPenalty;
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
  herbs               = 0;
  potions             = 0;
  concentratedPotions = 0;
  koboldBrains        = 0;

  // ── Potion state ──────────────────────────
  potionActive      = false;
  hadMistake        = false;
  quality           = 0;
  readonly maxQuality                   = APOTH_MG.MAX_QUALITY;
  readonly herbCost                     = APOTH_MG.HERB_COST;
  readonly potionCost                   = APOTH_MG.POTION_COST;
  readonly synapticalHerbCost           = APOTH_MG.SYNAPTICAL_HERB_COST;
  readonly synapticalConcentratedCost   = APOTH_MG.SYNAPTICAL_CONCENTRATED_COST;
  readonly synapticalBrainCost          = APOTH_MG.SYNAPTICAL_BRAIN_COST;
  readonly currencyFlavor               = CURRENCY_FLAVOR;

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
    if (!this.potionActive) {
      if (this.synapticalEnabled) {
        return this.herbs >= this.synapticalHerbCost &&
               this.concentratedPotions >= this.synapticalConcentratedCost &&
               this.koboldBrains >= this.synapticalBrainCost;
      }
      return this.herbs >= this.herbCost && this.potions >= this.potionCost;
    }
    return false;
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
        this.herbs               = Math.floor(s['herb']?.amount                ?? 0);
        this.potions             = Math.floor(s['potion']?.amount              ?? 0);
        this.concentratedPotions = Math.floor(s['concentrated-potion']?.amount ?? 0);
        this.koboldBrains        = Math.floor(s['kobold-brain']?.amount        ?? 0);
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.stopAnimation();
    this.stopAutoSolve();
  }

  // ── Actions ───────────────────────────────

  startPotion(): void {
    if (!this.canStart) return;

    let logCostStr: string;
    if (this.synapticalEnabled) {
      this.wallet.remove('herb',                this.synapticalHerbCost);
      this.wallet.remove('concentrated-potion', this.synapticalConcentratedCost);
      this.wallet.remove('kobold-brain',        this.synapticalBrainCost);
      logCostStr = `${cur('herb', this.synapticalHerbCost, '-')}, ${cur('concentrated-potion', this.synapticalConcentratedCost, '-')}, ${cur('kobold-brain', this.synapticalBrainCost, '-')}`;
    } else {
      this.wallet.remove('herb',   this.herbCost);
      this.wallet.remove('potion', this.potionCost);
      logCostStr = `${cur('herb', this.herbCost, '-')}, ${cur('potion', this.potionCost, '-')}`;
    }
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

    // Generate Synaptic Static bonus zones when brewing in synaptical mode.
    // Zones are placed in evenly-spaced segments to prevent overlaps.
    this.synapticZones = [];
    if (this.synapticalEnabled && this.synapticStaticLevel > 0) {
      const zoneWidth = APOTH_MG.SYNAPTIC_ZONE_WIDTH;
      const n = this.synapticStaticLevel;
      const segmentSize = 100 / n;
      for (let i = 0; i < n; i++) {
        const segStart = i * segmentSize;
        const segEnd   = segStart + segmentSize;
        // Pick a random center within the segment, keeping the zone fully within [0,100]
        const centerMin = Math.max(zoneWidth / 2, segStart + zoneWidth / 2);
        const centerMax = Math.min(100 - zoneWidth / 2, segEnd - zoneWidth / 2);
        const center = centerMin + Math.random() * Math.max(0, centerMax - centerMin);
        const min = Math.max(0, center - zoneWidth / 2);
        const max = Math.min(100, min + zoneWidth);
        this.synapticZones.push({ min, max });
      }
    }

    // Reset gold-2 tracking for this brew
    this.gold2Phase = 'up';

    this.log.log(`Apothecary begins brewing. (${logCostStr})`);
    this.startAnimation();
  }

  brew(): void {
    if (!this.potionActive) return;

    // In synaptical mode, Bubbling Brew / Bigger Bubbles don't apply.
    // Instead, Synaptic Static zones provide +2 quality.
    if (this.synapticalEnabled) {
      if (this.isInSynapticZone) {
        this.quality  = Math.min(this.maxQuality, this.quality + 2);
        this.perfectClickBonus += this.perfectPotionsLevel * 5;
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
        if (this.dilutionEnabled) {
          this.dilutionMissPenalty += APOTH_MG.DILUTION_MISS_PENALTY;
        }
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

    // Gold-2 tracking (only manual play, non-synaptical)
    if (!this.autoSolveEnabled && !this.gold2Awarded && !this.synapticalEnabled) {
      this.trackGold2Brew();
    }
  }

  // ── Auto-solve helpers ──────────────────

  private startAutoSolve(): void {
    this.stopAutoSolve();
    const tickMs = this.autoSolveGoodMode ? GOOD_AUTO_SOLVE.APOTHECARY_TICK_MS : AUTO_SOLVE.APOTHECARY_TICK_MS;
    this.autoSolveInterval = setInterval(() => this.autoSolveTick(), tickMs);
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
    // If no potion is active, start one
    if (!this.potionActive) {
      if (this.canStart) {
        this.startPotion();
      }
      this.cdr.markForCheck();
      return;
    }
    // Only click when the cursor is in the sweet spot zone (not inner zone, not synaptic zones)
    if (this.isInZone) {
      this.brew();
      this.cdr.markForCheck();
    }
  }

  private rollMinigameGoldBead(): void {
    if (Math.random() < BEADS.MINIGAME_GOLD_BEAD_CHANCE) {
      this.goldBeadFound.emit();
    }
  }

  // ── Gold-2 helpers ─────────────────────

  /**
   * Track brew clicks for the gold-2 pattern:
   * Phase 1 (up): Brew up to 9/10 quality (only zone/inner zone hits)
   * Phase 2 (down): Miss down to 0/10 quality (only misses)
   * Phase 3 (inner): Complete using ONLY inner zone clicks
   */
  private trackGold2Brew(): void {
    const peakTarget = GOLD2_CONDITIONS.APOTHECARY_PEAK_QUALITY;

    switch (this.gold2Phase) {
      case 'up':
        // During "up" phase, we just track. Once quality reaches peakTarget, advance to "down".
        if (this.quality >= peakTarget && this.quality < this.maxQuality) {
          this.gold2Phase = 'down';
          if (this.gemHunterLevel >= 1 && !this.gold2BeadAlreadyFound) {
            const msgs = GOLD2_STEP_MESSAGES['apothecary'];
            this.log.log(msgs[0 % msgs.length], 'rare');
          }
        } else if (this.quality >= this.maxQuality) {
          // Completed too early — not the right pattern
          this.gold2Phase = 'failed';
        }
        break;

      case 'down':
        // During "down" phase, quality should be going down via misses.
        if (this.quality <= 0) {
          this.gold2Phase = 'inner';
          if (this.gemHunterLevel >= 1 && !this.gold2BeadAlreadyFound) {
            const msgs = GOLD2_STEP_MESSAGES['apothecary'];
            this.log.log(msgs[1 % msgs.length], 'rare');
          }
        }
        // If quality goes UP during down phase (hit zone), it's ok — the player might
        // have been in the zone accidentally. But if quality reaches max, it's failed.
        if (this.quality >= this.maxQuality) {
          this.gold2Phase = 'failed';
        }
        break;

      case 'inner':
        // During "inner" phase, only inner zone clicks are allowed.
        // If the player clicked and was NOT in inner zone, fail.
        if (!this.isInInnerZone && this.isInZone) {
          // Hit the outer zone (not inner) — fail
          this.gold2Phase = 'failed';
        } else if (!this.isInZone) {
          // Missed entirely — fail (going backwards)
          this.gold2Phase = 'failed';
        }
        // If quality reached max via inner zone only — success! (checked in onPerfectPotion)
        break;

      case 'failed':
        // Already failed — no tracking
        break;
    }
  }

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
    this.potionActive = false;

    // Roll for gold bead on successful brew
    this.rollMinigameGoldBead();

    // Gold-2 check: if we completed in the 'inner' phase, award the bead
    if (!this.autoSolveEnabled && !this.gold2Awarded && !this.synapticalEnabled && this.gold2Phase === 'inner') {
      this.gold2Awarded = true;
      this.gold2BeadFound.emit();
    }

    // Snapshot before zeroing — the getter depends on both fields.
    const successChance = this.dilutionSuccessChance;
    const bm = this.wallet.getBeadMultiplier('apothecary');

    this.dilutionMissPenalty = 0;
    this.perfectClickBonus   = 0;
    this.stats.trackApothecaryMinigameComplete();

    // ── Synaptical mode ──
    if (this.synapticalEnabled) {
      if (this.potionDilutionUnlocked && this.dilutionEnabled) {
        // Dilution in synaptical mode: roll multiple times;
        // success → synaptical potion, failure → downgrade to regular potion.
        const totalRolls = this.dilutionTotalRolls;
        const failChance = 100 - successChance;
        let synaptical = 0;
        let downgraded = 0;

        for (let i = 0; i < totalRolls; i++) {
          if (rollChance(failChance)) {
            downgraded++;
          } else {
            synaptical++;
          }
        }

        const synapticalYield = synaptical * bm;
        const downgradedYield = downgraded * bm;

        if (synapticalYield > 0) this.wallet.add('synaptical-potion', synapticalYield);
        if (downgradedYield > 0) this.wallet.add('potion', downgradedYield);

        if (synapticalYield > 0) this.stats.trackCurrencyGain('synaptical-potion', synapticalYield);
        if (downgradedYield > 0) this.stats.trackCurrencyGain('potion', downgradedYield);
        for (let i = 0; i < totalRolls; i++) {
          this.stats.trackDilution(i < synaptical);
        }

        if (!this.wallet.isCurrencyUnlocked('synaptical-potion') && synapticalYield > 0) {
          this.wallet.unlockCurrency('synaptical-potion');
          this.log.log('A Synaptical Potion has been crafted! New currency unlocked!', 'rare');
        }

        if (synaptical === totalRolls) {
          this.log.log(`Synaptical dilution success! (${cur('synaptical-potion', synapticalYield)})`, 'success');
          this.lastMsg  = `${synaptical}/${totalRolls} SYNAPTICAL!`;
          this.msgClass = 'msg-good';
        } else if (synaptical > 0) {
          this.log.log(`Synaptical dilution partial! (${cur('synaptical-potion', synapticalYield)}, ${cur('potion', downgradedYield)})`, 'success');
          this.lastMsg  = `${synaptical}/${totalRolls} SYNAPTICAL  (${downgraded} BASE)`;
          this.msgClass = 'msg-good';
        } else {
          this.log.log(`Synaptical dilution failed! (${cur('potion', downgradedYield)})`, 'warn');
          this.lastMsg  = `All ${downgraded} failed — ${downgraded}x BASE`;
          this.msgClass = 'msg-bad';
        }
      } else {
        // Standard synaptical: 1 synaptical potion
        const synYield = 1 * bm;
        this.wallet.add('synaptical-potion', synYield);
        this.stats.trackCurrencyGain('synaptical-potion', synYield);

        if (!this.wallet.isCurrencyUnlocked('synaptical-potion')) {
          this.wallet.unlockCurrency('synaptical-potion');
          this.log.log('A Synaptical Potion has been crafted! New currency unlocked!', 'rare');
        } else {
          this.log.log(`Synaptical Potion crafted! (${cur('synaptical-potion', synYield)})`, 'success');
        }

        this.lastMsg  = 'Synaptical Potion brewed!';
        this.msgClass = 'msg-good';
      }
      return;
    }

    // ── Concentrated potion modes (standard and dilution) ──
    if (this.potionDilutionUnlocked && this.dilutionEnabled) {
      // Dilution: roll dilutionTotalRolls independent potions, each with a chance to downgrade
      const totalRolls = this.dilutionTotalRolls;
      const failChance = 100 - successChance;
      let concentrated = 0;
      let downgraded   = 0;

      for (let i = 0; i < totalRolls; i++) {
        if (rollChance(failChance)) {
          downgraded++;
        } else {
          concentrated++;
        }
      }

      const concentratedYield = concentrated * bm;
      const downgradedYield   = downgraded * bm;

      if (concentratedYield > 0) this.wallet.add('concentrated-potion', concentratedYield);
      if (downgradedYield > 0)   this.wallet.add('potion', downgradedYield);

      // Track stats
      if (concentratedYield > 0) this.stats.trackCurrencyGain('concentrated-potion', concentratedYield);
      if (downgradedYield > 0)   this.stats.trackCurrencyGain('potion', downgradedYield);
      for (let i = 0; i < totalRolls; i++) {
        this.stats.trackDilution(i < concentrated);
      }

      if (!this.wallet.isCurrencyUnlocked('concentrated-potion') && concentratedYield > 0) {
        this.wallet.unlockCurrency('concentrated-potion');
        this.log.log('A Concentrated Potion has been crafted! New currency unlocked!', 'rare');
      }

      if (concentrated === totalRolls) {
        this.log.log(`Dilution success! (${cur('concentrated-potion', concentratedYield)})`, 'success');
        this.lastMsg  = MINIGAME_MSG.APOTHECARY.DILUTE_FULL(concentrated, totalRolls);
        this.msgClass = 'msg-good';
      } else if (concentrated > 0) {
        this.log.log(`Dilution partial! (${cur('concentrated-potion', concentratedYield)}, ${cur('potion', downgradedYield)})`, 'success');
        this.lastMsg  = MINIGAME_MSG.APOTHECARY.DILUTE_PARTIAL(concentrated, downgraded, totalRolls);
        this.msgClass = 'msg-good';
      } else {
        this.log.log(`Dilution failed! (${cur('potion', downgradedYield)})`, 'warn');
        this.lastMsg  = MINIGAME_MSG.APOTHECARY.DILUTE_FAIL(downgraded);
        this.msgClass = 'msg-bad';
      }
    } else {
      // Standard: 1 concentrated potion
      const concYield = 1 * bm;
      this.wallet.add('concentrated-potion', concYield);
      this.stats.trackCurrencyGain('concentrated-potion', concYield);

      if (!this.wallet.isCurrencyUnlocked('concentrated-potion')) {
        this.wallet.unlockCurrency('concentrated-potion');
        this.log.log('A Concentrated Potion has been crafted! New currency unlocked!', 'rare');
      } else {
        this.log.log(`Concentrated Potion crafted! (${cur('concentrated-potion', concYield)})`, 'success');
      }

      this.lastMsg  = MINIGAME_MSG.APOTHECARY.PERFECT;
      this.msgClass = 'msg-good';
    }
  }
}

