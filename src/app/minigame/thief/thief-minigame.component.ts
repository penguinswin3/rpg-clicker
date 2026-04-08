import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, NgZone, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { THIEF_MG, AUTO_SOLVE, BEADS, GOLD2_CONDITIONS } from '../../game-config';
import { CURRENCY_FLAVOR, MINIGAME_MSG, cur, GOLD2_STEP_MESSAGES } from '../../flavor-text';
import { toPct, randInt, rollChance } from '../../utils/mathUtils';

@Component({
  selector: 'app-thief-minigame',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './thief-minigame.component.html',
  styleUrls: ['./thief-minigame.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThiefMinigameComponent implements OnInit, OnDestroy, OnChanges {
  private wallet = inject(WalletService);
  private log    = inject(ActivityLogService);
  private stats  = inject(StatisticsService);
  private zone   = inject(NgZone);
  private cdr    = inject(ChangeDetectorRef);
  private sub    = new Subscription();
  private animFrame?: number;
  private lastTime?: number;

  /** Expose Math to the template for SVG trig calculations. */
  readonly Math = Math;

  readonly currencyFlavor = CURRENCY_FLAVOR;
  readonly DOSSIER_COST   = THIEF_MG.DOSSIER_COST;

  // ── Upgrade inputs ────────────────────────
  /** Vanishing Powder level — each level adds +1 max detection. */
  @Input() vanishingPowderLevel = 0;
  /** Potion of Cat's Ears level — each level adds +3° to the sweet spot. */
  @Input() potionCatEarsLevel   = 0;
  /** Bag of Holding level — each level adds +5 to base gold and treasure yields. */
  @Input() bagOfHoldingLevel    = 0;
  /** Relic Hunter level — each level adds +1% relic drop chance. */
  @Input() relicHunterLevel     = 0;
  /** Locked In level — when ≥1, failed click positions are shown as red ticks on the dial. */
  @Input() lockedInLevel        = 0;
  /** Flow State level — when ≥1, failed tick colours shift from red→yellow→green based on proximity to the sweet spot. */
  @Input() flowStateLevel        = 0;

  // ── Auto-solve ──────────────────────────
  @Input() autoSolveUnlocked = false;
  @Input() autoSolveEnabled = false;
  @Input() autoSolveGoodMode = false;
  @Output() autoSolveEnabledChange = new EventEmitter<boolean>();
  @Output() goldBeadFound = new EventEmitter<void>();
  private autoSolveInterval?: ReturnType<typeof setInterval>;
  /** Pre-computed evenly-spaced angles for the auto-solve guesses. */
  private autoSolveAngles: number[] = [];
  private autoSolveAngleIdx = 0;

  // ── Gold-2 bead tracking ─────────────────
  @Input() gold2Progress: unknown;
  @Output() gold2ProgressChange = new EventEmitter<unknown>();
  @Output() gold2BeadFound = new EventEmitter<void>();
  private gold2Awarded = false;
  /** Level of the Gem Hunter upgrade — enables gold-2 log progress messages. */
  @Input() gemHunterLevel = 0;
  /** Whether the gold-2 bead has already been found for this character (suppresses log messages). */
  @Input() gold2BeadAlreadyFound = false;

  // ── Good auto-solve state ────────────────
  /** Phase of the good auto-solve: 'probe1' → 'probe2' → 'crack'. */
  private goodAutoPhase: 'probe1' | 'probe2' | 'crack' = 'probe1';

  toggleAutoSolve(): void {
    this.autoSolveEnabledChange.emit(!this.autoSolveEnabled);
  }

  // ── Wallet-synced ─────────────────────────
  dossiers = 0;

  // ── Heist state ───────────────────────────
  heistActive = false;
  heistWon    = false;
  heistLost   = false;

  /** Current pointer angle in degrees (0–360, clockwise from top). */
  pointerAngle = 0;

  /** Hidden sweet spot center angle (0–360). */
  private sweetSpotCenter = 0;

  /** Current detection level. */
  detection = 0;

  /** Angles (degrees) of failed click attempts this round — populated when Locked In is active. */
  failedAngles: number[] = [];

  // ── Messages ──────────────────────────────
  lastMsg  = '';
  msgClass = 'msg-neutral';

  // ── Result display ────────────────────────
  resultParts: Array<{ amount: number; symbol: string; color: string }> = [];
  resultXp = 0;

  // ── Computed — upgrade-driven ─────────────

  /** Effective max detection: base + 1 per Vanishing Powder level. */
  get maxDetection(): number {
    return THIEF_MG.MAX_DETECTION + this.vanishingPowderLevel * THIEF_MG.VANISHING_POWDER_DETECT_PER_LEVEL;
  }

  /** Effective sweet spot size in degrees: base + 3° per Cat's Ears level. */
  get effectiveSweetSpotSize(): number {
    return THIEF_MG.SWEET_SPOT_SIZE + this.potionCatEarsLevel * THIEF_MG.CATS_EARS_SPOT_PER_LEVEL;
  }

  /** Bag of Holding max-yield bonus for treasure (scales with unused detection fraction). */
  get effectiveMaxTreasureBonus(): number {
    return this.bagOfHoldingLevel * THIEF_MG.BAG_OF_HOLDING_TREASURE_YIELD_PER_LEVEL;
  }

  /** Bag of Holding max-yield bonus for gold (scales with unused detection fraction). */
  get effectiveMaxGoldBonus(): number {
    return this.bagOfHoldingLevel * THIEF_MG.BAG_OF_HOLDING_GOLD_YIELD_PER_LEVEL;
  }

  /** Relic drop chance — always 1% regardless of Relic Hunter level (that controls the cap, not the rate). */
  get effectiveRelicChance(): number {
    return THIEF_MG.RELIC_CHANCE;
  }

  /** Maximum lifetime relics that can ever be found: base 1 + 1 per Relic Hunter level. */
  get relicCap(): number {
    return 1 + this.relicHunterLevel;
  }

  /** True when the player has already found the maximum number of lifetime relics. */
  get relicCapReached(): boolean {
    return (this.stats.current.lifetimeCurrency['relic'] ?? 0) >= this.relicCap;
  }

  // ── Other computed ────────────────────────

  get canStart(): boolean {
    return !this.heistActive && this.dossiers >= this.DOSSIER_COST;
  }

  get detectionPct(): number {
    return toPct(this.detection, this.maxDetection);
  }

  get detectionBar(): string {
    const filled = Math.round((this.detection / this.maxDetection) * 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
  }

  /** Sweet-spot arc start angle for the SVG dial indicator. */
  get sweetSpotStartDeg(): number {
    return this.sweetSpotCenter - this.effectiveSweetSpotSize / 2;
  }

  /** Sweet-spot arc end angle for the SVG dial indicator. */
  get sweetSpotEndDeg(): number {
    return this.sweetSpotCenter + this.effectiveSweetSpotSize / 2;
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
        this.dossiers = Math.floor(s['dossier']?.amount ?? 0);
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

  startHeist(): void {
    if (!this.canStart) return;
    this.wallet.remove('dossier', this.DOSSIER_COST);
    this.heistActive = true;
    this.heistWon    = false;
    this.heistLost   = false;
    this.detection   = 0;
    this.pointerAngle = 0;
    this.resultParts  = [];
    this.resultXp     = 0;
    this.failedAngles = [];
    this.sweetSpotCenter = randInt(0, 359);
    this.lastMsg  = MINIGAME_MSG.THIEF.IDLE;
    this.msgClass = 'msg-neutral';
    this.lastTime = undefined;
    this.log.log(`Heist started! (${cur('dossier', this.DOSSIER_COST, '-')})`);
    this.startAnimation();
  }

  /** Player clicks on the dial trying to find the sweet spot, or to restart after completion. */
  attemptCrack(): void {
    // If heist is complete, try to restart it
    if ((this.heistWon || this.heistLost) && !this.heistActive) {
      if (!this.canStart) {
        this.lastMsg  = `Need ${this.DOSSIER_COST - this.dossiers} more ${CURRENCY_FLAVOR['dossier'].name}`;
        this.msgClass = 'msg-bad';
        return;
      }
      this.startHeist();
      return;
    }

    // Normal crack attempt during active heist
    if (!this.heistActive) return;

    // Gold-2 tracking: record each crack attempt angle
    if (!this.autoSolveEnabled && !this.gold2Awarded) {
      this.trackGold2Angle();
    }

    if (this.isInSweetSpot()) {
      this.heistWon    = true;
      this.heistActive = false;
      this.stopAnimation();
      this.stats.trackThiefHeist(true);
      this.awardRewards();
    } else {
      // Record the failed position for Locked In
      if (this.lockedInLevel >= 1) {
        this.failedAngles = [...this.failedAngles, this.pointerAngle];
      }
      this.detection += THIEF_MG.DETECTION_PER_MISS;
      if (this.detection >= this.maxDetection) {
        this.heistLost   = true;
        this.heistActive = false;
        this.stopAnimation();
        this.stats.trackThiefHeist(false);
        this.lastMsg  = MINIGAME_MSG.THIEF.BUSTED;
        this.msgClass = 'msg-bad';
        this.log.log('Heist failed — you were detected!', 'warn');
      } else {
        this.lastMsg  = MINIGAME_MSG.THIEF.MISS;
        this.msgClass = 'msg-bad';
      }
    }
  }

  // ── Auto-solve helpers ──────────────────

  private startAutoSolve(): void {
    this.stopAutoSolve();
    this.autoSolveInterval = setInterval(() => this.autoSolveTick(), AUTO_SOLVE.THIEF_TICK_MS);
  }

  private stopAutoSolve(): void {
    if (this.autoSolveInterval) {
      clearInterval(this.autoSolveInterval);
      this.autoSolveInterval = undefined;
    }
  }

  /** The interval tick only handles starting new heists and pre-computing target angles. */
  private autoSolveTick(): void {
    if (!this.autoSolveEnabled || !this.autoSolveUnlocked) {
      this.stopAutoSolve();
      return;
    }
    // If heist is not active, start one
    if (!this.heistActive) {
      if (this.canStart) {
        this.startHeist();
        if (this.autoSolveGoodMode) {
          // Good auto-solve: probe at 0° and 30° quickly, then crack at the sweet spot
          this.goodAutoPhase = 'probe1';
          this.autoSolveAngles = [0, 30];
          this.autoSolveAngleIdx = 0;
        } else {
          // Pre-compute evenly spaced angles based on maxDetection
          const attempts = this.maxDetection;
          this.autoSolveAngles = [];
          for (let i = 0; i < attempts; i++) {
            this.autoSolveAngles.push((360 / attempts) * i);
          }
          this.autoSolveAngleIdx = 0;
        }
      }
      this.cdr.markForCheck();
    }
    // Actual crack attempts are handled inside the animation loop
  }

  /**
   * Check if the pointer crossed a target angle between two frames.
   * Handles the 360→0 wrap-around.
   */
  private hasCrossedAngle(prev: number, curr: number, target: number): boolean {
    if (prev <= curr) {
      // No wrap: check if target is between prev and curr (inclusive)
      return target >= prev && target <= curr;
    } else {
      // Wrapped past 360→0: target in [prev, 360) or [0, curr]
      return target >= prev || target <= curr;
    }
  }

  private rollMinigameGoldBead(): void {
    if (this.stats.getManualSidequestClears('thief') < BEADS.GOLD_BEAD_MIN_MANUAL_CLEARS) return;
    if (Math.random() < BEADS.MINIGAME_GOLD_BEAD_CHANCE) {
      this.goldBeadFound.emit();
    }
  }

  // ── Private ───────────────────────────────

  /** Check whether the pointer is currently within the sweet spot arc. */
  private isInSweetSpot(): boolean {
    const halfSize = this.effectiveSweetSpotSize / 2;
    let diff = this.pointerAngle - this.sweetSpotCenter;
    // Normalize diff to [-180, 180]
    if (diff > 180)  diff -= 360;
    if (diff < -180) diff += 360;
    return Math.abs(diff) <= halfSize;
  }

  private awardRewards(): void {
    const bm = this.wallet.getBeadMultiplier('thief');
    const unused   = this.maxDetection - this.detection;
    // Bag of Holding bonus scales with efficiency: full bonus at 0 detection used, none at full detection used
    const unusedFraction = this.maxDetection > 0 ? unused / this.maxDetection : 0;
    const treasure = (THIEF_MG.TREASURE_BASE + THIEF_MG.TREASURE_PER_UNUSED * unused
                   + Math.floor(this.effectiveMaxTreasureBonus * unusedFraction)) * bm;
    const gold     = (THIEF_MG.GOLD_BASE     + THIEF_MG.GOLD_PER_UNUSED     * unused
                   + Math.floor(this.effectiveMaxGoldBonus     * unusedFraction)) * bm;
    const xp       = THIEF_MG.XP_REWARD * bm;

    this.wallet.add('treasure', treasure);
    this.wallet.add('gold', gold);
    this.wallet.add('xp', xp);

    // Track stats
    this.stats.trackCurrencyGain('treasure', treasure);
    this.stats.trackCurrencyGain('gold', gold);
    this.stats.trackCurrencyGain('xp', xp);

    if (!this.wallet.isCurrencyUnlocked('treasure')) {
      this.wallet.unlockCurrency('treasure');
      this.log.log('Treasure discovered! New currency unlocked!', 'rare');
    }

    this.resultParts = [
      { amount: treasure, symbol: CURRENCY_FLAVOR['treasure'].symbol, color: CURRENCY_FLAVOR['treasure'].color },
      { amount: gold,     symbol: CURRENCY_FLAVOR['gold'].symbol,     color: CURRENCY_FLAVOR['gold'].color },
    ];
    this.resultXp = xp;

    // Relic roll — only if the lifetime cap hasn't been reached
    // Pity: guarantee a relic if player has 100+ successful heists and has never found one
    const lifetimeRelics = this.stats.current.lifetimeCurrency['relic'] ?? 0;
    const pityGuarantee = lifetimeRelics === 0
      && this.stats.current.thiefMinigame.successfulHeists >= 100;
    if (!this.relicCapReached && (pityGuarantee || rollChance(this.effectiveRelicChance))) {
      this.wallet.add('relic', THIEF_MG.RELIC_AMOUNT);
      this.stats.trackCurrencyGain('relic', THIEF_MG.RELIC_AMOUNT);
      if (!this.wallet.isCurrencyUnlocked('relic')) {
        this.wallet.unlockCurrency('relic');
        this.log.log('A Relic has been unearthed! Incredibly rare!', 'rare');
        this.stats.recordMilestone('first_relic', 'First Relic Found');
      }
      this.resultParts.push({
        amount: THIEF_MG.RELIC_AMOUNT,
        symbol: CURRENCY_FLAVOR['relic'].symbol,
        color:  CURRENCY_FLAVOR['relic'].color,
      });
      this.log.log(`Safe cracked! (${cur('treasure', treasure)}, ${cur('gold', gold)}, ${cur('relic', THIEF_MG.RELIC_AMOUNT)}, ${cur('xp', xp)})`, 'rare');
    } else {
      this.log.log(`Safe cracked! (${cur('treasure', treasure)}, ${cur('gold', gold)}, ${cur('xp', xp)})`, 'success');
    }

    this.lastMsg  = MINIGAME_MSG.THIEF.SUCCESS;
    this.msgClass = 'msg-good';

    // Roll for gold bead on successful heist
    if (!this.autoSolveEnabled) {
      this.stats.trackManualSidequestClear('thief');
    }
    this.rollMinigameGoldBead();
  }

  // ── Animation loop ────────────────────────

  private startAnimation(): void {
    const loop = (timestamp: number) => {
      if (!this.heistActive) return;

      if (this.lastTime !== undefined) {
        const dt = timestamp - this.lastTime;
        const prevAngle = this.pointerAngle;
        this.pointerAngle = (this.pointerAngle + THIEF_MG.DIAL_SPEED * dt / 1000) % 360;

        // Auto-solve: check if the spinning pointer crossed the next target angle
        if (this.autoSolveEnabled
            && this.autoSolveAngleIdx < this.autoSolveAngles.length
            && this.heistActive) {
          const target = this.autoSolveAngles[this.autoSolveAngleIdx];
          if (this.hasCrossedAngle(prevAngle, this.pointerAngle, target)) {
            this.pointerAngle = target; // snap to the exact target angle
            this.autoSolveAngleIdx++;
            this.attemptCrack();

            // Good auto-solve: after each probe, update state
            if (this.autoSolveGoodMode && this.heistActive) {
              this.handleGoodAutoProbeResult();
            }

            // If heist ended from that crack, bail out of this frame
            if (!this.heistActive) {
              this.cdr.detectChanges();
              return;
            }
          }
        }
      }
      this.lastTime = timestamp;

      this.cdr.detectChanges(); // re-render only this component
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

  // ── Good auto-solve helpers ─────────────

  /**
   * After a probe attempt in good auto-solve, schedule the next action.
   * Probe1 at 0°, Probe2 at 30°. If both miss, target the sweet spot center directly.
   */
  private handleGoodAutoProbeResult(): void {
    if (this.goodAutoPhase === 'probe1') {
      // First probe missed — continue to probe2 (already scheduled)
      this.goodAutoPhase = 'probe2';
    } else if (this.goodAutoPhase === 'probe2') {
      // Both probes missed — schedule a crack at the actual sweet spot
      this.goodAutoPhase = 'crack';
      this.autoSolveAngles.push(this.sweetSpotCenter);
    }
  }

  // ── Gold-2 helpers ─────────────────────

  /**
   * Track crack attempt angles for the gold-2 unlock.
   * Must guess specific angles in order within tolerance.
   * On a matching angle: advance the step.
   * On a non-matching angle: do nothing (don't reset).
   * The streak is only reset when a heist FAILS (see attemptCrack).
   */
  private trackGold2Angle(): void {
    const progress = (this.gold2Progress as { step?: number }) ?? {};
    let step = progress.step ?? 0;
    const sequence = GOLD2_CONDITIONS.THIEF_ANGLE_SEQUENCE;
    const tolerance = GOLD2_CONDITIONS.THIEF_ANGLE_TOLERANCE;

    if (step >= sequence.length) {
      return;
    }

    const targetAngle = sequence[step];
    const clickAngle = this.pointerAngle;

    // Check if the click is within tolerance of the target clock-face angle
    let diff = Math.abs(clickAngle - targetAngle);
    if (diff > 180) diff = 360 - diff;

    if (diff <= tolerance) {
      step++;
      if (step >= sequence.length) {
        // Pattern complete — award the bead!
        this.gold2Awarded = true;
        this.gold2BeadFound.emit();
        this.gold2ProgressChange.emit({ step: 0 });
      } else {
        if (this.gemHunterLevel >= 1 && !this.gold2BeadAlreadyFound) {
          const msgs = GOLD2_STEP_MESSAGES['thief'];
          this.log.log(msgs[(step - 1) % msgs.length], 'rare');
        }
        this.gold2ProgressChange.emit({ step });
      }
    }
    // Non-matching angle: do nothing — streak preserved.
    // Only reset on heist failure (handled in attemptCrack).
  }

  /** Reset the gold-2 streak on heist failure. */
  private resetGold2OnFailure(): void {
    if (!this.gold2Awarded) {
      this.gold2ProgressChange.emit({ step: 0 });
    }
  }

  // ── Dial SVG helpers ────────────────────

  /** Compute (x1,y1)→(x2,y2) for a failed-click tick mark on the dial at angle `a`. */
  getFailedTickCoords(a: number): { x1: number; y1: number; x2: number; y2: number } {
    const rad = (a - 90) * Math.PI / 180;
    return {
      x1: 60 + 42 * Math.cos(rad),
      y1: 60 + 42 * Math.sin(rad),
      x2: 60 + 50 * Math.cos(rad),
      y2: 60 + 50 * Math.sin(rad),
    };
  }

  /**
   * Colour for a failed tick — grades from red (far from sweet spot) through
   * yellow to green (very close) when Flow State is active.
   * Without Flow State, all failed ticks are red.
   */
  getFailedTickColor(a: number): string {
    if (this.flowStateLevel < 1) return '#ff4444';
    // Proximity to the sweet spot center (0 = on it, 180 = opposite side)
    let diff = Math.abs(a - this.sweetSpotCenter);
    if (diff > 180) diff = 360 - diff;
    const halfSpot = this.effectiveSweetSpotSize / 2;
    if (diff <= halfSpot) return '#44ff44'; // shouldn't normally happen (that's a hit)
    // Map distance to hue: close → green (120), far → red (0)
    const maxDist = 180;
    const t = Math.max(0, Math.min(1, 1 - (diff - halfSpot) / (maxDist - halfSpot)));
    const hue = Math.round(t * 120);
    return `hsl(${hue}, 100%, 50%)`;
  }

  /** Build an SVG arc path string for the sweet-spot highlight. */
  getSweetSpotArc(cx: number, cy: number, r: number): string {
    const startDeg = this.sweetSpotStartDeg - 90;
    const endDeg   = this.sweetSpotEndDeg - 90;
    const startRad = startDeg * Math.PI / 180;
    const endRad   = endDeg * Math.PI / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = (endDeg - startDeg + 360) % 360 > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }
}

