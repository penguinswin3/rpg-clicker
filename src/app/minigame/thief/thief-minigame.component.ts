import { Component, Input, OnInit, OnDestroy, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { THIEF_MG } from '../../game-config';
import { CURRENCY_FLAVOR, MINIGAME_MSG } from '../../flavor-text';
import { toPct, randInt, rollChance } from '../../utils/mathUtils';

@Component({
  selector: 'app-thief-minigame',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './thief-minigame.component.html',
  styleUrls: ['./thief-minigame.component.scss'],
})
export class ThiefMinigameComponent implements OnInit, OnDestroy {
  private wallet = inject(WalletService);
  private log    = inject(ActivityLogService);
  private stats  = inject(StatisticsService);
  private zone   = inject(NgZone);
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

  /** Effective relic drop chance (%): base + 1% per Relic Hunter level. */
  get effectiveRelicChance(): number {
    return THIEF_MG.RELIC_CHANCE + this.relicHunterLevel * THIEF_MG.RELIC_HUNTER_CHANCE_PER_LEVEL;
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

  ngOnInit(): void {
    this.sub.add(
      this.wallet.state$.subscribe(s => {
        this.dossiers = Math.floor(s['dossier']?.amount ?? 0);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.stopAnimation();
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
    this.log.log(`Heist started! (−${this.DOSSIER_COST} ${CURRENCY_FLAVOR['dossier'].symbol})`);
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
        this.lastMsg  = MINIGAME_MSG.THIEF.MISS(this.detection, this.maxDetection);
        this.msgClass = 'msg-bad';
      }
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
    const unused   = this.maxDetection - this.detection;
    // Bag of Holding bonus scales with efficiency: full bonus at 0 detection used, none at full detection used
    const unusedFraction = this.maxDetection > 0 ? unused / this.maxDetection : 0;
    const treasure = THIEF_MG.TREASURE_BASE + THIEF_MG.TREASURE_PER_UNUSED * unused
                   + Math.floor(this.effectiveMaxTreasureBonus * unusedFraction);
    const gold     = THIEF_MG.GOLD_BASE     + THIEF_MG.GOLD_PER_UNUSED     * unused
                   + Math.floor(this.effectiveMaxGoldBonus     * unusedFraction);
    const xp       = THIEF_MG.XP_REWARD;

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

    // Relic roll
    if (rollChance(this.effectiveRelicChance)) {
      this.wallet.add('relic', THIEF_MG.RELIC_AMOUNT);
      this.stats.trackCurrencyGain('relic', THIEF_MG.RELIC_AMOUNT);
      if (!this.wallet.isCurrencyUnlocked('relic')) {
        this.wallet.unlockCurrency('relic');
        this.log.log('A Relic has been unearthed! Incredibly rare!', 'rare');
      }
      this.resultParts.push({
        amount: THIEF_MG.RELIC_AMOUNT,
        symbol: CURRENCY_FLAVOR['relic'].symbol,
        color:  CURRENCY_FLAVOR['relic'].color,
      });
      this.log.log(`Safe cracked! +${treasure} treasure, +${gold}g, +${THIEF_MG.RELIC_AMOUNT} relic! (+${xp} XP)`, 'rare');
    } else {
      this.log.log(`Safe cracked! +${treasure} treasure, +${gold}g (+${xp} XP)`, 'success');
    }

    this.lastMsg  = MINIGAME_MSG.THIEF.SUCCESS;
    this.msgClass = 'msg-good';
  }

  // ── Animation loop ────────────────────────

  private startAnimation(): void {
    const loop = (timestamp: number) => {
      if (!this.heistActive) return;

      if (this.lastTime !== undefined) {
        const dt = timestamp - this.lastTime;
        this.pointerAngle = (this.pointerAngle + THIEF_MG.DIAL_SPEED * dt / 1000) % 360;
      }
      this.lastTime = timestamp;

      this.zone.run(() => {}); // tick Angular CD
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

  // ── SVG helpers ───────────────────────────

  /**
   * SVG line endpoints for a Locked In failed-click tick mark.
   * Drawn from just inside the ring (r=43) to the ring edge (r=50).
   */
  getFailedTickCoords(angle: number): { x1: number; y1: number; x2: number; y2: number } {
    const rad = (angle - 90) * Math.PI / 180;
    return {
      x1: 60 + 43 * Math.cos(rad),
      y1: 60 + 43 * Math.sin(rad),
      x2: 60 + 50 * Math.cos(rad),
      y2: 60 + 50 * Math.sin(rad),
    };
  }

  /**
   * Returns the stroke color for a failed-click tick mark.
   * Without Flow State: always red (#f44).
   * With Flow State: interpolates red → yellow → green on a 0–180° angular
   * distance scale from the sweet spot center.
   *   0°  away → hue 120 (green)
   *   90° away → hue 60  (yellow)
   *   180° away → hue 0  (red)
   */
  getFailedTickColor(angle: number): string {
    if (this.flowStateLevel < 1) return '#f44';
    // Compute shortest angular distance from this tick to the sweet spot center
    let diff = Math.abs(angle - this.sweetSpotCenter) % 360;
    if (diff > 180) diff = 360 - diff;
    // Normalize to [0, 1]: 0 = at center, 1 = opposite side
    const t = Math.min(diff / 180, 1);
    // Interpolate hue: 120 (green) → 60 (yellow) → 0 (red)
    const hue = Math.round(120 * (1 - t));
    return `hsl(${hue}, 90%, 55%)`;
  }

  /** Compute the SVG arc path for the sweet-spot indicator (shown after heist ends). */
  getSweetSpotArc(cx: number, cy: number, r: number): string {
    const startRad = (this.sweetSpotStartDeg - 90) * Math.PI / 180;
    const endRad   = (this.sweetSpotEndDeg   - 90) * Math.PI / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = this.effectiveSweetSpotSize > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }
}


